import { useState, useEffect, useRef } from 'react';
import { uid, getP, iBase, lBase, effectiveStage } from './utils.js';
import {
  PERSONAS_KEY, APIKEY_KEY, DATA_KEY, FID_KEY,
  DEFAULT_PERSONAS, STAGES, RELEASE_STATUSES, VIEWS, PERSONA_COLORS
} from './constants.js';
import { getToken, startOAuth, driveLoad, driveSave } from './drive.js';
import { analyzeWithAI, enrichWithAI } from './ai.js';
import {
  exportSupervisorCSV, exportSupervisorPDF,
  exportLabelCSV, exportLabelPDF,
  exportPublisherCSV, exportPublisherPDF,
  exportCuratorCSV, exportCuratorPDF
} from './exports.js';
import MasterRow from './components/MasterRow.jsx';
import AddWizard from './components/AddWizard.jsx';
import BatchAdd from './components/BatchAdd.jsx';

export default function App() {
  // Core data
  const [masters, setMasters] = useState([]);
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
  const [expandedMaster, setExpandedMaster] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Settings tabs
  const [settingsTab, setSettingsTab] = useState('general');
  const [editingPersona, setEditingPersona] = useState(null);
  const [newPersonaForm, setNewPersonaForm] = useState({ name:'', desc:'', color:'#C8942A' });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(APIKEY_KEY) || '');

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
  const [driveStatus, setDriveStatus] = useState('');
  const [driveExpired, setDriveExpired] = useState(false);

  // ── Init ──
  useEffect(() => {
    const token = getToken();
    if (token) {
      setDriveConnected(true);
      handleDriveLoad(token);
    } else {
      // Load local data so the UI isn't empty while we redirect
      const stored = localStorage.getItem(DATA_KEY);
      if (stored) try { setMasters(JSON.parse(stored)); } catch(e) {}
      const fid = localStorage.getItem(FID_KEY);
      if (fid) setDriveFileId(fid);
      // Auto-prompt to connect Drive on every launch — no silent fallback
      startOAuth();
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(DATA_KEY, JSON.stringify(masters));
  }, [masters]);

  // Auto-save to Google Drive — debounced 4s after any change + every 5 min
  useEffect(() => {
    if (!driveConnected || masters.length === 0) return;
    if (driveAutoSaveTimer.current) clearTimeout(driveAutoSaveTimer.current);
    driveAutoSaveTimer.current = setTimeout(() => triggerDriveAutoSave(), 4000);
    return () => { if (driveAutoSaveTimer.current) clearTimeout(driveAutoSaveTimer.current); };
  }, [masters, driveConnected]);

  useEffect(() => {
    if (!driveConnected) return;
    const interval = setInterval(() => triggerDriveAutoSave(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driveConnected, driveFileId, masters]);

  const save = (newMasters) => setMasters(newMasters);
  const flash = (msg, ms=2500) => { setSaveStatus(msg); setTimeout(()=>setSaveStatus(''), ms); };
  const flashDrive = (msg, ms=3000) => { setDriveMsg(msg); setTimeout(()=>setDriveMsg(''), ms); };

  async function triggerDriveAutoSave() {
    const token = getToken();
    if (!token) { setDriveStatus('⚠ Session expired'); setDriveExpired(true); return; }
    setDriveExpired(false);
    setDriveStatus('⟳ Saving…');
    try {
      const current = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
      const newId = await driveSave(token, current, driveFileId);
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
        const driveMasters = result.data.masters || [];
        const stored = localStorage.getItem(DATA_KEY);
        const localMasters = stored ? JSON.parse(stored) : [];
        const localIds = new Set(localMasters.map(m => m.id));
        const driveOnly = driveMasters.filter(m => !localIds.has(m.id));
        const merged = localMasters.length > 0 ? [...localMasters, ...driveOnly] : driveMasters;
        setMasters(merged);
        setDriveFileId(result.fileId);
        localStorage.setItem(FID_KEY, result.fileId);
        await driveSave(token, merged, result.fileId);
        if (driveOnly.length > 0) {
          flashDrive(`✓ Reconnected — pulled in ${driveOnly.length} Drive-only song${driveOnly.length!==1?'s':''}`, 4000);
        } else {
          flashDrive('✓ Connected — local changes pushed to Drive');
        }
        setDriveStatus('☁ Connected');
        setDriveExpired(false);
      } else {
        const stored = localStorage.getItem(DATA_KEY);
        const local = stored ? JSON.parse(stored) : [];
        if (local.length > 0) {
          flashDrive('Saving local data to Drive…', 60000);
          const newId = await driveSave(token, local, null);
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
      const newId = await driveSave(token, masters, driveFileId);
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

  // Legacy export aliases
  function handleExportExcel() { flash(exportLabelCSV(masters, personas)); }
  function handleExportPDF() { flash(exportLabelPDF(masters, personas)); }

  // ── Bulk Reassess Personas ────────────────────────────────────────────────
  const [reassessing, setReassessing] = useState(false);
  const [reassessProgress, setReassessProgress] = useState({ current:0, total:0, newPersonas:[] });
  const [reassessResults, setReassessResults] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current:0, total:0 });
  const [enrichResults, setEnrichResults] = useState(null);

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
            themes:         (v.themes&&v.themes.length) ? v.themes : (r.themes||v.themes),
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

  function handleExport() {
    const body = JSON.stringify({ masters, savedAt:new Date().toISOString(), version:'4.0' }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body],{type:'application/json'}));
    a.download = 'the-message-catalog-backup.json'; a.click();
    flash('✓ Backup saved');
  }
  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
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
        setMasters(loaded);
        flash('✓ '+loaded.length+' songs imported');
        e.target.value = '';
      } catch(err) { alert('Could not read file: '+err.message); }
    };
    reader.readAsText(file);
  }

  // ── Persona management ──
  const savePersonas = (updated) => {
    setPersonas(updated);
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(updated));
  };
  const handleAddPersona = () => {
    if (!newPersonaForm.name.trim()) return;
    const id = newPersonaForm.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    savePersonas([...personas, { id, name:newPersonaForm.name.trim(), color:newPersonaForm.color, desc:newPersonaForm.desc.trim(), genre:newPersonaForm.desc.trim() }]);
    setNewPersonaForm({ name:'', desc:'', color:PERSONA_COLORS[Math.floor(Math.random()*PERSONA_COLORS.length)] });
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
      albumNote:ai.albumNote||'', addedAt:new Date().toISOString(), takes:[firstTake] };
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
      albumNote:ai.albumNote||'', addedAt:new Date().toISOString(), takes:[firstTake] };
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
        albumNote:r.analysis.albumNote, addedAt:new Date().toISOString(), takes:[firstTake] };
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
  function deleteMaster(id) { if(confirm('Delete this song and all its versions?')) { save(masters.filter(m=>m.id!==id)); setExpandedMaster(null); } }
  function deleteVersion(masterId, versionId) {
    if(!confirm('Delete this version?')) return;
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.filter(v=>v.id!==versionId)}));
  }
  function deleteTake(masterId, versionId, takeId) {
    if(!confirm('Delete this take?')) return;
    save(masters.map(m=>m.id!==masterId?m:{...m,versions:m.versions.map(v=>v.id!==versionId?v:{...v,takes:v.takes.filter(t=>t.id!==takeId)})}));
  }

  // ── Computed ──
  const allVersions = masters.flatMap(m=>m.versions||[]);
  const allTakes    = allVersions.flatMap(v=>v.takes||[]);

  const dash = {
    total: masters.length, totalVersions: allVersions.length,
    byStage: STAGES.map(s=>({...s, count: allTakes.filter(t=>(t.stage||'idea')===s.id).length})),
    byStatus: RELEASE_STATUSES.map(r=>({...r, count:allTakes.filter(t=>(t.releaseStatus||'draft')===r.id).length})),
    byPersona: personas.map(p=>({...p, count:allVersions.filter(v=>v.persona===p.id).length})),
    topThemes: Object.entries(allVersions.reduce((a,v)=>{ (v.themes||[]).forEach(t=>{a[t]=(a[t]||0)+1;}); return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,6),
    topAudiences: Object.entries(allVersions.reduce((a,v)=>{ if(v.targetAudience) a[v.targetAudience]=(a[v.targetAudience]||0)+1; return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,5),
  };
  const filtered = masters.filter(m => {
    const q = searchQ.toLowerCase();
    const mQ = !q || m.title?.toLowerCase().includes(q) || m.notes?.toLowerCase().includes(q) ||
      (m.versions||[]).some(v=>v.genre?.toLowerCase().includes(q)||(v.themes||[]).some(t=>t.toLowerCase().includes(q)));
    const mP = filterPersona==='all' || (filterPersona==='__unassigned__'
      ? (m.versions||[]).some(v=>!v.persona||!personas.find(p=>p.id===v.persona))
      : (m.versions||[]).some(v=>v.persona===filterPersona));
    const mS = filterStatus==='all'  || (m.versions||[]).some(v=>(v.takes||[]).some(t=>t.releaseStatus===filterStatus));
    const mSt= filterStage==='all'   || (m.versions||[]).some(v=>(v.takes||[]).some(t=>t.stage===filterStage));
    return mQ && mP && mS && mSt;
  });

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
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>setEditingPersona(null)} style={{ background:'#C8942A', border:'none', borderRadius:3, color:'#fff', padding:'5px 16px', fontSize:11, cursor:'pointer' }}>Done</button>
                              <button onClick={()=>handleDeletePersona(p.id)} style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#7a2020', padding:'5px 12px', fontSize:11, cursor:'pointer', marginLeft:'auto' }}>Remove</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, color:p.color, marginBottom:2 }}>{p.name}</div>
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
                      <input value={newPersonaForm.desc} onChange={e=>setNewPersonaForm(p=>({...p,desc:e.target.value}))}
                        placeholder="Style description — used by AI for routing"
                        style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'9px 12px', fontSize:12, outline:'none', width:'100%' }} />
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
          <div style={{ fontSize:10, letterSpacing:'0.35em', color:'#C8942A', textTransform:'uppercase', marginBottom:3 }}>The Message Music Label</div>
          <div style={{ fontSize:22, color:'#f5ead8', letterSpacing:'0.04em' }}>Song Catalog</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          {saveStatus && <span style={{ fontSize:12, color:'#34D399' }}>{saveStatus}</span>}
          {driveConnected ? (
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
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search songs…"
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
            <div style={{ display:'flex', gap:4, marginLeft:'auto', flexWrap:'wrap' }}>
              {['Dashboard',...VIEWS].map(v=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{ background:view===v?'#161616':'transparent', border:`1px solid ${view===v?'#C8942A':'#333'}`, borderRadius:4,
                           color:view===v?'#C8942A':'#aaa', padding:'6px 11px', fontSize:10, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Dashboard */}
          {view==='Dashboard' && (
            <div style={{ display:'grid', gap:14 }}>

              {/* 4 action-oriented stat cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {[
                  { label:'On Spotify', count: masters.filter(m=>m.versions.some(v=>v.takes.some(t=>t.releaseStatus==='released'))).length, color:'#34D399', sub:'released to the public' },
                  { label:'Ready to Release', count: masters.filter(m=>m.versions.some(v=>v.takes.some(t=>t.releaseStatus==='ready'))).length, color:'#C8942A', sub:'waiting to go live' },
                  { label:'Under Review', count: masters.filter(m=>m.versions.some(v=>v.takes.some(t=>t.stage==='reviewing'))).length, color:'#5B8DD9', sub:'listening & deciding' },
                  { label:'Missing Lyrics', count: masters.filter(m=>!m.lyrics||!m.lyrics.trim()).length, color:'#8B5CF6', sub:'not yet in the app' },
                ].map(s=>(
                  <div key={s.label} style={{ background:'#0f0f0f', border:`1px solid ${s.color}33`, borderTop:`3px solid ${s.color}`, borderRadius:6, padding:'18px 16px' }}>
                    <div style={{ fontSize:34, color:s.color, lineHeight:1, marginBottom:6 }}>{s.count}</div>
                    <div style={{ fontSize:12, color:'#ccc', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:10, color:'#aaa' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Persona breakdown */}
              {dash.byPersona.length>0 && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:14 }}>Songs by Artist</div>
                  {dash.byPersona.map(p=>{
                    const readyCount = masters.filter(m=>m.versions.some(v=>v.persona===p.id&&v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))).length;
                    const isEmpty = p.count === 0;
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, opacity: isEmpty ? 0.35 : 1 }}>
                        <div style={{ fontSize:12, color:p.color, width:170, flexShrink:0 }}>{p.name}</div>
                        <div style={{ flex:1, height:5, background:'#141414', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${(p.count/Math.max(dash.totalVersions,1))*100}%`, height:'100%', background:p.color+'66', borderRadius:2 }} />
                        </div>
                        <div style={{ fontSize:11, color: isEmpty ? '#444' : '#bbb', width:60, textAlign:'right', flexShrink:0 }}>{isEmpty ? '—' : `${p.count} songs`}</div>
                        {readyCount>0 && <div style={{ fontSize:10, color:'#C8942A', width:60, textAlign:'right', flexShrink:0 }}>{readyCount} ready</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top themes */}
              {dash.topThemes.length>0 && (
                <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:6, padding:18 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:14 }}>Top Themes Across Catalog</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px' }}>
                    {dash.topThemes.map(([t,c])=>(
                      <div key={t} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                        <span style={{ color:'#bbb' }}>{t}</span><span style={{ color:'#C8942A' }}>{c}</span>
                      </div>
                    ))}
                  </div>
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

          {/* Song list — grouped by view */}
          {view !== 'Dashboard' && (() => {
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
              const allThemes = [...new Set(filtered.flatMap(m=>m.versions.flatMap(v=>v.themes||[])))].filter(Boolean).sort();
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
            return groups.map(group=>(
              <div key={group.label} style={{ marginBottom:28 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:3, height:14, background:group.color, borderRadius:2 }}/>
                  <div style={{ fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase', color:group.color }}>{group.label}</div>
                  <div style={{ fontSize:11, color:'#999' }}>({group.items.length})</div>
                </div>
                {group.items.map(master=>(
                  <MasterRow key={master.id} master={master} personas={personas} apiKey={apiKey}
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
                    savePersonas={savePersonas} flash={flash}
                  />
                ))}
              </div>
            ));
          })()}
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
    </div>
  );
}
