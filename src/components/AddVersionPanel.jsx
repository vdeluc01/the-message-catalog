import { getP, iBase, lBase } from '../utils.js';
import { STAGES, RELEASE_STATUSES } from '../constants.js';
import Tag from './Tag.jsx';

export default function AddVersionPanel({ master, personas, form, setForm, analyzing, confirming, analysis, onAnalyze, onConfirm, onBack, onCancel }) {
  if (confirming && !analysis) {
    return (
      <div style={{ background:'#111', border:'1px solid #3a1a1a', borderRadius:5, padding:16, marginTop:10 }}>
        <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C84A4A', textTransform:'uppercase', marginBottom:8 }}>AI Analysis Unavailable</div>
        <div style={{ fontSize:13, color:'#aaa', marginBottom:16, lineHeight:1.7 }}>The AI analysis couldn't run. Pick a persona manually or save as unassigned.</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
          {personas.map(p=>(
            <button key={p.id} onClick={()=>onConfirm(p.id)}
              style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#bbb', padding:'6px 11px', fontSize:11, cursor:'pointer' }}>
              {p.name}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>onConfirm('')} style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:4, color:'#888', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>Save as Unassigned</button>
          <button onClick={onBack} style={{ background:'transparent', border:'1px solid #222', borderRadius:4, color:'#bbb', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>← Back</button>
        </div>
      </div>
    );
  }
  if (confirming && analysis) {
    const suggested = getP(analysis.suggestedPersona, personas);
    return (
      <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:5, padding:16, marginTop:10 }}>
        <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:12 }}>AI Analysis</div>
        <div style={{ fontSize:12, color:'#ccc', marginBottom:12, lineHeight:1.6 }}>{analysis.versionSummary}</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {(analysis.themes||[]).map(t=><Tag key={t} label={t} />)}
          {analysis.mood && <Tag label={analysis.mood} />}
          {analysis.targetAudience && <Tag label={analysis.targetAudience} />}
        </div>
        <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', marginBottom:10 }}>
          Suggested: <span style={{ color:suggested.color }}>{suggested.name}</span>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
          {personas.map(p=>(
            <button key={p.id} onClick={()=>onConfirm(p.id)}
              style={{ background:p.id===analysis.suggestedPersona?`${p.color}22`:'transparent', border:`1px solid ${p.id===analysis.suggestedPersona?p.color:'#252525'}`,
                       borderRadius:4, color:p.id===analysis.suggestedPersona?p.color:'#bbb', padding:'6px 11px', fontSize:11, cursor:'pointer' }}>
              {p.name}
            </button>
          ))}
        </div>
        <button onClick={onBack} style={{ background:'transparent', border:'1px solid #222', borderRadius:4, color:'#bbb', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>← Back</button>
      </div>
    );
  }
  return (
    <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:5, padding:16, marginTop:10 }}>
      <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:12 }}>New Version — "{master.title}"</div>
      <div style={{ display:'grid', gap:10, marginBottom:14 }}>
        <div><label style={lBase}>Version Label</label>
          <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Gospel Soul, Folk Acoustic…" style={iBase} /></div>
        <div><label style={lBase}>Style Prompt *</label>
          <textarea value={form.stylePrompt} onChange={e=>setForm(f=>({...f,stylePrompt:e.target.value}))} rows={3}
            style={{ ...iBase, resize:'vertical' }} placeholder="The Suno style prompt for this version…" /></div>
        <div><label style={lBase}>Suno URL (first take)</label>
          <input value={form.firstTakeUrl} onChange={e=>setForm(f=>({...f,firstTakeUrl:e.target.value}))} style={iBase} placeholder="https://suno.com/s/…" /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={lBase}>Stage</label>
            <select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))}
              style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'10px 12px', fontSize:13, outline:'none', width:'100%' }}>
              {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </select></div>
          <div><label style={lBase}>Status</label>
            <select value={form.releaseStatus} onChange={e=>setForm(f=>({...f,releaseStatus:e.target.value}))}
              style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'10px 12px', fontSize:13, outline:'none', width:'100%' }}>
              {RELEASE_STATUSES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onAnalyze} disabled={analyzing||!form.stylePrompt}
          style={{ flex:1, background:form.stylePrompt?'linear-gradient(135deg,#C8942A,#9a7018)':'#1a1a1a', border:'none', borderRadius:4,
                   color:form.stylePrompt?'#fff':'#777', padding:'11px 0', fontSize:12, cursor:form.stylePrompt?'pointer':'default' }}>
          {analyzing?'Analyzing…':'Analyze & Continue →'}
        </button>
        <button onClick={onCancel} style={{ background:'transparent', border:'1px solid #1e1e1e', borderRadius:4, color:'#bbb', padding:'11px 16px', fontSize:12, cursor:'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
