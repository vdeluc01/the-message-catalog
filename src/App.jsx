import { useState, useEffect, useRef, useMemo } from 'react';
import { uid, getP, iBase, lBase, effectiveStage, checklistStatus,
         isIsrcQuery, normalizeIsrc, primaryTakeIsrc, versionIsSubmittedOrLive,
         versionNeedsIsrc, hasPendingPitches, getEpsForVersion } from './utils.js';
import {
  PERSONAS_KEY, APIKEY_KEY, DATA_KEY, DATA_KEY_V4, FID_KEY, TOMBSTONES_KEY,
  VAULT_STAMP_KEY,
  DEFAULT_PERSONAS, STAGES, RELEASE_STATUSES, VIEWS, PERSONA_COLORS, THEMES,
  EP_STATUSES, PITCH_PLATFORMS
} from './constants.js';
import {
  buildVaultManifest, buildSingleEntryZip, sha256, bytesToHex,
  postDigestToCalendar, buildOtsFile, downloadBytes, vaultBaseFilename
} from './copyrightVault.js';
import { getToken, startOAuth, driveLoad, driveSave } from './drive.js';
import { analyzeWithAI, enrichWithAI, analyzeThemesWithAI } from './ai.js';
import {
  exportSupervisorCSV, exportSupervisorPDF,
  exportLabelCSV, exportLabelPDF,
  exportPublisherCSV, exportPublisherPDF,
  exportCuratorCSV, exportCuratorPDF,
  exportLyricsCSV, exportEpTracklistPDF
} from './exports.js';
import Tour from './Tour.jsx';
import DemoTour from './DemoTour.jsx';
import { DEMO_MASTERS, DEMO_EPS } from './demoFixture.js';
import MasterRow from './components/MasterRow.jsx';
import AddWizard from './components/AddWizard.jsx';
import BatchAdd from './components/BatchAdd.jsx';
import EpView from './components/EpView.jsx';
import PersonasView from './components/PersonasView.jsx';

export default function App() {
  // Demo mode: ?demo=1 or /demo path loads a fixture catalog, skips Google
  // Drive entirely, and blocks destructive actions so visitors can click
  // through without breaking anything. Netlify rewrites /demo -> /index.html
  // with a 200, so the query string isn't visible to the client — we also
  // sniff the pathname directly.
  const isDemo = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('demo') === '1' ||
    window.location.pathname === '/demo' ||
    window.location.pathname === '/demo/'
  );

  // Core data. DATA_KEY is v5 — { masters, eps }. v4 was a bare masters array;
  // a one-time read of v4 seeds v5 if v5 hasn't been written yet.
  const [masters, setMasters] = useState(() => isDemo ? DEMO_MASTERS : []);
  const [eps, setEps] = useState(() => isDemo ? DEMO_EPS : []);
  const [personas, setPersonas] = useState(() => {
    try {
      const p = localStorage.getItem(PERSONAS_KEY);
      if (p) {
        const saved = JSON.parse(p);
        // Merge in any new default personas that aren't already saved
        const merged = [...saved];
        DEFAULT_PERSONAS.forEach(dp => {
          if (!merged.find(sp => sp.id === dp.id)) merged.push(dp);
        });
        // If we added anything, persist the merged list immediately
        if (merged.length !== saved.length) localStorage.setItem(PERSONAS_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch(e) {}
    return DEFAULT_PERSONAS;
  });

  // UI state
  const [activeTab, setActiveTab] = useState('catalog');
  const [view, setView] = useState('Dashboard');
  const [searchQ, setSearchQ] = useState('');
  const [filterPersona, setFilterPersona] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterEp, setFilterEp] = useState('all');           // 'all' | epId | '__none__'
  const [filterIsrc, setFilterIsrc] = useState('all');       // 'all' | 'has' | 'missing'
  const [filterRelease, setFilterRelease] = useState('all'); // 'all' | 'spotify' | 'submitted' | 'hyperfollow' | 'thisMonth' | 'next30'
  const [expandedMaster, setExpandedMaster] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const changeView = (v) => { setView(v); setExpandedGroups(new Set()); };
  const [saveStatus, setSaveStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Settings tabs
  const [settingsTab, setSettingsTab] = useState('general');
  const [editingPersona, setEditingPersona] = useState(null);
  const [newPersonaForm, setNewPersonaForm] = useState({ name:'', genre:'', desc:'', color:'#C8942A' });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(APIKEY_KEY) || '');

  // Copyright Vault — single-click timestamped proof of authorship.
  // `vaultStatus` walks through: idle → building → hashing → stamping → done|manual|error
  const [vaultStatus, setVaultStatus] = useState('idle');
  const [vaultMsg, setVaultMsg] = useState('');
  const [vaultManual, setVaultManual] = useState(null); // { hashHex } when API fails
  const [vaultLastStamp, setVaultLastStamp] = useState(() => {
    try { return JSON.parse(localStorage.getItem(VAULT_STAMP_KEY) || 'null'); } catch(_) { return null; }
  });

  // Drive
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveFileId, setDriveFileId] = useState(null);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveMsg, setDriveMsg] = useState('');

  // Wizard
  const [wizardStep, setWizardStep] = useState('master');
  const [masterForm, setMasterForm] = useState({ title:'', lyrics:'', notes:'' });
  const [versionForm, setVersionForm] = useState({ label:'', stylePrompt:'', firstTakeUrl:'', firstTakeVersion:'', stage:'idea', releaseStatus:'draft', sunoCreatedAt:'' });
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [wizardAnalyzing, setWizardAnalyzing] = useState(false);

  // Add version / take
  const [addingVersionTo, setAddingVersionTo] = useState(null);
  const [addVersionForm, setAddVersionForm] = useState({ label:'', stylePrompt:'', firstTakeUrl:'', stage:'idea', releaseStatus:'draft' });
  const [addVersionAnalysis, setAddVersionAnalysis] = useState(null);
  const [addVersionAnalyzing, setAddVersionAnalyzing] = useState(false);
  const [addVersionConfirming, setAddVersionConfirming] = useState(false);
  const [addingTakeTo, setAddingTakeTo] = useState(null);

  // Batch add
  const newBatchSong = () => ({ id:uid(), title:'', lyrics:'', stylePrompt:'', sunoUrl:'' });
  const [batchSongs, setBatchSongs] = useState([newBatchSong()]);
  const [batchStep, setBatchStep] = useState('input');
  const [batchProgress, setBatchProgress] = useState({ current:0, total:0 });
  const [batchResults, setBatchResults] = useState([]);
  const [takeForm, setTakeForm] = useState({ label:'', stylePrompt:'', sunoUrl:'', sunoVersion:'' });

  const importRef = useRef();
  const driveAutoSaveTimer = useRef(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (isDemo) return false;
    return !localStorage.getItem('tmsg-onboarding-done');
  });
  const dismissOnboarding = () => {
    localStorage.setItem('tmsg-onboarding-done','1');
    setShowOnboarding(false);
  };
  const [driveStatus, setDriveStatus] = useState('');
  const [driveExpired, setDriveExpired] = useState(false);

  // ── Init ──
  useEffect(() => {
    if (isDemo) return; // Demo mode: fixture is already loaded, no Drive, no OAuth
    const token = getToken();
    if (token) {
      setDriveConnected(true);
      handleDriveLoad(token);
    } else {
      // Load local data so the UI isn't empty while we redirect.
      // v5 schema: { masters, eps }. v4 was a bare masters array — read once and
      // promote into the v5 shape with eps:[].
      try {
        const v5 = localStorage.getItem(DATA_KEY);
        if (v5) {
          const parsed = JSON.parse(v5);
          if (Array.isArray(parsed)) {
            setMasters(parsed);                       // very old shape stored under v5 key
          } else {
            setMasters(parsed.masters || []);
            setEps(parsed.eps || []);
          }
        } else {
          const v4 = localStorage.getItem(DATA_KEY_V4);
          if (v4) {
            const old = JSON.parse(v4);
            const oldMasters = Array.isArray(old) ? old : (old?.masters || []);
            setMasters(oldMasters);
            setEps([]);
            try { localStorage.setItem(DATA_KEY, JSON.stringify({ masters: oldMasters, eps: [] })); } catch(_) {}
          }
        }
      } catch(_) {}
      const fid = localStorage.getItem(FID_KEY);
      if (fid) setDriveFileId(fid);
      // Only auto-redirect to OAuth if user has been here before
      // New users see the onboarding modal first; OAuth fires after they dismiss it
      if (localStorage.getItem('tmsg-onboarding-done')) {
        startOAuth();
      }
    }
  }, []);

  // Auto-save to localStorage. Debounced 800ms so rapid edits (typing in a lyrics
  // textarea, sliders, etc.) don't serialize the whole catalog on every keystroke.
  // The first effect runs on mount, so initial state is captured immediately.
  useEffect(() => {
    if (isDemo) return; // Demo mode never writes to localStorage
    const handle = setTimeout(() => {
      try { localStorage.setItem(DATA_KEY, JSON.stringify({ masters, eps })); } catch (e) {}
    }, 800);
    return () => clearTimeout(handle);
  }, [masters, eps]);

  // Auto-save to Google Drive — debounced 4s after any change + every 5 min
  useEffect(() => {
    if (isDemo) return; // Demo mode: no Drive writes
    if (!driveConnected || (masters.length === 0 && eps.length === 0)) return;
    if (driveAutoSaveTimer.current) clearTimeout(driveAutoSaveTimer.current);
    driveAutoSaveTimer.current = setTimeout(() => triggerDriveAutoSave(), 4000);
    return () => { if (driveAutoSaveTimer.current) clearTimeout(driveAutoSaveTimer.current); };
  }, [masters, eps, driveConnected]);

  useEffect(() => {
    if (isDemo) return; // Demo mode: no Drive heartbeat
    // 5-minute heartbeat save. Reads latest masters from localStorage at fire time
    // (inside triggerDriveAutoSave), so we intentionally don't depend on `masters` here —
    // otherwise every edit would reset the interval and it would effectively never fire.
    if (!driveConnected) return;
    const interval = setInterval(() => triggerDriveAutoSave(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driveConnected, driveFileId]);

  const save = (newMasters) => setMasters(newMasters);
  const flash = (msg, ms=2500) => { setSaveStatus(msg); setTimeout(()=>setSaveStatus(''), ms); };
  const flashDrive = (msg, ms=3000) => { setDriveMsg(msg); setTimeout(()=>setDriveMsg(''), ms); };

  async function triggerDriveAutoSave() {
    const token = getToken();
    if (!token) { setDriveStatus('⚠ Session expired'); setDriveExpired(true); return; }
    setDriveExpired(false);
    setDriveStatus('⟳ Saving…');
    try {
      // Read whatever's in localStorage (latest) — v5 schema is { masters, eps }.
      // Tolerate the legacy bare-array v4 shape just in case.
      let payload = { masters: [], eps: [] };
      try {
        const stored = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
        if (Array.isArray(stored)) payload = { masters: stored, eps: [] };
        else if (stored)           payload = { masters: stored.masters || [], eps: stored.eps || [] };
      } catch(_) {}
      const newId = await driveSave(token, payload, driveFileId);
      if (newId) {
        if (newId !== driveFileId) { setDriveFileId(newId); localStorage.setItem(FID_KEY, newId); }
        setDriveStatus('☁ Saved');
        setTimeout(() => setDriveStatus('☁ Connected'), 3000);
      } else { setDriveStatus('⚠ Save failed'); }
    } catch(e) { setDriveStatus('⚠ '+e.message); }
  }

  // ── Drive ──
  async function handleDriveLoad(token) {
    setDriveSyncing(true); flashDrive('Loading from Google Drive…', 60000);
    try {
      const result = await driveLoad(token);
      if (result) {
        const rawDriveMasters = result.data.masters || [];
        const rawDriveEps     = result.data.eps     || [];
        // Filter out anything the user has deleted locally — tombstones survive Drive reconnects
        let tombstones = [];
        try { tombstones = JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'); } catch(_) {}
        const tombSet = new Set(tombstones);
        const driveMasters = rawDriveMasters.filter(m => !tombSet.has(m.id));
        const droppedFromDrive = rawDriveMasters.length - driveMasters.length;
        // Local — v5 shape, but tolerate v4-style bare array.
        let localMasters = [];
        let localEps     = [];
        try {
          const stored = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
          if (Array.isArray(stored)) localMasters = stored;
          else if (stored) { localMasters = stored.masters || []; localEps = stored.eps || []; }
        } catch(_) {}
        const localIds = new Set(localMasters.map(m => m.id));
        const driveOnly = driveMasters.filter(m => !localIds.has(m.id));
        const merged = localMasters.length > 0 ? [...localMasters, ...driveOnly] : driveMasters;
        // EP merge — dedupe by id, prefer local edits.
        const localEpIds = new Set(localEps.map(e => e.id));
        const epsMerged = localEps.length > 0
          ? [...localEps, ...rawDriveEps.filter(e => !localEpIds.has(e.id))]
          : rawDriveEps;
        setMasters(merged);
        setEps(epsMerged);
        setDriveFileId(result.fileId);
        localStorage.setItem(FID_KEY, result.fileId);
        await driveSave(token, { masters: merged, eps: epsMerged }, result.fileId);
        if (driveOnly.length > 0) {
          const tombMsg = droppedFromDrive > 0 ? ` (${droppedFromDrive} previously-deleted song${droppedFromDrive!==1?'s':''} kept deleted)` : '';
          flashDrive(`✓ Reconnected — pulled in ${driveOnly.length} Drive-only song${driveOnly.length!==1?'s':''}${tombMsg}`, 4000);
        } else {
          flashDrive('✓ Connected — local changes pushed to Drive');
        }
        setDriveStatus('☁ Connected');
        setDriveExpired(false);
      } else {
        // No Drive file yet — push whatever we have locally.
        let localMasters = [];
        let localEps     = [];
        try {
          const stored = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
          if (Array.isArray(stored)) localMasters = stored;
          else if (stored) { localMasters = stored.masters || []; localEps = stored.eps || []; }
        } catch(_) {}
        if (localMasters.length > 0 || localEps.length > 0) {
          flashDrive('Saving local data to Drive…', 60000);
          const newId = await driveSave(token, { masters: localMasters, eps: localEps }, null);
          if (newId) { setDriveFileId(newId); localStorage.setItem(FID_KEY, newId); }
        }
        flashDrive('✓ Drive connected');
        setDriveStatus('☁ Connected');
      }
    } catch(e) { flashDrive('⚠ Drive error: '+e.message); }
    setDriveSyncing(false);
  }

  async function handleDriveSave() {
    const token = getToken();
    if (!token) { flashDrive('Session expired — reconnect Drive'); return; }
    setDriveSyncing(true); flashDrive('Saving to Google Drive…', 60000);
    try {
      const newId = await driveSave(token, { masters, eps }, driveFileId);
      if (newId) {
        if (newId !== driveFileId) { setDriveFileId(newId); localStorage.setItem(FID_KEY, newId); }
        flashDrive('✓ Saved to Google Drive');
      } else { flashDrive('⚠ Save failed — try again'); }
    } catch(e) { flashDrive('⚠ '+e.message); }
    setDriveSyncing(false);
  }

  // ── Import / Export ──
  function handleFixImportData() {
    const validStages = STAGES.map(s=>s.id);
    let fixedTakes = 0;
    let fixedStatuses = 0;
    const fixed = masters.map(m=>({
      ...m,
      versions: (m.versions||[]).map(v=>({
        ...v,
        takes: (v.takes||[]).map(t=>{
          const needsStage = !t.stage || !validStages.includes(t.stage);
          const needsStatus = !t.releaseStatus || !['draft','ready','released'].includes(t.releaseStatus);
          if (needsStage) fixedTakes++;
          if (needsStatus) fixedStatuses++;
          return {
            ...t,
            stage: needsStage ? 'idea' : t.stage,
            releaseStatus: needsStatus ? 'draft' : t.releaseStatus,
          };
        })
      }))
    }));
    save(fixed);
    flash(`✓ Fixed ${fixedTakes} takes with missing stage, ${fixedStatuses} with missing status`);
  }

  function handleRecalculateStages() {
    if (!window.confirm('This will recalculate the stage for every take based on its actual data (Suno URL, style prompt, lyrics). Stages you manually set to Reviewing or Final will be kept. Continue?')) return;
    let changed = 0;
    const fixed = masters.map(m=>({
      ...m,
      versions: (m.versions||[]).map(v=>({
        ...v,
        takes: (v.takes||[]).map(t=>{
          if (t.stage === 'reviewing' || t.stage === 'final') return t;
          let newStage = 'idea';
          if (m.lyrics && m.lyrics.trim()) newStage = 'lyrics';
          if (t.stylePrompt && t.stylePrompt.trim()) newStage = 'prompt';
          if (t.sunoUrl && t.sunoUrl.trim()) newStage = 'generated';
          if (newStage !== t.stage) changed++;
          return { ...t, stage: newStage };
        })
      }))
    }));
    save(fixed);
    flash(`✓ Recalculated ${changed} takes`);
  }

  // ── Bulk Reassess Personas ────────────────────────────────────────────────
  const [reassessing, setReassessing] = useState(false);
  const [reassessProgress, setReassessProgress] = useState({ current:0, total:0, newPersonas:[] });
  const [reassessResults, setReassessResults] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current:0, total:0 });
  const [enrichResults, setEnrichResults] = useState(null);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeProgress, setNormalizeProgress] = useState({ current:0, total:0 });
  const [normalizeResults, setNormalizeResults] = useState(null);

  async function handleBulkReassess() {
    if (!apiKey) { alert('Enter your Anthropic API key in Settings → General first.'); return; }
    if (!window.confirm(`This will run every song version through AI to reassess persona assignments. It uses ${masters.reduce((a,m)=>a+(m.versions||[]).length,0)} API calls. Continue?`)) return;
    setReassessing(true);
    setReassessResults(null);
    let currentPersonas = personas;
    try { const p = localStorage.getItem(PERSONAS_KEY); if (p) currentPersonas = JSON.parse(p); } catch(e) {}
    let updated = [...masters];
    let total = masters.reduce((a,m)=>a+(m.versions||[]).length,0);
    let current = 0;
    let reassigned = 0;
    setReassessProgress({ current:0, total, newPersonas:[] });
    for (let mi=0; mi<updated.length; mi++) {
      const m = updated[mi];
      const newVersions = [];
      for (let vi=0; vi<(m.versions||[]).length; vi++) {
        const v = m.versions[vi];
        current++;
        setReassessProgress(p=>({ ...p, current }));
        try {
          const stylePrompt = v.takes?.[0]?.stylePrompt || '';
          const result = await analyzeWithAI(m.title, stylePrompt, m.lyrics||'', apiKey, currentPersonas, true);
          const newPersona = result.persona || result.suggestedPersona || v.persona;
          if (newPersona !== v.persona) reassigned++;
          const updatedVersion = { ...v, persona: newPersona,
            genre: result.genre||v.genre, themes: result.themes||v.themes,
            mood: result.mood||v.mood, instrumentalMood: result.instrumentalMood||v.instrumentalMood,
            targetAudience: result.targetAudience||v.targetAudience,
            versionSummary: result.versionSummary||v.versionSummary };
          newVersions.push(updatedVersion);
        } catch(e) {
          newVersions.push(v);
        }
        await new Promise(r=>setTimeout(r,300));
      }
      updated[mi] = { ...m, versions: newVersions };
    }
    save(updated);
    setReassessing(false);
    setReassessResults({ total, reassigned });
  }

  const needsEnrichment = (v) =>
    !v.genre || !v.mood || !v.instrumentalMood || !v.targetAudience ||
    !v.duration || !v.themes || v.themes.length===0 || !v.versionSummary || !v.albumNote;

  async function handleBulkEnrich() {
    if (!apiKey) { alert('Enter your Anthropic API key in Settings → General first.'); return; }
    const toEnrich = masters.reduce((a,m)=>a+(m.versions||[]).filter(v=>needsEnrichment(v)).length,0);
    if (toEnrich===0) { alert('All song versions already have complete metadata — nothing to fill in!'); return; }
    if (!window.confirm(`This will fill in missing metadata (mood, themes, audience, duration, summary, etc.) on ${toEnrich} version${toEnrich!==1?'s':''} that have blank fields. Existing data will NOT be overwritten. Uses ${toEnrich} AI calls. Continue?`)) return;
    setEnriching(true);
    setEnrichResults(null);
    let updated = [...masters];
    let current = 0;
    let fieldsAdded = 0;
    setEnrichProgress({ current:0, total:toEnrich });
    for (let mi=0; mi<updated.length; mi++) {
      const m = updated[mi];
      const newVersions = [];
      for (let vi=0; vi<(m.versions||[]).length; vi++) {
        const v = m.versions[vi];
        if (!needsEnrichment(v)) { newVersions.push(v); continue; }
        current++;
        setEnrichProgress(p=>({ ...p, current }));
        try {
          const stylePrompt = v.takes?.[0]?.stylePrompt || '';
          const r = await enrichWithAI(m.title, stylePrompt, m.lyrics||'', apiKey);
          const before = [v.genre,v.mood,v.instrumentalMood,v.targetAudience,v.duration,v.themes?.length,v.versionSummary,v.albumNote];
          const enriched = {
            ...v,
            genre:          v.genre            || r.genre            || v.genre,
            mood:           v.mood             || r.mood             || v.mood,
            instrumentalMood: v.instrumentalMood || r.instrumentalMood || v.instrumentalMood,
            targetAudience: v.targetAudience   || r.targetAudience   || v.targetAudience,
            duration:       v.duration         || r.duration         || v.duration,
            themes:         (v.themes&&v.themes.length)
                              ? v.themes
                              : (() => {
                                  const filtered = (r.themes||[]).filter(t=>THEMES.includes(t));
                                  return filtered.length ? filtered : (v.themes || []);
                                })(),
            versionSummary: v.versionSummary   || r.versionSummary   || v.versionSummary,
            albumNote:      v.albumNote        || r.albumNote        || v.albumNote,
          };
          const after = [enriched.genre,enriched.mood,enriched.instrumentalMood,enriched.targetAudience,enriched.duration,enriched.themes?.length,enriched.versionSummary,enriched.albumNote];
          fieldsAdded += after.filter((x,i)=>x&&!before[i]).length;
          newVersions.push(enriched);
        } catch(e) {
          newVersions.push(v);
        }
        await new Promise(r=>setTimeout(r,200));
      }
      updated[mi] = { ...m, versions: newVersions };
    }
    save(updated);
    setEnriching(false);
    setEnrichResults({ total:toEnrich, fieldsAdded });
  }


  async function handleNormalizeThemes() {
    if (!apiKey) { alert('Enter your Anthropic API key in Settings → General first.'); return; }
    const total = masters.reduce((a,m)=>a+(m.versions||[]).length,0);
    if (!window.confirm(`This will re-analyze themes for all ${total} song versions using a standard theme list, replacing any free-form tags with consistent ones. Continue?`)) return;
    setNormalizing(true);
    setNormalizeResults(null);
    let updated = [...masters];
    let current = 0;
    setNormalizeProgress({ current:0, total });
    for (let mi=0; mi<updated.length; mi++) {
      const m = updated[mi];
      const newVersions = [];
      for (let vi=0; vi<(m.versions||[]).length; vi++) {
        const v = m.versions[vi];
        current++;
        setNormalizeProgress(p=>({ ...p, current }));
        try {
          const stylePrompt = v.takes?.[0]?.stylePrompt || '';
          const raw = await analyzeThemesWithAI(m.title, stylePrompt, m.lyrics||'', apiKey);
          const themes = (Array.isArray(raw) ? raw : []).filter(t => THEMES.includes(t));
          newVersions.push({ ...v, themes: themes.length ? themes : v.themes });
        } catch(e) {
          newVersions.push(v);
        }
        await new Promise(r=>setTimeout(r,150));
      }
      updated[mi] = { ...m, versions: newVersions };
    }
    save(updated);
    setNormalizing(false);
    setNormalizeResults({ total });
  }

  function handleExport() {
    const body = JSON.stringify({ masters, eps, savedAt:new Date().toISOString(), version:'5.0' }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body],{type:'application/json'}));
    a.download = 'the-message-catalog-backup.json'; a.click();
    flash('✓ Backup saved');
  }
  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const currentCount = masters.length;
    const confirmMsg = currentCount > 0
      ? `Loading this backup will REPLACE your entire current catalog (${currentCount} song${currentCount!==1?'s':''}). Any changes since this backup was made will be lost.\n\nContinue?`
      : 'Load this backup as your catalog?';
    if (!window.confirm(confirmMsg)) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        let loaded = [];
        if (parsed.masters && Array.isArray(parsed.masters)) {
          loaded = parsed.masters;
        } else if (Array.isArray(parsed)) {
          loaded = parsed;
        }
        loaded = loaded.map(m => ({
          ...m,
          versions: (m.versions||[]).map(v => ({
            ...v,
            takes: v.takes || [{ id:uid(), label:'Take 1', stylePrompt:v.stylePrompt||v.genre||'',
              sunoUrl:v.sunoUrl||'', sunoVersion:'', stage:v.stage||'final',
              releaseStatus:v.releaseStatus||'draft', isPrimary:true, notes:'', addedAt:v.addedAt||new Date().toISOString() }]
          }))
        }));
        const loadedEps = (parsed.eps && Array.isArray(parsed.eps)) ? parsed.eps : [];
        // Restoring a backup explicitly resurrects whatever's in it — clear tombstones for those IDs
        try {
          const existing = JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]');
          const loadedIds = new Set(loaded.map(m => m.id));
          const remaining = existing.filter(id => !loadedIds.has(id));
          if (remaining.length !== existing.length) localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(remaining));
        } catch(_) {}
        setMasters(loaded);
        setEps(loadedEps);
        flash(`✓ ${loaded.length} song${loaded.length!==1?'s':''}${loadedEps.length?` and ${loadedEps.length} EP${loadedEps.length!==1?'s':''}`:''} imported`);
        e.target.value = '';
      } catch(err) { alert('Could not read file: '+err.message); }
    };
    reader.readAsText(file);
  }

  // ── Copyright Vault ──
  // Single-click flow: build manifest → zip → SHA-256 → attempt to POST hash
  // to the OpenTimestamps calendar. On success, download zip + .ots. On
  // failure (CORS / network), download zip and surface hash + manual link.
  async function handleCopyrightVault() {
    if (isDemo) { alert('Copyright Vault is disabled in demo mode.'); return; }
    if (!masters.length) { alert('No songs to stamp yet.'); return; }
    setVaultStatus('building'); setVaultMsg('Building manifest…'); setVaultManual(null);
    try {
      const manifest = buildVaultManifest(masters, personas);
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const zipBytes = buildSingleEntryZip('copyright-vault-manifest.json', manifestBytes);
      const baseName = vaultBaseFilename();
      const zipName = `${baseName}.zip`;

      setVaultStatus('hashing'); setVaultMsg('Computing SHA-256…');
      const digest = await sha256(zipBytes);
      const hashHex = bytesToHex(digest);

      // Always save the zip — that's the artifact the user keeps regardless of
      // whether the calendar call succeeds. Without it the .ots is meaningless.
      downloadBytes(zipBytes, zipName, 'application/zip');

      setVaultStatus('stamping'); setVaultMsg('Stamping hash to Bitcoin via OpenTimestamps…');
      try {
        const calendarResp = await postDigestToCalendar(digest);
        const ots = buildOtsFile(digest, calendarResp);
        downloadBytes(ots, `${zipName}.ots`, 'application/vnd.opentimestamps');
        const record = { stampedAt:new Date().toISOString(), songCount:manifest.songCount, hash:hashHex, mode:'auto' };
        localStorage.setItem(VAULT_STAMP_KEY, JSON.stringify(record));
        setVaultLastStamp(record);
        setVaultStatus('done');
        setVaultMsg(`✓ Stamped — saved zip and .ots proof for ${manifest.songCount} song${manifest.songCount!==1?'s':''}`);
      } catch (err) {
        // Calendar unreachable (very likely CORS in the browser). Hand the user
        // the hash and a link so they can finish via the opentimestamps.org webform.
        setVaultManual({ hashHex, zipName, songCount:manifest.songCount });
        const record = { stampedAt:new Date().toISOString(), songCount:manifest.songCount, hash:hashHex, mode:'manual-pending' };
        localStorage.setItem(VAULT_STAMP_KEY, JSON.stringify(record));
        setVaultLastStamp(record);
        setVaultStatus('manual');
        setVaultMsg('Zip saved. Finish stamping manually — see below.');
      }
    } catch (e) {
      setVaultStatus('error');
      setVaultMsg('⚠ ' + (e?.message || 'Vault failed'));
    }
  }

  // ── Persona management ──
  const savePersonas = (updated) => {
    setPersonas(updated);
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(updated));
  };
  const handleAddPersona = () => {
    if (!newPersonaForm.name.trim()) return;
    const baseId = newPersonaForm.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'persona';
    // Ensure uniqueness against existing persona IDs
    let id = baseId;
    let suffix = 2;
    const existingIds = new Set(personas.map(p => p.id));
    while (existingIds.has(id)) { id = `${baseId}-${suffix++}`; }
    const desc = newPersonaForm.desc.trim();
    const genre = (newPersonaForm.genre || '').trim() || desc.split(/[.,]/)[0].slice(0, 60);
    savePersonas([...personas, { id, name:newPersonaForm.name.trim(), color:newPersonaForm.color, desc, genre }]);
    setNewPersonaForm({ name:'', genre:'', desc:'', color:PERSONA_COLORS[Math.floor(Math.random()*PERSONA_COLORS.length)] });
  };
  const handleUpdatePersona = (id, field, value) => savePersonas(personas.map(p=>p.id===id?{...p,[field]:value}:p));
  const handleDeletePersona = (id) => {
    if (!window.confirm('Remove this persona? Songs assigned to it will show as Unassigned.')) return;
    savePersonas(personas.filter(p=>p.id!==id));
  };
  const handleSyncPersonaDescriptions = () => {
    if (!window.confirm('This will replace all persona descriptions with the latest built-in versions. Any custom edits you\'ve made to descriptions will be overwritten. Continue?')) return;
    const updated = personas.map(p => {
      const def = DEFAULT_PERSONAS.find(d => d.id === p.id);
      return def ? { ...p, desc: def.desc } : p;
    });
    savePersonas(updated);
    flash('✓ All persona descriptions updated from defaults');
  };
  const saveApiKey = (k) => { setApiKey(k); localStorage.setItem(APIKEY_KEY, k); };

  // ── Wizard ──
  async function handleWizardAnalyze() {
    if (!apiKey) { alert('Please enter your Anthropic API key in Settings first.'); return; }
    setWizardAnalyzing(true); setWizardStep('analyzing');
    try {
      const a = await analyzeWithAI(masterForm.title, versionForm.stylePrompt, masterForm.lyrics, apiKey, personas);
      setPendingAnalysis(a); setWizardStep('confirm');
    } catch(e) {
      setWizardAnalyzing(false);
      setWizardStep('manual');
      return;
    }
    setWizardAnalyzing(false);
  }
  function handleWizardConfirm(personaId) {
    const persona = personaId;
    const firstTake = { id:uid(), label:versionForm.label?versionForm.label+' — Take 1':'Take 1',
      stylePrompt:versionForm.stylePrompt, sunoUrl:versionForm.firstTakeUrl||'',
      sunoVersion:versionForm.firstTakeVersion||'', stage:versionForm.stage,
      releaseStatus:versionForm.releaseStatus, isPrimary:true, notes:'', sunoCreatedAt:versionForm.sunoCreatedAt||'',
      addedAt:new Date().toISOString() };
    const ai = pendingAnalysis || {};
    const newVersion = { id:uid(), label:versionForm.label||'Version 1', persona,
      genre:ai.genre||'', themes:ai.themes||[], mood:ai.mood||'',
      instrumentalMood:ai.instrumentalMood||'', targetAudience:ai.targetAudience||'',
      duration:ai.duration||'', versionSummary:ai.versionSummary||'',
      albumNote:ai.albumNote||'', addedAt:new Date().toISOString(), takes:[firstTake],
      releaseChecklist:{ listened:false, coverArt:false, audioDownloaded:false } };
    const newMaster = { id:uid(), title:masterForm.title.trim(), lyrics:masterForm.lyrics.trim(),
      notes:masterForm.notes.trim(), addedAt:new Date().toISOString(), versions:[newVersion] };
    save([...masters, newMaster]);
    setMasterForm({title:'',lyrics:'',notes:''}); setVersionForm({label:'',stylePrompt:'',firstTakeUrl:'',firstTakeVersion:'',stage:'idea',releaseStatus:'draft',sunoCreatedAt:''});
    setPendingAnalysis(null); setWizardStep('master'); setActiveTab('catalog');
    flash('✓ Song added');
  }

  // ── Add version ──
  async function handleAddVersionAnalyze(master) {
    if (!apiKey) { alert('Please enter your Anthropic API key in Settings first.'); return; }
    setAddVersionAnalyzing(true);
    try {
      const a = await analyzeWithAI(master.title, addVersionForm.stylePrompt, master.lyrics, apiKey, personas);
      setAddVersionAnalysis(a); setAddVersionConfirming(true);
    } catch(e) {
      setAddVersionAnalysis(null); setAddVersionConfirming(true);
    }
    setAddVersionAnalyzing(false);
  }
  function handleAddVersionConfirm(masterId, personaId) {
    const ai = addVersionAnalysis || {};
    const persona = personaId;
    const master = masters.find(m=>m.id===masterId);
    const vIdx = (master?.versions?.length||0)+1;
    const firstTake = { id:uid(), label:addVersionForm.label?addVersionForm.label+' — Take 1':'Take 1',
      stylePrompt:addVersionForm.stylePrompt, sunoUrl:addVersionForm.firstTakeUrl||'',
      sunoVersion:'', stage:addVersionForm.stage, releaseStatus:addVersionForm.releaseStatus,
      isPrimary:true, notes:'', addedAt:new Date().toISOString() };
    const newVersion = { id:uid(), label:addVersionForm.label||`Version ${vIdx}`, persona,
      genre:ai.genre||'', themes:ai.themes||[], mood:ai.mood||'',
      instrumentalMood:ai.instrumentalMood||'', targetAudience:ai.targetAudience||'',
      duration:ai.duration||'', versionSummary:ai.versionSummary||'',
      albumNote:ai.albumNote||'', addedAt:new Date().toISOString(), takes:[firstTake],
      releaseChecklist:{ listened:false, coverArt:false, audioDownloaded:false } };
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:[...m.versions,newVersion]}));
    setAddingVersionTo(null); setAddVersionForm({label:'',stylePrompt:'',firstTakeUrl:'',stage:'idea',releaseStatus:'draft'});
    setAddVersionAnalysis(null); setAddVersionConfirming(false);
    flash('✓ Version added');
  }

  // ── Batch Add ──
  async function handleBatchAnalyze() {
    const valid = batchSongs.filter(s => s.title.trim());
    if (!valid.length) return;
    if (!apiKey) { alert('Enter your Anthropic API key in Settings first.'); return; }
    setBatchStep('processing');
    setBatchProgress({ current:0, total:valid.length });
    const results = [];
    for (let i = 0; i < valid.length; i++) {
      setBatchProgress({ current:i+1, total:valid.length });
      const s = valid[i];
      try {
        const a = await analyzeWithAI(s.title, s.stylePrompt, s.lyrics, apiKey, personas);
        results.push({ ...s, analysis:a, error:null, chosenPersona:a.suggestedPersona });
      } catch(e) {
        results.push({ ...s, analysis:null, error:e.message, chosenPersona:'' });
      }
    }
    setBatchResults(results);
    setBatchStep('review');
  }

  function handleBatchPersonaChange(idx, personaId) {
    setBatchResults(prev => prev.map((r,i) => i===idx ? {...r, chosenPersona:personaId} : r));
  }

  function handleBatchSaveAll() {
    const toSave = batchResults.filter(r => r.analysis && r.chosenPersona);
    const newMasters = toSave.map(r => {
      const stg = r.sunoUrl ? 'generated' : (r.stylePrompt ? 'prompt' : (r.lyrics ? 'lyrics' : 'idea'));
      const firstTake = { id:uid(), label:'Take 1', stylePrompt:r.stylePrompt||'',
        sunoUrl:r.sunoUrl||'', sunoVersion:'', stage:stg, releaseStatus:'draft',
        isPrimary:true, notes:'', addedAt:new Date().toISOString() };
      const ver = { id:uid(), label:'Version 1', persona:r.chosenPersona,
        genre:r.analysis.genre, themes:r.analysis.themes, mood:r.analysis.mood,
        instrumentalMood:r.analysis.instrumentalMood, targetAudience:r.analysis.targetAudience,
        duration:r.analysis.duration, versionSummary:r.analysis.versionSummary,
        albumNote:r.analysis.albumNote, addedAt:new Date().toISOString(), takes:[firstTake],
        releaseChecklist:{ listened:false, coverArt:false, audioDownloaded:false } };
      return { id:uid(), title:r.title.trim(), lyrics:r.lyrics.trim(), notes:'',
        addedAt:new Date().toISOString(), versions:[ver] };
    });
    save([...masters, ...newMasters]);
    flash(`✓ ${newMasters.length} song${newMasters.length!==1?'s':''} added`);
    setBatchSongs([newBatchSong()]);
    setBatchStep('input');
    setBatchResults([]);
    setActiveTab('catalog');
  }

  function handleBatchReset() {
    setBatchSongs([newBatchSong()]);
    setBatchStep('input');
    setBatchResults([]);
  }

  // ── Add take ──
  function handleAddTake(masterId, versionId) {
    const version = masters.find(m=>m.id===masterId)?.versions?.find(v=>v.id===versionId);
    if (!version) return;
    const tIdx = (version.takes?.length||0)+1;
    const newTake = { id:uid(), label:takeForm.label||`Take ${tIdx}`,
      stylePrompt:takeForm.stylePrompt||version.takes?.[0]?.stylePrompt||'',
      sunoUrl:takeForm.sunoUrl, sunoVersion:takeForm.sunoVersion||'',
      stage:'generated', releaseStatus:'draft', isPrimary:false, notes:'', addedAt:new Date().toISOString() };
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,takes:[...v.takes,newTake]})}));
    setAddingTakeTo(null); setTakeForm({label:'',stylePrompt:'',sunoUrl:'',sunoVersion:''});
    flash('✓ Take added');
  }

  // ── Update ──
  function updateTake(masterId, versionId, takeId, fieldOrFields, value) {
    const updates = typeof fieldOrFields === 'object' ? fieldOrFields : { [fieldOrFields]: value };
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,takes:v.takes.map(t=>t.id!==takeId?t:{...t,...updates})})}));
  }
  function setPrimaryTake(masterId, versionId, takeId) {
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,takes:v.takes.map(t=>({...t,isPrimary:t.id===takeId}))})}));
  }
  function updateMaster(masterId, fields) {
    save(masters.map(m=>m.id!==masterId?m:{...m,...fields,updatedAt:new Date().toISOString()}));
    flash('✓ Song updated');
  }
  function updateVersion(masterId, versionId, fields) {
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,...fields})}));
    flash('✓ Version updated');
  }

  // ── Delete ──
  function deleteMaster(id) {
    if (!confirm('Delete this song and all its versions?')) return;
    // Record tombstone so Drive reconnect doesn't resurrect this song
    try {
      const existing = JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]');
      if (!existing.includes(id)) {
        existing.push(id);
        localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(existing));
      }
    } catch(_) {}
    save(masters.filter(m=>m.id!==id));
    setExpandedMaster(null);
  }
  function deleteVersion(masterId, versionId) {
    if(!confirm('Delete this version?')) return;
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.filter(v=>v.id!==versionId)}));
  }
  function deleteTake(masterId, versionId, takeId) {
    if(!confirm('Delete this take?')) return;
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,takes:v.takes.filter(t=>t.id!==takeId)})}));
  }

  // ── EPs ──
  function createEp(ep)              { setEps(prev => [...prev, ep]); flash('✓ EP created'); }
  function updateEp(epId, fields)    { setEps(prev => prev.map(e => e.id===epId ? { ...e, ...fields } : e)); flash('✓ EP updated'); }
  function deleteEp(epId)            { setEps(prev => prev.filter(e => e.id !== epId)); flash('✓ EP deleted'); }

  // ── Computed ──
  const allVersions = useMemo(() => masters.flatMap(m=>m.versions||[]), [masters]);
  const allTakes    = useMemo(() => allVersions.flatMap(v=>v.takes||[]), [allVersions]);

  const dash = useMemo(() => {
    // ISRC completeness — denominator is submitted/live versions; numerator is
    // those whose primary take has its single-release ISRC captured.
    const isrcEligible = allVersions.filter(versionIsSubmittedOrLive);
    const isrcCaptured = isrcEligible.filter(v => !!primaryTakeIsrc(v));
    const isrcMissing  = isrcEligible.length - isrcCaptured.length;

    // Pitch summary — totals + this month + per-type breakdown
    const allPitches = allVersions.flatMap(v => (v.pitches||[]).map(p=>({...p, _v:v})));
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const inMonth = p => (p.submittedDate||'').startsWith(monthKey);
    const byPlatform = PITCH_PLATFORMS.map(pl => {
      const ps = allPitches.filter(p=>p.platform===pl.id);
      const decided = ps.filter(p=>p.result!=='pending');
      const positive = ps.filter(p=>p.result==='accepted'||p.result==='booked');
      return { ...pl, total:ps.length, pending:ps.filter(p=>p.result==='pending').length,
               accepted: positive.length,
               acceptanceRate: decided.length ? Math.round(100*positive.length/decided.length) : null };
    });
    const submithubCreditsTotal = allPitches.filter(p=>p.platform==='submithub').reduce((a,p)=>a+(Number(p.credits)||0),0);
    const submithubCreditsMonth = allPitches.filter(p=>p.platform==='submithub'&&inMonth(p)).reduce((a,p)=>a+(Number(p.credits)||0),0);

    return ({
      total: masters.length, totalVersions: allVersions.length,
      byStage: STAGES.map(s=>({...s, count: allTakes.filter(t=>(t.stage||'idea')===s.id).length})),
      byStatus: RELEASE_STATUSES.map(r=>({...r, count:allTakes.filter(t=>(t.releaseStatus||'draft')===r.id).length})),
      byPersona: personas.map(p=>({...p, count:allVersions.filter(v=>v.persona===p.id).length})),
      topThemes: Object.entries(masters.reduce((a,m)=>{ [...new Set((m.versions||[]).flatMap(v=>v.themes||[]))].forEach(t=>{a[t]=(a[t]||0)+1;}); return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,10),
      topAudiences: Object.entries(allVersions.reduce((a,v)=>{ if(v.targetAudience) a[v.targetAudience]=(a[v.targetAudience]||0)+1; return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,5),
      dkSubmitted: allVersions.filter(v=>v.distrokid?.submittedDate?.trim()).length,
      dkLive: allVersions.filter(v=>v.distrokid?.spotifyUrl?.trim()).length,
      checklistReady: allVersions.filter(v=>{
        const master=masters.find(m=>(m.versions||[]).some(vv=>vv.id===v.id));
        return checklistStatus(v, master?.lyrics).allDone;
      }).length,
      isrcEligible: isrcEligible.length,
      isrcCaptured: isrcCaptured.length,
      isrcMissing,
      pitches: { all: allPitches.length, byPlatform, submithubCreditsTotal, submithubCreditsMonth, monthKey },
    });
  }, [masters, allVersions, allTakes, personas]);
  const filtered = useMemo(() => {
    const qRaw  = searchQ.trim();
    const q     = qRaw.toLowerCase();
    const isIsrc = isIsrcQuery(qRaw);
    const qIsrc  = normalizeIsrc(qRaw);
    // Map of master IDs touched by an ISRC search hit (single-take OR EP-track).
    // A non-ISRC search ignores this map and uses the text search below.
    const isrcHitMasterIds = new Set();
    if (isIsrc) {
      masters.forEach(m => (m.versions||[]).forEach(v => (v.takes||[]).forEach(t => {
        if (normalizeIsrc(t.isrc).includes(qIsrc)) isrcHitMasterIds.add(m.id);
      })));
      (eps||[]).forEach(ep => (ep.tracks||[]).forEach(tr => {
        if (normalizeIsrc(tr.isrc).includes(qIsrc) && tr.masterId) isrcHitMasterIds.add(tr.masterId);
      }));
    }
    return masters.filter(m => {
      const textMatch = !q || m.title?.toLowerCase().includes(q) || m.notes?.toLowerCase().includes(q) ||
        m.lyrics?.toLowerCase().includes(q) ||
        (m.versions||[]).some(v=>v.genre?.toLowerCase().includes(q)||(v.themes||[]).some(t=>t.toLowerCase().includes(q))||v.versionSummary?.toLowerCase().includes(q)
                                  || (v.pitches||[]).some(p=>(p.contact||'').toLowerCase().includes(q)));
      const mQ = !q || textMatch || (isIsrc && isrcHitMasterIds.has(m.id));
      const mP = filterPersona==='all' || (filterPersona==='__unassigned__'
        ? (m.versions||[]).some(v=>!v.persona||!personas.find(p=>p.id===v.persona))
        : (m.versions||[]).some(v=>v.persona===filterPersona));
      const mS = filterStatus==='all'  || (m.versions||[]).some(v=>(v.takes||[]).some(t=>t.releaseStatus===filterStatus));
      const mSt= filterStage==='all'   || (m.versions||[]).some(v=>(v.takes||[]).some(t=>t.stage===filterStage));
      // EP filter: 'all' / __none__ / specific epId
      const mEp = filterEp === 'all' ? true
        : filterEp === '__none__'
          ? !(eps||[]).some(ep => (ep.tracks||[]).some(tr => tr.masterId === m.id))
          : (eps.find(ep=>ep.id===filterEp)?.tracks||[]).some(tr => tr.masterId === m.id);
      // ISRC filter: 'all' / 'has' (any version has single-release ISRC) / 'missing' (any submitted/live version w/o ISRC)
      const mIsrc = filterIsrc === 'all' ? true
        : filterIsrc === 'has'
          ? (m.versions||[]).some(v => !!primaryTakeIsrc(v))
          : (m.versions||[]).some(versionNeedsIsrc);
      // Release-state filter — mutually exclusive states across all versions of the master
      const mRel = (() => {
        if (filterRelease === 'all') return true;
        const today = new Date(); today.setHours(0,0,0,0);
        const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
        const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        return (m.versions||[]).some(v => {
          const dk = v.distrokid || {};
          switch (filterRelease) {
            case 'spotify':     return !!(dk.spotifyUrl?.trim());
            case 'submitted':   return !!(dk.submittedDate?.trim());
            case 'hyperfollow': return !!(dk.hyperFollowUrl?.trim());
            case 'thisMonth': {
              const d = (dk.releaseDate||'').slice(0,7);
              return d === monthKey;
            }
            case 'next30': {
              const r = (dk.releaseDate||'').trim();
              if (!r) return false;
              const rd = new Date(r + 'T00:00:00');
              return rd >= today && rd <= in30;
            }
            default: return true;
          }
        });
      })();
      return mQ && mP && mS && mSt && mEp && mIsrc && mRel;
    });
  }, [masters, eps, personas, searchQ, filterPersona, filterStatus, filterStage, filterEp, filterIsrc, filterRelease]);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#080808' }}>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#111', border:'1px solid #222', borderRadius:8, width:'100%', maxWidth:520, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

            <div style={{ padding:'20px 24px 0', borderBottom:'1px solid #1e1e1e' }}>
              <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:14 }}>Settings</div>
              <div style={{ display:'flex' }}>
                {[['general','⚙ General'],['personas','🎭 Personas'],['batch','⚡ Batch Add'],['exports','📤 Exports']].map(([tab,label])=>(
                  <button key={tab} onClick={()=>setSettingsTab(tab)}
                    style={{ background:'transparent', border:'none', borderBottom:`2px solid ${settingsTab===tab?'#C8942A':'transparent'}`,
                             color:settingsTab===tab?'#C8942A':'#555', padding:'8px 18px', fontSize:12, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>

              {settingsTab==='general' && (
                <>
                  {vaultLastStamp && (masters.length - (vaultLastStamp.songCount || 0)) >= 10 && (
                    <div style={{ background:'#1a0f08', border:'1px solid #7a3a1a', borderRadius:4, padding:'10px 12px', marginBottom:18, fontSize:11, lineHeight:1.6 }}>
                      <div style={{ color:'#F2A65A', fontWeight:600, marginBottom:4 }}>
                        ⚠ Copyright Vault is out of date
                      </div>
                      <div style={{ color:'#bbb' }}>
                        You've added {masters.length - (vaultLastStamp.songCount || 0)} new songs since your last blockchain stamp. Scroll down to <strong style={{ color:'#7CE6A8' }}>Copyright Vault</strong> to re-stamp.
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom:20 }}>
                    <label style={lBase}>Anthropic API Key</label>
                    <input type="password" value={apiKey} onChange={e=>saveApiKey(e.target.value)} placeholder="sk-ant-…" style={iBase} />
                    <div style={{ fontSize:11, color:'#999', marginTop:6, lineHeight:1.6 }}>Required for AI persona analysis. Get yours at console.anthropic.com.</div>
                  </div>

                  <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid #1a1a1a' }}>
                    <label style={lBase}>Google Drive Sync</label>
                    {driveConnected ? (
                      <div>
                        <div style={{ fontSize:12, color:'#34D399', marginBottom:10 }}>● Connected</div>
                        <button onClick={handleDriveSave} disabled={driveSyncing}
                          style={{ width:'100%', background:'#0a1f0a', border:'1px solid #1a4a1a', borderRadius:4, color:'#34D399', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                          {driveSyncing?'⟳ Syncing…':'☁ Save to Drive Now'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={()=>{ setShowSettings(false); startOAuth(); }}
                        style={{ width:'100%', background:'#0d0d1a', border:'1px solid #1e2a3a', borderRadius:4, color:'#5B8DD9', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                        🔗 Connect Google Drive
                      </button>
                    )}
                    {driveMsg && <div style={{ fontSize:11, color:'#C8942A', marginTop:8 }}>{driveMsg}</div>}
                  </div>

                  <div>
                    <label style={lBase}>Local Backup</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      <button onClick={handleExport} style={{ background:'#141414', border:'1px solid #252525', borderRadius:4, color:'#C8942A', padding:'10px 0', fontSize:12, cursor:'pointer' }}>⬇ Save Backup</button>
                      <button onClick={()=>importRef.current.click()} style={{ background:'#141414', border:'1px solid #252525', borderRadius:4, color:'#5B8DD9', padding:'10px 0', fontSize:12, cursor:'pointer' }}>⬆ Load Backup</button>
                    </div>
                    <button onClick={handleFixImportData}
                      style={{ width:'100%', background:'#141414', border:'1px solid #2a3a1a', borderRadius:4, color:'#34D399', padding:'10px 0', fontSize:12, cursor:'pointer', marginBottom:6 }}>
                      🔧 Fix Imported Data (set missing stages to Idea)
                    </button>
                    <button onClick={handleRecalculateStages}
                      style={{ width:'100%', background:'#141414', border:'1px solid #1a2a3a', borderRadius:4, color:'#5B8DD9', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                      🔄 Recalculate All Stages From Data
                    </button>
                    <div style={{ fontSize:11, color:'#999', marginTop:6, lineHeight:1.6 }}>
                      Recalculate sets stages based on what each song actually has: Suno URL → Generated, Style Prompt → Prompt Ready, Lyrics → Lyrics Written. Reviewing and Final are kept.
                    </div>
                    <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display:'none' }} />
                  </div>

                  <div style={{ borderTop:'1px solid #1a1a1a', paddingTop:16 }}>
                    <label style={lBase}>AI Persona Reassessment</label>
                    <div style={{ fontSize:11, color:'#999', marginBottom:10, lineHeight:1.6 }}>
                      Re-runs every song through the AI to reassess persona assignments using the latest logic — including suggestions for new personas that don't yet exist. Uses one API call per version.
                    </div>
                    {reassessing ? (
                      <div style={{ background:'#0f0f0f', border:'1px solid #222', borderRadius:4, padding:'12px 14px' }}>
                        <div style={{ fontSize:12, color:'#C8942A', marginBottom:6 }}>✨ Reassessing… {reassessProgress.current} / {reassessProgress.total}</div>
                        <div style={{ background:'#1a1a1a', borderRadius:3, height:4, marginBottom:8 }}>
                          <div style={{ background:'#C8942A', borderRadius:3, height:4, width:`${Math.round(reassessProgress.current/Math.max(reassessProgress.total,1)*100)}%`, transition:'width 0.3s' }} />
                        </div>
                        {reassessProgress.newPersonas.length > 0 && (
                          <div style={{ fontSize:11, color:'#34D399' }}>💡 {reassessProgress.newPersonas.length} new persona{reassessProgress.newPersonas.length!==1?'s':''} suggested so far</div>
                        )}
                      </div>
                    ) : reassessResults ? (
                      <div style={{ background:'#0a0f0a', border:'1px solid #1a3a1a', borderRadius:4, padding:'14px 16px' }}>
                        <div style={{ fontSize:12, color:'#34D399', fontWeight:600, marginBottom:10 }}>✓ Reassessment Complete</div>
                        <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>• {reassessResults.total} versions analyzed</div>
                        <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>• {reassessResults.reassigned} persona assignment{reassessResults.reassigned!==1?'s':''} updated</div>
                        <button onClick={()=>setReassessResults(null)}
                          style={{ width:'100%', background:'transparent', border:'1px solid #222', borderRadius:3, color:'#555', padding:'7px 0', fontSize:10, cursor:'pointer', marginBottom:6 }}>
                          Dismiss
                        </button>
                        <button onClick={handleBulkReassess}
                          style={{ width:'100%', background:'#141414', border:'1px solid #C8942A55', borderRadius:4, color:'#C8942A', padding:'8px 0', fontSize:11, cursor:'pointer' }}>
                          ✨ Run Again
                        </button>
                      </div>
                    ) : (
                      <button onClick={handleBulkReassess}
                        style={{ width:'100%', background:'#141414', border:'1px solid #C8942A55', borderRadius:4, color:'#C8942A', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                        ✨ Reassess All Personas with AI
                      </button>
                    )}
                  </div>

                  <div style={{ borderTop:'1px solid #1a1a1a', paddingTop:16 }}>
                    <label style={lBase}>AI Metadata Enrichment</label>
                    <div style={{ fontSize:11, color:'#999', marginBottom:10, lineHeight:1.6 }}>
                      Scans every song version for blank fields — mood, themes, target audience, duration, summary, album note — and uses AI to fill them in. <strong style={{ color:'#ccc' }}>Only fills empty fields. Never overwrites data you already have.</strong>
                    </div>
                    {(() => {
                      const toEnrich = masters.reduce((a,m)=>a+(m.versions||[]).filter(v=>needsEnrichment(v)).length,0);
                      if (enriching) return (
                        <div style={{ background:'#0f0f0f', border:'1px solid #222', borderRadius:4, padding:'12px 14px' }}>
                          <div style={{ fontSize:12, color:'#5B8DD9', marginBottom:6 }}>🔍 Enriching… {enrichProgress.current} / {enrichProgress.total}</div>
                          <div style={{ background:'#1a1a1a', borderRadius:3, height:4 }}>
                            <div style={{ background:'#5B8DD9', borderRadius:3, height:4, width:`${Math.round(enrichProgress.current/Math.max(enrichProgress.total,1)*100)}%`, transition:'width 0.3s' }} />
                          </div>
                        </div>
                      );
                      if (enrichResults) return (
                        <div style={{ background:'#0a0f1a', border:'1px solid #1a2a4a', borderRadius:4, padding:'14px 16px' }}>
                          <div style={{ fontSize:12, color:'#5B8DD9', fontWeight:600, marginBottom:10 }}>✓ Enrichment Complete</div>
                          <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>• {enrichResults.total} version{enrichResults.total!==1?'s':''} processed</div>
                          <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>• {enrichResults.fieldsAdded} blank field{enrichResults.fieldsAdded!==1?'s':''} filled in</div>
                          <button onClick={()=>setEnrichResults(null)}
                            style={{ width:'100%', background:'transparent', border:'1px solid #222', borderRadius:3, color:'#555', padding:'7px 0', fontSize:10, cursor:'pointer', marginBottom:6 }}>
                            Dismiss
                          </button>
                          {toEnrich>0 && <button onClick={handleBulkEnrich}
                            style={{ width:'100%', background:'#141414', border:'1px solid #5B8DD955', borderRadius:4, color:'#5B8DD9', padding:'8px 0', fontSize:11, cursor:'pointer' }}>
                            🔍 Run Again ({toEnrich} remaining)
                          </button>}
                        </div>
                      );
                      return (
                        <button onClick={handleBulkEnrich}
                          style={{ width:'100%', background:'#141414', border:'1px solid #5B8DD955', borderRadius:4, color:'#5B8DD9', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                          🔍 Fill In Missing Metadata with AI{toEnrich>0?` (${toEnrich} version${toEnrich!==1?'s':''} incomplete)`:''}
                        </button>
                      );
                    })()}
                  </div>

                  <div style={{ borderTop:'1px solid #1a1a1a', paddingTop:16 }}>
                    <label style={lBase}>Theme Normalization</label>
                    <div style={{ fontSize:11, color:'#999', marginBottom:10, lineHeight:1.6 }}>
                      Re-analyzes themes for every song using a standard 20-theme list — replaces any free-form or inconsistent tags with consistent ones. Runs one AI call per version.
                    </div>
                    {normalizing ? (
                      <div style={{ background:'#0f0f0f', border:'1px solid #222', borderRadius:4, padding:'12px 14px' }}>
                        <div style={{ fontSize:12, color:'#A855F7', marginBottom:6 }}>🏷 Normalizing… {normalizeProgress.current} / {normalizeProgress.total}</div>
                        <div style={{ background:'#1a1a1a', borderRadius:3, height:4 }}>
                          <div style={{ background:'#A855F7', borderRadius:3, height:4, width:`${Math.round(normalizeProgress.current/Math.max(normalizeProgress.total,1)*100)}%`, transition:'width 0.3s' }} />
                        </div>
                      </div>
                    ) : normalizeResults ? (
                      <div style={{ background:'#0f0a1a', border:'1px solid #2a1a4a', borderRadius:4, padding:'14px 16px' }}>
                        <div style={{ fontSize:12, color:'#A855F7', fontWeight:600, marginBottom:10 }}>✓ Normalization Complete</div>
                        <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>• {normalizeResults.total} versions re-tagged with standard themes</div>
                        <button onClick={()=>setNormalizeResults(null)}
                          style={{ width:'100%', background:'transparent', border:'1px solid #222', borderRadius:3, color:'#555', padding:'7px 0', fontSize:10, cursor:'pointer' }}>
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <button onClick={handleNormalizeThemes}
                        style={{ width:'100%', background:'#141414', border:'1px solid #A855F755', borderRadius:4, color:'#A855F7', padding:'10px 0', fontSize:12, cursor:'pointer' }}>
                        🏷 Normalize All Themes to Standard List
                      </button>
                    )}
                  </div>

                  {/* COPYRIGHT VAULT */}
                  <div style={{ borderTop:'1px solid #1a1a1a', paddingTop:16 }}>
                    <label style={lBase}>Copyright Vault</label>
                    <div style={{ fontSize:11, color:'#999', marginBottom:10, lineHeight:1.6 }}>
                      Builds a manifest of every song (title, persona, Suno URLs) declaring you as the songwriter, zips it, and timestamps the hash to the Bitcoin blockchain via OpenTimestamps. One click does the whole legal-paper-trail step that used to be manual.
                    </div>

                    {vaultLastStamp && (() => {
                      const grewBy = masters.length - (vaultLastStamp.songCount || 0);
                      const stampedDate = (() => {
                        try { return new Date(vaultLastStamp.stampedAt).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); }
                        catch(_) { return vaultLastStamp.stampedAt; }
                      })();
                      const needsRestamp = grewBy >= 10;
                      return (
                        <div style={{
                          background: needsRestamp ? '#1a0f08' : '#0a140a',
                          border: `1px solid ${needsRestamp ? '#7a3a1a' : '#1a3a1a'}`,
                          borderRadius:4, padding:'10px 12px', marginBottom:10, fontSize:11, lineHeight:1.6
                        }}>
                          {needsRestamp ? (
                            <>
                              <div style={{ color:'#F2A65A', fontWeight:600, marginBottom:4 }}>⚠ {grewBy} new songs since your last stamp</div>
                              <div style={{ color:'#aaa' }}>Last stamped <strong style={{ color:'#ddd' }}>{stampedDate}</strong> with {vaultLastStamp.songCount} song{vaultLastStamp.songCount!==1?'s':''}. Re-stamp to extend your proof of authorship to the newer songs.</div>
                            </>
                          ) : (
                            <div style={{ color:'#7CB87C' }}>● Last stamped {stampedDate} — {vaultLastStamp.songCount} song{vaultLastStamp.songCount!==1?'s':''}{vaultLastStamp.mode==='manual-pending'?' (manual stamping not yet confirmed)':''}</div>
                          )}
                        </div>
                      );
                    })()}

                    {vaultStatus==='idle' || vaultStatus==='done' || vaultStatus==='manual' || vaultStatus==='error' ? (
                      <button onClick={handleCopyrightVault}
                        style={{ width:'100%', background:'#0f3320', border:'1px solid #1f6a40', borderRadius:4, color:'#7CE6A8', padding:'10px 0', fontSize:12, cursor:'pointer', letterSpacing:'0.06em', fontWeight:600 }}>
                        🛡 Stamp Catalog to Blockchain
                      </button>
                    ) : (
                      <div style={{ background:'#0f1a12', border:'1px solid #1f6a40', borderRadius:4, padding:'10px 14px', fontSize:12, color:'#7CE6A8' }}>
                        ⟳ {vaultMsg}
                      </div>
                    )}

                    {vaultStatus==='done' && (
                      <>
                        <div style={{ fontSize:11, color:'#7CB87C', marginTop:8, lineHeight:1.6 }}>{vaultMsg}</div>
                        <div style={{ background:'#0a140a', border:'1px solid #1a3a1a', borderRadius:4, padding:'10px 12px', marginTop:10, fontSize:11, lineHeight:1.6, color:'#bbb' }}>
                          <strong style={{ color:'#7CE6A8' }}>To verify the stamp:</strong> open the verify page below and drag the <code style={{ color:'#C8942A' }}>.ots</code> file you just saved onto it. It will show <strong style={{ color:'#F2A65A' }}>Pending</strong> for the first 1–3 hours while OpenTimestamps batches digests into a Bitcoin transaction. After that, it upgrades to a permanent block attestation.
                        </div>
                        <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer"
                           style={{ display:'block', textAlign:'center', background:'#141414', border:'1px solid #2a2a2a', borderRadius:4, color:'#5B8DD9', padding:'8px 0', fontSize:11, textDecoration:'none', marginTop:6 }}>
                          🔎 Open opentimestamps.org to verify
                        </a>
                      </>
                    )}
                    {vaultStatus==='error' && (
                      <div style={{ fontSize:11, color:'#F2A65A', marginTop:8, lineHeight:1.6 }}>{vaultMsg}</div>
                    )}

                    {vaultStatus==='manual' && vaultManual && (
                      <div style={{ background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:4, padding:'12px 14px', marginTop:10 }}>
                        <div style={{ fontSize:11, color:'#F2A65A', marginBottom:8, lineHeight:1.6 }}>
                          The OpenTimestamps server couldn't be reached from the browser (this is normal — their API blocks browser requests). Finish in two steps:
                        </div>
                        <ol style={{ fontSize:11, color:'#ccc', marginBottom:10, paddingLeft:18, lineHeight:1.7 }}>
                          <li>The zip file <strong style={{ color:'#7CE6A8' }}>{vaultManual.zipName}</strong> just downloaded — keep it.</li>
                          <li>Open <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" style={{ color:'#5B8DD9' }}>opentimestamps.org</a>, upload that zip, and save the <code style={{ color:'#C8942A' }}>.ots</code> file it gives you alongside the zip.</li>
                        </ol>
                        <div style={{ fontSize:10, color:'#888', marginBottom:4, letterSpacing:'0.1em', textTransform:'uppercase' }}>SHA-256 (for verification)</div>
                        <input
                          readOnly
                          onClick={e => e.target.select()}
                          value={vaultManual.hashHex}
                          style={{ ...iBase, fontFamily:'monospace', fontSize:11, color:'#7CE6A8' }}
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(vaultManual.hashHex); flash('✓ Hash copied'); }}
                          style={{ width:'100%', background:'#141414', border:'1px solid #2a2a2a', borderRadius:4, color:'#5B8DD9', padding:'8px 0', fontSize:11, cursor:'pointer', marginTop:6 }}>
                          📋 Copy Hash
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {settingsTab==='batch' && (
                <BatchAdd
                  personas={personas}
                  batchSongs={batchSongs} setBatchSongs={setBatchSongs}
                  batchStep={batchStep}
                  batchProgress={batchProgress}
                  batchResults={batchResults}
                  onAnalyzeAll={handleBatchAnalyze}
                  onPersonaChange={handleBatchPersonaChange}
                  onSaveAll={handleBatchSaveAll}
                  onReset={handleBatchReset}
                  newBatchSong={newBatchSong}
                />
              )}

              {settingsTab==='personas' && (
                <>
                  <div style={{ fontSize:11, color:'#bbb', fontStyle:'italic', lineHeight:1.6, marginBottom:12 }}>
                    Add, rename, recolor, or remove personas. The AI uses your current list when analyzing songs.
                  </div>
                  <button onClick={handleSyncPersonaDescriptions}
                    style={{ width:'100%', background:'#0f1a0f', border:'1px solid #2a4a2a', borderRadius:4, color:'#34D399', padding:'9px 0', fontSize:11, cursor:'pointer', letterSpacing:'0.08em', marginBottom:16 }}>
                    ↺ Sync All Descriptions from Built-in Defaults
                  </button>
                  <div style={{ display:'grid', gap:6, marginBottom:20 }}>
                    {personas.map(p=>(
                      <div key={p.id} style={{ background:'#0f0f0f', border:`1px solid ${p.color}33`, borderLeft:`3px solid ${p.color}`, borderRadius:4, padding:'10px 14px' }}>
                        {editingPersona===p.id ? (
                          <div style={{ display:'grid', gap:8 }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                              <input value={p.name} onChange={e=>handleUpdatePersona(p.id,'name',e.target.value)}
                                style={{ background:'#111', border:'1px solid #252525', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:13, outline:'none' }} />
                              <input type="color" value={p.color} onChange={e=>handleUpdatePersona(p.id,'color',e.target.value)}
                                style={{ width:44, height:36, border:'1px solid #333', borderRadius:4, background:'#111', cursor:'pointer', padding:2 }} />
                            </div>
                            <textarea value={p.desc} onChange={e=>handleUpdatePersona(p.id,'desc',e.target.value)}
                              placeholder="Style description (used by AI for routing)…"
                              rows={4}
                              style={{ background:'#111', border:'1px solid #252525', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:12, outline:'none', width:'100%', resize:'vertical', lineHeight:1.6 }} />
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                              <div>
                                <label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Cover Art Status</label>
                                <select value={p.coverArtStatus||'needed'} onChange={e=>handleUpdatePersona(p.id,'coverArtStatus',e.target.value)}
                                  style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:3, color:'#aaa', padding:'7px 10px', fontSize:12, outline:'none', width:'100%' }}>
                                  <option value="needed">❌ Needed</option>
                                  <option value="inprogress">🔧 In Progress</option>
                                  <option value="done">✅ Done</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Cover Art File / Note</label>
                                <input value={p.coverArtFile||''} onChange={e=>handleUpdatePersona(p.id,'coverArtFile',e.target.value)}
                                  placeholder="e.g. CrimsonGold_v4.png"
                                  style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:11, outline:'none', width:'100%' }} />
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>setEditingPersona(null)} style={{ background:'#C8942A', border:'none', borderRadius:3, color:'#fff', padding:'5px 16px', fontSize:11, cursor:'pointer' }}>Done</button>
                              <button onClick={()=>handleDeletePersona(p.id)} style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#7a2020', padding:'5px 12px', fontSize:11, cursor:'pointer', marginLeft:'auto' }}>Remove</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                                <div style={{ fontSize:13, color:p.color }}>{p.name}</div>
                                <span style={{ fontSize:10, color: p.coverArtStatus==='done'?'#34D399':p.coverArtStatus==='inprogress'?'#C8942A':'#555' }}>
                                  {p.coverArtStatus==='done'?'🖼 Cover ✓':p.coverArtStatus==='inprogress'?'🖼 In progress':'🖼 No cover'}
                                </span>
                              </div>
                              <div style={{ fontSize:11, color:'#bbb', fontStyle:'italic' }}>{p.desc||'No description'}</div>
                            </div>
                            <button onClick={()=>setEditingPersona(p.id)} style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'4px 12px', fontSize:10, cursor:'pointer' }}>Edit</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:16 }}>
                    <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:12 }}>Add New Persona</div>
                    <div style={{ display:'grid', gap:8 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                        <input value={newPersonaForm.name} onChange={e=>setNewPersonaForm(p=>({...p,name:e.target.value}))}
                          placeholder="Persona name (e.g. Midnight Fire)"
                          style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'9px 12px', fontSize:13, outline:'none' }} />
                        <input type="color" value={newPersonaForm.color} onChange={e=>setNewPersonaForm(p=>({...p,color:e.target.value}))}
                          style={{ width:44, height:40, border:'1px solid #333', borderRadius:4, background:'#111', cursor:'pointer', padding:2 }} />
                      </div>
                      <input value={newPersonaForm.genre} onChange={e=>setNewPersonaForm(p=>({...p,genre:e.target.value}))}
                        placeholder="Genre (e.g. Soul / R&B). Leave blank to auto-derive from description."
                        style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'9px 12px', fontSize:12, outline:'none', width:'100%' }} />
                      <textarea value={newPersonaForm.desc} onChange={e=>setNewPersonaForm(p=>({...p,desc:e.target.value}))}
                        placeholder="Style description — used by AI for routing"
                        rows={3}
                        style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'9px 12px', fontSize:12, outline:'none', width:'100%', resize:'vertical', lineHeight:1.6, fontFamily:'inherit' }} />
                      <button onClick={handleAddPersona} disabled={!newPersonaForm.name.trim()}
                        style={{ background:newPersonaForm.name.trim()?'linear-gradient(135deg,#C8942A,#9a7018)':'#141414', border:'none', borderRadius:4,
                                 color:newPersonaForm.name.trim()?'#fff':'#777', padding:'10px 0', fontSize:12, letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer' }}>
                        ＋ Add Persona
                      </button>
                    </div>
                  </div>
                </>
              )}

              {settingsTab==='exports' && (() => {
                const eCard = { background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:6, padding:'16px', marginBottom:14 };
                const eTitle = { fontSize:13, color:'#e8dcc8', marginBottom:6, fontWeight:'bold' };
                const eDesc = { fontSize:11, color:'#999', lineHeight:1.7, marginBottom:12 };
                const eBtns = { display:'flex', gap:8 };
                const ePDF = { background:'#141414', border:'1px solid #C8942A', borderRadius:4, color:'#C8942A', padding:'8px 16px', fontSize:11, cursor:'pointer', letterSpacing:'0.08em' };
                const eCSV = { background:'#141414', border:'1px solid #34D399', borderRadius:4, color:'#34D399', padding:'8px 16px', fontSize:11, cursor:'pointer', letterSpacing:'0.08em' };
                return (
                  <>
                    <div style={{ fontSize:11, color:'#bbb', lineHeight:1.7, marginBottom:18 }}>
                      Generate audience-specific catalogs for industry contacts. Each export is tailored to what that recipient needs to see — sorted and filtered for their context.
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>🎬 Music Supervisor</div>
                      <div style={eDesc}>
                        For sync licensing and TV/film/ad placement. Shows only songs marked <em>Ready</em> or <em>Released</em>, sorted by mood then genre. Includes BPM, key, duration, instrumental mood, and sync availability status — everything a supervisor needs to quickly evaluate placement potential.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportSupervisorPDF(masters,personas))} style={ePDF}>📄 PDF</button>
                        <button onClick={()=>flash(exportSupervisorCSV(masters,personas))} style={eCSV}>📊 CSV</button>
                      </div>
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>🏷 Label / A&R</div>
                      <div style={eDesc}>
                        For label executives and A&R representatives evaluating catalog depth and artist identity. All songs grouped by artist persona and sorted alphabetically within each group. Shows genre, mood, themes, release status, and catalog descriptions to demonstrate breadth and creative consistency.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportLabelPDF(masters,personas))} style={ePDF}>📄 PDF</button>
                        <button onClick={()=>flash(exportLabelCSV(masters,personas))} style={eCSV}>📊 CSV</button>
                      </div>
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>📝 Publisher</div>
                      <div style={eDesc}>
                        For music publishers evaluating your catalog for licensing, royalties, and rights management. All songs listed alphabetically with PRO registration status and ISRC codes where available. Add these values to each song version via <em>Edit Version Details</em>.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportPublisherPDF(masters,personas))} style={ePDF}>📄 PDF</button>
                        <button onClick={()=>flash(exportPublisherCSV(masters,personas))} style={eCSV}>📊 CSV</button>
                      </div>
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>🎵 Playlist Curator</div>
                      <div style={eDesc}>
                        For streaming platform editorial teams and playlist curators. Contains only <em>Released</em> songs, organized by target audience then mood. Emphasizes discoverability metadata — genre, mood, audience fit, and runtime — to help curators find the right placement for each track.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportCuratorPDF(masters,personas))} style={ePDF}>📄 PDF</button>
                        <button onClick={()=>flash(exportCuratorCSV(masters,personas))} style={eCSV}>📊 CSV</button>
                      </div>
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>🎤 Lyrics Bulk Upload (Musixmatch / Genius)</div>
                      <div style={eDesc}>
                        For claiming lyric ownership on Musixmatch Pro and Genius before songs go live on streaming. One row per persona-recording with full lyrics, CSV-RFC quoted, UTF-8 with BOM. Songwriter column credits <strong>Vito DeLuca</strong> on every row to create a writer-level common thread across all personas. Smart quotes sanitized to ASCII for older bulk uploaders.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportLyricsCSV(masters,personas))} style={eCSV}>📊 CSV</button>
                      </div>
                    </div>

                    <div style={eCard}>
                      <div style={eTitle}>📀 EP Tracklists</div>
                      <div style={eDesc}>
                        One page per EP — name, persona, release date, UPC, status, links, and the ordered tracklist with the <strong>EP-specific ISRC</strong> for each track (different from each song's single-release ISRC). Useful as a reference when submitting to DistroKid and registering tracks with your PRO.
                      </div>
                      <div style={eBtns}>
                        <button onClick={()=>flash(exportEpTracklistPDF(eps, masters, personas))} style={ePDF}>📄 PDF</button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ padding:'16px 24px', borderTop:'1px solid #1e1e1e' }}>
              <button onClick={()=>{ setShowSettings(false); setEditingPersona(null); setSettingsTab('general'); }}
                style={{ width:'100%', background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:4, color:'#fff', padding:'11px 0', fontSize:12, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background:'linear-gradient(180deg,#131313,#0a0a0a)', borderBottom:'1px solid #1e1e1e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:'0.35em', color:'#C8942A', textTransform:'uppercase', marginBottom:3 }}>The Message Records</div>
          <div style={{ fontSize:22, color:'#f5ead8', letterSpacing:'0.04em' }}>Song Catalog</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          {saveStatus && <span style={{ fontSize:12, color:'#34D399' }}>{saveStatus}</span>}
          {isDemo ? (
            <span style={{ fontSize:11, color:'#C8942A', background:'#1a1500', border:'1px solid #3a2800', borderRadius:4, padding:'4px 10px', letterSpacing:'0.05em' }}>
              📽 Demo Mode · fictional data
            </span>
          ) : driveConnected ? (
            <span style={{ fontSize:11, color: driveStatus.includes('⚠')?'#C0392B': driveStatus.includes('⟳')?'#C8942A':'#34D399',
                           background:'#0a1a0a', border:`1px solid ${driveStatus.includes('⚠')?'#2a1515': driveStatus.includes('⟳')?'#3a2800':'#1a4a1a'}`,
                           borderRadius:4, padding:'4px 10px', letterSpacing:'0.05em' }}>
              {driveStatus || '☁ Connected'}
            </span>
          ) : (
            <button onClick={()=>{ startOAuth(); }}
              style={{ fontSize:11, color:'#5B8DD9', background:'#0d0d1a', border:'1px solid #1e2a3a', borderRadius:4, padding:'4px 10px', cursor:'pointer', letterSpacing:'0.05em' }}>
              🔗 Connect Drive
            </button>
          )}
          <div style={{ display:'flex', gap:14 }}>
            {[{n:masters.length,l:'Songs',c:'#C8942A'},{n:allVersions.length,l:'Versions',c:'#5B8DD9'},{n:allTakes.length,l:'Takes',c:'#8B5CF6'}].map(x=>(
              <div key={x.l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color:x.c, lineHeight:1 }}>{x.n}</div>
                <div style={{ fontSize:9, color:'#aaa', letterSpacing:'0.1em', textTransform:'uppercase' }}>{x.l}</div>
              </div>
            ))}
          </div>
          {!isDemo && (
            <button onClick={()=>{ if(window.startCatalogTour) window.startCatalogTour(); }} style={{ background:'transparent', border:'1px solid #C8942A', borderRadius:4, color:'#C8942A', padding:'8px 16px', fontSize:11, cursor:'pointer', letterSpacing:'0.12em', textTransform:'uppercase', marginRight:8 }}>★ Take Tour</button>
          )}
          <button onClick={()=>setShowSettings(true)} style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#ccc', padding:'8px 16px', fontSize:11, cursor:'pointer', letterSpacing:'0.12em', textTransform:'uppercase' }}>⚙ Settings</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', borderBottom:'1px solid #1a1a1a', background:'#0c0c0c' }}>
        {[['catalog','📀  Catalog'],['add','＋  New Song']].map(([tab,label])=>(
          <button key={tab} onClick={()=>{ setActiveTab(tab); setWizardStep('master'); }}
            style={{ padding:'13px 26px', border:'none', background:'transparent', cursor:'pointer', fontSize:12, letterSpacing:'0.15em', textTransform:'uppercase',
                     color:activeTab===tab?'#C8942A':'#aaa', borderBottom:activeTab===tab?'2px solid #C8942A':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* CATALOG TAB */}
      {activeTab==='catalog' && (
        <div style={{ padding:'20px 24px' }}>

          {/* Drive session expiry warning */}
          {driveConnected && driveExpired && (
            <div style={{ background:'#1a0e00', border:'1px solid #C8942A', borderRadius:5,
                          padding:'10px 16px', display:'flex', alignItems:'center', gap:12,
                          marginBottom:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:'#e8a84a', flex:1, lineHeight:1.5 }}>
                ⚠ <strong>Google Drive session expired.</strong> Your changes are saved locally but are not syncing to Drive. Reconnect to resume backups.
              </span>
              <button onClick={()=>startOAuth()}
                style={{ background:'#C8942A', border:'none', borderRadius:4, color:'#000',
                         padding:'7px 18px', fontSize:11, cursor:'pointer', letterSpacing:'0.1em',
                         textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap' }}>
                Reconnect Drive
              </button>
            </div>
          )}

          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search songs, lyrics…"
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'8px 12px', fontSize:13, outline:'none', width:220 }} />
            <select value={filterPersona} onChange={e=>setFilterPersona(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}>
              <option value="all">All Personas</option>
              <option value="__unassigned__">⚠ Unassigned</option>
              {personas.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterStage} onChange={e=>setFilterStage(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}>
              <option value="all">All Stages</option>
              {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}>
              <option value="all">All Statuses</option>
              {RELEASE_STATUSES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <select value={filterEp} onChange={e=>setFilterEp(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}
              title="Filter songs to those on a specific EP">
              <option value="all">All EPs</option>
              <option value="__none__">Not on any EP</option>
              {eps.map(ep=><option key={ep.id} value={ep.id}>📀 {ep.name}</option>)}
            </select>
            <select value={filterIsrc} onChange={e=>setFilterIsrc(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}
              title="Filter by single-release ISRC status">
              <option value="all">All ISRCs</option>
              <option value="has">Has ISRC</option>
              <option value="missing">Missing ISRC (submitted/live)</option>
            </select>
            <select value={filterRelease} onChange={e=>setFilterRelease(e.target.value)}
              style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, color:'#ccc', padding:'8px 12px', fontSize:12, outline:'none', cursor:'pointer' }}
              title="Filter by release state or timing">
              <option value="all">All Releases</option>
              <option value="spotify">🟢 Live on Spotify</option>
              <option value="submitted">📬 Submitted to DistroKid</option>
              <option value="hyperfollow">🔗 Has HyperFollow</option>
              <option value="thisMonth">📅 Releasing this month</option>
              <option value="next30">⏱ Releasing next 30 days</option>
            </select>
            <div style={{ display:'flex', gap:4, marginLeft:'auto', flexWrap:'wrap' }}>
              {['Dashboard',...VIEWS].map(v=>(
                <button key={v} onClick={()=>changeView(v)}
                  style={{ background:view===v?'#161616':'transparent', border:`1px solid ${view===v?'#C8942A':'#333'}`, borderRadius:4,
                           color:view===v?'#C8942A':'#aaa', padding:'6px 11px', fontSize:10, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Dashboard */}
          {view==='Dashboard' && (
            <div style={{ display:'grid', gap:14 }}>

              {/* Stat cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
                {[
                  { label:'Live on Spotify', count:dash.dkLive, color:'#34D399', sub:'released & streaming' },
                  { label:'Submitted', count:dash.dkSubmitted, color:'#5B8DD9', sub:'waiting for release date' },
                  { label:'Checklist Ready', count:dash.checklistReady, color:'#C8942A', sub:'ready to submit to DK' },
                  { label:'Total Songs', count:dash.total, color:'#888', sub:`${dash.totalVersions} recordings` },
                  { label:'Missing Lyrics', count:masters.filter(m=>!m.lyrics||!m.lyrics.trim()).length, color:'#8B5CF6', sub:'not yet in the app' },
                ].map(s=>(
                  <div key={s.label} style={{ background:'#0f0f0f', border:`1px solid ${s.color}33`, borderTop:`3px solid ${s.color}`, borderRadius:6, padding:'16px 14px' }}>
                    <div style={{ fontSize:32, color:s.color, lineHeight:1, marginBottom:5 }}>{s.count}</div>
                    <div style={{ fontSize:11, color:'#ccc', marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontSize:10, color:'#666' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* ISRC completeness — count submitted/live versions whose primary-take ISRC has been captured */}
              {dash.isrcEligible > 0 && (
                <div style={{ background:'#0f0f0f', border:`1px solid ${dash.isrcMissing>0?'#C8942A55':'#34D39955'}`, borderRadius:6, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ fontSize:24, color:dash.isrcMissing>0?'#C8942A':'#34D399' }}>{dash.isrcMissing>0?'⚠':'✓'}</div>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontSize:13, color:'#e8dcc8', marginBottom:3 }}>ISRC Completeness</div>
                    <div style={{ fontSize:11, color:'#888', lineHeight:1.6 }}>
                      <strong style={{ color:dash.isrcMissing>0?'#C8942A':'#34D399' }}>{dash.isrcCaptured} of {dash.isrcEligible}</strong> submitted releases have their single-release ISRC captured.
                      {dash.isrcMissing>0 && <> {dash.isrcMissing} still need to be filled in from DistroKid.</>}
                    </div>
                  </div>
                  {dash.isrcMissing>0 && (
                    <button onClick={()=>{ setFilterIsrc('missing'); changeView('Alphabetical'); }}
                      style={{ background:'transparent', border:'1px solid #C8942A55', borderRadius:4, color:'#C8942A', padding:'7px 14px', fontSize:11, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                      Show {dash.isrcMissing} →
                    </button>
                  )}
                </div>
              )}

              {/* Pitch summary — totals + this-month SubmitHub spend + per-platform breakdown */}
              {dash.pitches.all > 0 && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:10 }}>
                    <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase' }}>Pitches</div>
                    <div style={{ fontSize:11, color:'#888' }}>
                      <strong style={{ color:'#A855F7' }}>{dash.pitches.submithubCreditsTotal}</strong> SubmitHub credits spent total
                      {' · '}<strong style={{ color:'#A855F7' }}>{dash.pitches.submithubCreditsMonth}</strong> this month
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
                    {dash.pitches.byPlatform.filter(p=>p.total>0).map(p=>(
                      <div key={p.id} style={{ background:'#0c0c0c', border:`1px solid ${p.color}22`, borderLeft:`3px solid ${p.color}`, borderRadius:4, padding:'10px 12px' }}>
                        <div style={{ fontSize:11, color:p.color, marginBottom:4, letterSpacing:'0.05em' }}>{p.label}</div>
                        <div style={{ fontSize:18, color:'#e8dcc8', lineHeight:1.1, marginBottom:2 }}>{p.total}</div>
                        <div style={{ fontSize:10, color:'#666', lineHeight:1.5 }}>
                          {p.pending>0 && <>{p.pending} pending · </>}
                          {p.acceptanceRate!==null ? `${p.acceptanceRate}% positive` : 'no results yet'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Persona breakdown */}
              {dash.byPersona.length>0 && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:14 }}>Songs by Artist</div>
                  {dash.byPersona.filter(p=>p.count>0).map(p=>{
                    const readyCount = masters.filter(m=>m.versions.some(v=>v.persona===p.id&&v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))).length;
                    const caStatus = p.coverArtStatus||'needed';
                    const caColor = caStatus==='done'?'#34D399':caStatus==='inprogress'?'#C8942A':'#444';
                    const caIcon = caStatus==='done'?'🖼✓':caStatus==='inprogress'?'🖼…':'🖼';
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                        <div style={{ fontSize:11, color:p.color, width:150, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                        <div style={{ flex:1, height:5, background:'#141414', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${(p.count/Math.max(dash.totalVersions,1))*100}%`, height:'100%', background:p.color+'66', borderRadius:2 }} />
                        </div>
                        <div style={{ fontSize:11, color:'#bbb', width:50, textAlign:'right', flexShrink:0 }}>{p.count}</div>
                        <div title={`Cover art: ${caStatus}`} style={{ fontSize:11, color:caColor, width:28, textAlign:'right', flexShrink:0 }}>{caIcon}</div>
                        {readyCount>0 && <div style={{ fontSize:10, color:'#C8942A', width:50, textAlign:'right', flexShrink:0 }}>{readyCount} ready</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top themes — bar chart */}
              {dash.topThemes.length>0 && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:14 }}>Top Themes Across Catalog</div>
                  {dash.topThemes.map(([t,c])=>(
                    <div key={t} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:11, color:'#bbb', width:130, flexShrink:0 }}>{t}</div>
                      <div style={{ flex:1, height:5, background:'#141414', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${(c/Math.max(dash.total,1))*100}%`, height:'100%', background:'#C8942A88', borderRadius:2 }} />
                      </div>
                      <div style={{ fontSize:11, color:'#C8942A', width:36, textAlign:'right', flexShrink:0 }}>{c}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stage breakdown — bar chart */}
              {dash.byStage.some(s=>s.count>0) && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:14 }}>Production Stage Breakdown</div>
                  {dash.byStage.filter(s=>s.count>0).map(s=>(
                    <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:11, color:s.color, width:130, flexShrink:0 }}>{s.icon} {s.label}</div>
                      <div style={{ flex:1, height:5, background:'#141414', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${(s.count/Math.max(dash.totalVersions,1))*100}%`, height:'100%', background:s.color+'88', borderRadius:2 }} />
                      </div>
                      <div style={{ fontSize:11, color:s.color, width:36, textAlign:'right', flexShrink:0 }}>{s.count}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Export pointer */}
              <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:28, opacity:0.4 }}>📤</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#e8dcc8', marginBottom:4 }}>Audience-Specific Exports</div>
                  <div style={{ fontSize:11, color:'#666', lineHeight:1.6 }}>
                    Generate tailored catalogs for Music Supervisors, Label / A&R, Publishers, and Playlist Curators — each with the right fields, sorting, and context for that audience.
                  </div>
                </div>
                <button onClick={()=>{ setShowSettings(true); setSettingsTab('exports'); }}
                  style={{ background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:4, color:'#fff', padding:'10px 18px', fontSize:11, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                  ⚙ Settings → Exports
                </button>
              </div>

              {masters.length===0 && (
                <div style={{ textAlign:'center', padding:'60px 0', color:'#ccc' }}>
                  <div style={{ fontSize:48, opacity:0.15, marginBottom:12 }}>♪</div>
                  <div style={{ fontSize:14 }}>No songs yet. Click "New Song" to get started.</div>
                </div>
              )}
            </div>
          )}

          {/* EPs view */}
          {view === 'EPs' && (
            <EpView eps={eps} masters={masters} personas={personas}
              onCreateEp={createEp} onUpdateEp={updateEp} onDeleteEp={deleteEp} />
          )}

          {/* Personas view — per-persona stats, release links, pending pitches */}
          {view === 'Personas' && (
            <PersonasView personas={personas} masters={masters} />
          )}

          {/* Song list — grouped by view */}
          {view !== 'Dashboard' && view !== 'Release Calendar' && view !== 'EPs' && view !== 'Personas' && (() => {
            const sorted = [...filtered].sort((a,b)=>a.title.localeCompare(b.title));
            let groups = [];
            if (view==='Alphabetical') {
              groups = [{ label:'All Songs', color:'#ccc', items:sorted }];
            } else if (view==='By Persona') {
              const assignedGroups = personas
                .filter(p=>filtered.some(m=>m.versions.some(v=>v.persona===p.id)))
                .map(p=>({ label:p.name, color:p.color, items:sorted.filter(m=>m.versions.some(v=>v.persona===p.id)) }));
              const unassignedItems = sorted.filter(m=>m.versions.some(v=>!v.persona||!personas.find(p=>p.id===v.persona)));
              groups = [...assignedGroups, ...(unassignedItems.length ? [{ label:'⚠ Unassigned', color:'#999', items:unassignedItems }] : [])];
            } else if (view==='By Status') {
              groups = RELEASE_STATUSES
                .filter(r=>filtered.some(m=>m.versions.some(v=>v.takes.some(t=>(t.releaseStatus||'draft')===r.id))))
                .map(r=>({ label:r.label, color:r.color, items:sorted.filter(m=>m.versions.some(v=>v.takes.some(t=>(t.releaseStatus||'draft')===r.id))) }));
            } else if (view==='By Audience') {
              const audiences = [...new Set(allVersions.map(v=>v.targetAudience||'General'))].sort();
              groups = audiences
                .filter(a=>filtered.some(m=>m.versions.some(v=>(v.targetAudience||'General')===a)))
                .map(a=>({ label:a, color:'#ccc', items:sorted.filter(m=>m.versions.some(v=>(v.targetAudience||'General')===a)) }));
            } else if (view==='By Theme') {
              const allThemes = [...new Set(filtered.flatMap(m=>m.versions.flatMap(v=>v.themes||[])))].filter(t=>THEMES.includes(t)).sort((a,b)=>THEMES.indexOf(a)-THEMES.indexOf(b));
              const noTheme = sorted.filter(m=>m.versions.every(v=>!v.themes||v.themes.length===0));
              groups = [
                ...allThemes.map(theme=>({ label:theme, color:'#C8942A', items:sorted.filter(m=>m.versions.some(v=>(v.themes||[]).includes(theme))) })),
                ...(noTheme.length?[{ label:'No Theme Tagged', color:'#444', items:noTheme }]:[])
              ];
            } else if (view==='By Stage') {
              groups = STAGES
                .filter(s=>filtered.some(m=>m.versions.some(v=>v.takes.some(t=>effectiveStage(t,m.lyrics)===s.id))))
                .map(s=>({ label:`${s.icon} ${s.label}`, color:s.color, items:sorted.filter(m=>m.versions.some(v=>v.takes.some(t=>effectiveStage(t,m.lyrics)===s.id))) }));
            }
            return groups.map(group => {
              const isOpen = expandedGroups.has(group.label);
              const toggle = () => setExpandedGroups(prev => {
                const next = new Set(prev);
                if (next.has(group.label)) next.delete(group.label); else next.add(group.label);
                return next;
              });
              return (
                <div key={group.label} style={{ marginBottom:6 }}>
                  <div onClick={toggle} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#0f0f0f', border:`1px solid ${group.color}33`, borderLeft:`3px solid ${group.color}`, borderRadius:4, cursor:'pointer', marginBottom: isOpen ? 8 : 0, userSelect:'none' }}>
                    <div style={{ fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase', color:group.color, flex:1 }}>{group.label}</div>
                    <div style={{ fontSize:11, color:'#666' }}>{group.items.length} song{group.items.length!==1?'s':''}</div>
                    <div style={{ fontSize:11, color:'#555', marginLeft:10 }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                  {isOpen && group.items.map(master => (
                    <MasterRow key={master.id} master={master} personas={personas} apiKey={apiKey} eps={eps}
                      expanded={expandedMaster===master.id}
                      onToggle={()=>setExpandedMaster(expandedMaster===master.id?null:master.id)}
                      expandedVersion={expandedVersion} setExpandedVersion={setExpandedVersion}
                      addingVersionTo={addingVersionTo} setAddingVersionTo={setAddingVersionTo}
                      addVersionForm={addVersionForm} setAddVersionForm={setAddVersionForm}
                      addVersionAnalyzing={addVersionAnalyzing} addVersionConfirming={addVersionConfirming}
                      addVersionAnalysis={addVersionAnalysis}
                      onAddVersionAnalyze={handleAddVersionAnalyze}
                      onAddVersionConfirm={handleAddVersionConfirm}
                      setAddVersionConfirming={setAddVersionConfirming}
                      addingTakeTo={addingTakeTo} setAddingTakeTo={setAddingTakeTo}
                      takeForm={takeForm} setTakeForm={setTakeForm}
                      onAddTake={handleAddTake} onUpdateTake={updateTake} onSetPrimary={setPrimaryTake}
                      onUpdateMaster={updateMaster} onUpdateVersion={updateVersion}
                      onDeleteMaster={deleteMaster} onDeleteVersion={deleteVersion} onDeleteTake={deleteTake}
                      savePersonas={savePersonas} flash={flash} searchQ={searchQ}
                    />
                  ))}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Release Calendar View */}
      {activeTab==='catalog' && view==='Release Calendar' && (() => {
        // Collect all versions with a release date or completed checklist
        const today = new Date(); today.setHours(0,0,0,0);
        const entries = [];
        masters.forEach(master => {
          (master.versions||[]).forEach(version => {
            const dk = version.distrokid || {};
            const t0 = version.takes?.[0] || {};
            const autos = [!!(t0.sunoUrl?.trim()), !!(version.genre && version.mood && version.themes?.length > 0), !!(master.lyrics?.trim())];
            const manuals = [version.releaseChecklist?.listened, version.releaseChecklist?.coverArt, version.releaseChecklist?.audioDownloaded];
            const checklistDone = [...autos, ...manuals].filter(Boolean).length === 6;
            const hasDate = !!(dk.releaseDate?.trim());
            if (hasDate || checklistDone || dk.submittedDate) {
              entries.push({ master, version, dk, checklistDone });
            }
          });
        });
        // Split into dated and undated
        const dated = entries.filter(e=>e.dk.releaseDate?.trim()).sort((a,b)=>a.dk.releaseDate.localeCompare(b.dk.releaseDate));
        const undated = entries.filter(e=>!e.dk.releaseDate?.trim());
        // Group dated by month
        const byMonth = {};
        dated.forEach(e => {
          const d = new Date(e.dk.releaseDate + 'T00:00:00');
          const key = d.toLocaleDateString('en-US',{year:'numeric',month:'long'});
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push(e);
        });
        const renderEntry = (e) => {
          const p = getP(e.version.persona, personas);
          const dk = e.dk;
          const isLive = !!(dk.spotifyUrl?.trim());
          const isSubmitted = !!(dk.submittedDate?.trim());
          const releaseDate = dk.releaseDate?.trim();
          let relDate = null;
          let isPast = false;
          let isToday = false;
          let daysOut = null;
          if (releaseDate) {
            relDate = new Date(releaseDate + 'T00:00:00');
            isPast = relDate < today;
            isToday = relDate.getTime() === today.getTime();
            daysOut = Math.round((relDate - today) / (1000*60*60*24));
          }
          const statusColor = isLive ? '#34D399' : isSubmitted ? '#5B8DD9' : e.checklistDone ? '#C8942A' : '#666';
          const statusLabel = isLive ? '🟢 Live' : isSubmitted ? '📬 Submitted' : e.checklistDone ? '✓ Ready' : '○ Checklist incomplete';

          // ISRC capture warning — submitted/live versions that don't have their
          // single-release ISRC saved yet. Operational nag: capture from DistroKid.
          const needsIsrc = (isSubmitted || isLive) && !primaryTakeIsrc(e.version);

          // Pitch window — only meaningful for upcoming releases. Spotify
          // Editorial accepts pitches up to ~28 days ahead; T-14 is the
          // typical practical window; T-7 is the absolute floor.
          let pitchWindow = null;
          if (daysOut !== null && daysOut > 0 && !isLive) {
            if (daysOut >= 14)     pitchWindow = { label:`🎯 T-${daysOut} · pitch window open`, color:'#34D399' };
            else if (daysOut >= 7) pitchWindow = { label:`⏱ T-${daysOut} · pitch window closing`, color:'#C8942A' };
            else                   pitchWindow = { label:`⚠ T-${daysOut} · pitch floor`,        color:'#C84A4A' };
          }

          return (
            <div key={e.version.id} style={{ display:'flex', gap:12, padding:'12px 14px', background: isToday?'#1a1500':'#0d0d0d', border:`1px solid ${isToday?'#C8942A33':isLive?'#34D39922':'#1a1a1a'}`, borderLeft:`3px solid ${p.color}`, borderRadius:4, marginBottom:6 }}>
              {/* Date block */}
              <div style={{ flexShrink:0, width:52, textAlign:'center' }}>
                {relDate ? (
                  <>
                    <div style={{ fontSize:22, fontWeight:700, color: isPast&&!isLive?'#444':p.color, lineHeight:1 }}>{relDate.getDate()}</div>
                    <div style={{ fontSize:9, color:'#555', letterSpacing:'0.1em', textTransform:'uppercase' }}>{relDate.toLocaleDateString('en-US',{weekday:'short'})}</div>
                  </>
                ) : (
                  <div style={{ fontSize:10, color:'#444', marginTop:4 }}>No date</div>
                )}
              </div>
              {/* Main info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color: isPast&&!isLive?'#666':'#f0e8d8', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {daysOut !== null && daysOut > 0 && <span style={{ color:'#C8942A', fontWeight:700, marginRight:8 }}>T-{daysOut}</span>}
                  {e.master.title}
                </div>
                <div style={{ fontSize:11, color:p.color, letterSpacing:'0.08em', marginBottom:4 }}>{p.name} · {e.version.genre}</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:statusColor }}>{statusLabel}</span>
                  {needsIsrc && <span title="Single-release ISRC missing from DistroKid" style={{ fontSize:10, color:'#C8942A', padding:'1px 7px', borderRadius:3, background:'#1a1500', border:'1px solid #C8942A55' }}>⚠ ISRC needed</span>}
                  {pitchWindow && <span style={{ fontSize:10, color:pitchWindow.color }}>{pitchWindow.label}</span>}
                  {dk.hyperFollowUrl     && <a href={dk.hyperFollowUrl}     target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#C8942A', textDecoration:'none' }}>🔗 HyperFollow</a>}
                  {dk.spotifyUrl         && <a href={dk.spotifyUrl}         target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#34D399', textDecoration:'none' }}>🎧 Spotify</a>}
                  {dk.appleMusicTrackUrl && <a href={dk.appleMusicTrackUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#F87171', textDecoration:'none' }}>🍎 Apple Music</a>}
                </div>
              </div>
              {/* Days until */}
              {relDate && !isPast && !isToday && (
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#333' }}>{daysOut}</div>
                  <div style={{ fontSize:9, color:'#444', letterSpacing:'0.08em' }}>days</div>
                </div>
              )}
              {isToday && <div style={{ flexShrink:0, fontSize:10, color:'#C8942A', fontWeight:700, alignSelf:'center' }}>TODAY</div>}
              {isPast && !isLive && <div style={{ flexShrink:0, fontSize:10, color:'#444', alignSelf:'center' }}>passed</div>}
            </div>
          );
        };
        return (
          <div style={{ paddingBottom:20 }}>
            {Object.keys(byMonth).length === 0 && undated.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'#444', fontSize:13 }}>
                No releases scheduled yet. Submit songs to DistroKid and log their release dates to see them here.
              </div>
            )}
            {Object.entries(byMonth).map(([month, entries]) => (
              <div key={month} style={{ marginBottom:24 }}>
                <div style={{ fontSize:10, letterSpacing:'0.25em', color:'#555', textTransform:'uppercase', padding:'8px 2px', marginBottom:8, borderBottom:'1px solid #1a1a1a' }}>{month}</div>
                {entries.map(renderEntry)}
              </div>
            ))}
            {undated.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10, letterSpacing:'0.25em', color:'#555', textTransform:'uppercase', padding:'8px 2px', marginBottom:8, borderBottom:'1px solid #1a1a1a' }}>Ready — No Date Set</div>
                {undated.map(renderEntry)}
              </div>
            )}
          </div>
        );
      })()}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:10, padding:'36px 32px', maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.9)' }}>
            <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:10 }}>Welcome</div>
            <div style={{ fontSize:22, color:'#f0e8d8', marginBottom:8, lineHeight:1.3 }}>Your Music Catalog</div>
            <div style={{ fontSize:13, color:'#888', lineHeight:1.7, marginBottom:28 }}>
              This app helps you manage your entire AI-generated music catalog — organize songs by artist persona, track your release pipeline, and submit to DistroKid with confidence. Three steps to get started:
            </div>
            <div style={{ display:'grid', gap:12, marginBottom:28 }}>
              {[
                { num:'1', title:'Create an Artist Persona', desc:'Go to Settings → Personas and set up your first artist. Each persona is a distinct musical identity — genre, style, audience.', action:'Settings → Personas', color:'#C8942A' },
                { num:'2', title:'Add Your First Song', desc:'Click "New Song" in the top bar. Paste your lyrics and Suno URL. The AI will suggest the right persona and fill in the metadata automatically.', action:'New Song button', color:'#5B8DD9' },
                { num:'3', title:'Connect Google Drive', desc:'Go to Settings → General and connect Drive. Your catalog saves automatically. No data is ever lost between sessions.', action:'Settings → General', color:'#34D399' },
              ].map(step => (
                <div key={step.num} style={{ display:'flex', gap:14, padding:'12px 14px', background:'#141414', border:`1px solid ${step.color}22`, borderLeft:`3px solid ${step.color}`, borderRadius:5 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:step.color, flexShrink:0, lineHeight:1.2 }}>{step.num}</div>
                  <div>
                    <div style={{ fontSize:12, color:'#e8dcc8', marginBottom:3 }}>{step.title}</div>
                    <div style={{ fontSize:11, color:'#777', lineHeight:1.6 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{ dismissOnboarding(); setShowSettings(true); setSettingsTab('personas'); }}
                style={{ flex:1, background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:5, color:'#fff', padding:'12px 0', fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                Set Up Personas →
              </button>
              <button onClick={dismissOnboarding}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:5, color:'#666', padding:'12px 16px', fontSize:11, cursor:'pointer' }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SONG TAB */}
      {activeTab==='add' && (
        <AddWizard personas={personas}
          masterForm={masterForm} setMasterForm={setMasterForm}
          versionForm={versionForm} setVersionForm={setVersionForm}
          wizardStep={wizardStep} setWizardStep={setWizardStep}
          wizardAnalyzing={wizardAnalyzing} pendingAnalysis={pendingAnalysis}
          onAnalyze={handleWizardAnalyze} onConfirm={handleWizardConfirm}
          onCancel={()=>{ setActiveTab('catalog'); setWizardStep('master'); setPendingAnalysis(null); }}
          savePersonas={savePersonas} flash={flash}
        />
      )}

      {isDemo ? (
        <DemoTour
          setView={changeView}
          setActiveTab={setActiveTab}
          setShowSettings={setShowSettings}
          setSettingsTab={setSettingsTab}
          setWizardStep={setWizardStep}
          setMasterForm={setMasterForm}
          setVersionForm={setVersionForm}
          setPendingAnalysis={setPendingAnalysis}
          setExpandedMaster={setExpandedMaster}
          setExpandedVersion={setExpandedVersion}
          setExpandedGroups={setExpandedGroups}
        />
      ) : (
        <Tour
          setView={changeView}
          setActiveTab={setActiveTab}
          setShowSettings={setShowSettings}
          setSettingsTab={setSettingsTab}
          setWizardStep={setWizardStep}
          setExpandedMaster={setExpandedMaster}
          setExpandedVersion={setExpandedVersion}
          setExpandedGroups={setExpandedGroups}
          masters={masters}
        />
      )}
    </div>
  );
}
