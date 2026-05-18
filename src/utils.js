import { STAGES, RELEASE_STATUSES } from './constants.js';

// Prefer crypto.randomUUID when available (every modern browser since 2021);
// fall back to a random+timestamp string for ancient browsers or non-HTTPS contexts.
export const uid = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return Math.random().toString(36).slice(2)+Date.now().toString(36);
};
export const fmtDate   = iso => { if(!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch(e){ return ''; } };
export const getStage  = id => STAGES.find(s=>s.id===id) || STAGES[0];
export const getStatus = id => RELEASE_STATUSES.find(r=>r.id===id) || RELEASE_STATUSES[0];
export const getP      = (id, list) => list.find(p=>p.id===id) || { name:'Unassigned', color:'#999', genre:'' };

// Auto-detect the minimum stage a take should be at based on its data.
// Manual overrides of 'reviewing' and 'final' are always respected.
// For everything else, we infer from what data exists.
export function effectiveStage(take, masterLyrics) {
  const manual = take.stage;
  // Always respect manual reviewing/final — those are human judgments
  if (manual === 'reviewing' || manual === 'final') return manual;
  // Auto-detect from data
  if (take.sunoUrl && take.sunoUrl.trim()) return 'generated';
  if (take.stylePrompt && take.stylePrompt.trim()) return 'prompt';
  if (masterLyrics && masterLyrics.trim()) return 'lyrics';
  return 'idea';
}

export const iBase = { background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%' };
export const lBase = { display:'block', fontSize:9, letterSpacing:'0.2em', color:'#aaa', textTransform:'uppercase', marginBottom:6 };

// Release-readiness for a single version. Single source of truth — used by
// the row badge, the expanded checklist UI, the Release Calendar, and the
// Dashboard "Checklist Ready" stat card.
// ── ISRC ───────────────────────────────────────────────────────────────
// Strip hyphens/whitespace and uppercase so 'us-rc1-25-00001' and 'USRC12500001' match.
export const normalizeIsrc = s => (s||'').replace(/[\s-]/g,'').toUpperCase();
// Loose ISRC pattern: 2 letters then 4+ alphanumeric chars. Real format is
// 12 chars total (CCXXXYYNNNNN) but we accept anything plausible so users
// searching with hyphens or partial codes still get matches.
export const isIsrcQuery = q => /^[A-Za-z]{2}[A-Za-z0-9-]{3,}$/.test((q||'').trim());

// Pull the primary take's ISRC for a version (falls back to first take).
export const primaryTakeIsrc = v => {
  const t = (v?.takes||[]).find(t=>t.isPrimary) || (v?.takes||[])[0];
  return (t?.isrc||'').trim();
};

// A version is "released or submitted" if it has a DistroKid submit date or a
// Spotify URL. This is the population we expect to have an ISRC.
export const versionIsSubmittedOrLive = v => {
  const dk = v?.distrokid || {};
  return !!(dk.submittedDate?.trim() || dk.spotifyUrl?.trim());
};

// Submitted/live versions that have NOT had their single-release ISRC captured.
export const versionNeedsIsrc = v => versionIsSubmittedOrLive(v) && !primaryTakeIsrc(v);

// ── Pitches ────────────────────────────────────────────────────────────
export const hasPendingPitches = v => (v?.pitches||[]).some(p => p.result === 'pending');

// ── EPs ────────────────────────────────────────────────────────────────
// All EPs that contain a given version. Returns [{ ep, track }] pairs.
export const getEpsForVersion = (eps, masterId, versionId) =>
  (eps||[]).flatMap(ep =>
    (ep.tracks||[])
      .filter(tr => tr.masterId === masterId && tr.versionId === versionId)
      .map(track => ({ ep, track }))
  );

export function checklistStatus(version, masterLyrics) {
  const t0 = version?.takes?.[0] || {};
  const rc = version?.releaseChecklist || {};
  const items = [
    { key: 'auto-url',        label: 'Suno URL present',      auto: true,  done: !!(t0.sunoUrl?.trim()) },
    { key: 'auto-meta',       label: 'Metadata complete',     auto: true,  done: !!(version?.genre && version?.mood && version?.themes?.length > 0) },
    { key: 'auto-lyrics',     label: 'Lyrics added',          auto: true,  done: !!(masterLyrics?.trim()) },
    { key: 'listened',        label: 'Listened end-to-end',   auto: false, done: !!rc.listened },
    { key: 'coverArt',        label: 'Cover art ready',       auto: false, done: !!rc.coverArt },
    { key: 'audioDownloaded', label: 'Audio file downloaded', auto: false, done: !!rc.audioDownloaded },
  ];
  const doneCount = items.filter(i => i.done).length;
  return { items, doneCount, total: items.length, allDone: doneCount === items.length };
}
