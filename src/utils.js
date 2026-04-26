import { STAGES, RELEASE_STATUSES } from './constants.js';

export const uid       = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
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
