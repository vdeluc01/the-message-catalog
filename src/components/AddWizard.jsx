import { getP, iBase, lBase, uid } from '../utils.js';
import { STAGES, RELEASE_STATUSES, PERSONA_COLORS } from '../constants.js';
import Tag from './Tag.jsx';

export default function AddWizard({ personas, masterForm, setMasterForm, versionForm, setVersionForm,
  wizardStep, setWizardStep, wizardAnalyzing, pendingAnalysis, onAnalyze, onConfirm, onCancel,
  savePersonas, flash }) {

  return (
    <div style={{ maxWidth:600, margin:'30px auto', padding:'0 24px' }}>
      <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:20 }}>
        {wizardStep==='master'?'Step 1 of 3 — Song & Lyrics':wizardStep==='version'?'Step 2 of 3 — Version Details':'Step 3 of 3 — Confirm Persona'}
      </div>

      {wizardStep==='master' && (
        <div style={{ background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:8, padding:24 }}>
          <div style={{ marginBottom:14 }}>
            <label style={lBase}>Song Title *</label>
            <input value={masterForm.title} onChange={e=>setMasterForm(f=>({...f,title:e.target.value}))} style={iBase} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lBase}>Lyrics</label>
            <textarea value={masterForm.lyrics} onChange={e=>setMasterForm(f=>({...f,lyrics:e.target.value}))} rows={8}
              style={{ ...iBase, resize:'vertical', lineHeight:1.8 }} placeholder="Paste full lyrics here…" />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={lBase}>Story / Notes</label>
            <textarea value={masterForm.notes} onChange={e=>setMasterForm(f=>({...f,notes:e.target.value}))} rows={3}
              style={{ ...iBase, resize:'vertical', lineHeight:1.7 }} placeholder="What's behind this song?…" />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setWizardStep('version')} disabled={!masterForm.title}
              style={{ flex:1, background:masterForm.title?'linear-gradient(135deg,#C8942A,#9a7018)':'#1a1a1a', border:'none', borderRadius:4,
                       color:masterForm.title?'#fff':'#777', padding:'11px 0', fontSize:12, cursor:masterForm.title?'pointer':'default' }}>
              Next: Version Details →
            </button>
            <button onClick={onCancel} style={{ background:'transparent', border:'1px solid #1e1e1e', borderRadius:4, color:'#bbb', padding:'11px 16px', fontSize:12, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {wizardStep==='version' && (
        <div style={{ background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:8, padding:24 }}>
          <div style={{ marginBottom:14 }}>
            <label style={lBase}>Version Label</label>
            <input value={versionForm.label} onChange={e=>setVersionForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Gospel Soul, Folk Acoustic…" style={iBase} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lBase}>Style Prompt *</label>
            <textarea value={versionForm.stylePrompt} onChange={e=>setVersionForm(f=>({...f,stylePrompt:e.target.value}))} rows={3}
              style={{ ...iBase, resize:'vertical' }} placeholder="The Suno style prompt for this version…" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div><label style={lBase}>Suno URL (first take)</label>
              <input value={versionForm.firstTakeUrl} onChange={e=>setVersionForm(f=>({...f,firstTakeUrl:e.target.value}))} style={iBase} placeholder="https://suno.com/s/…" /></div>
            <div><label style={lBase}>Suno Version</label>
              <input value={versionForm.firstTakeVersion} onChange={e=>setVersionForm(f=>({...f,firstTakeVersion:e.target.value}))} style={iBase} placeholder="v3.5, v4…" /></div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lBase}>Suno Creation Date</label>
            <input type="date" value={(versionForm.sunoCreatedAt||'').slice(0,10)} onChange={e=>setVersionForm(f=>({...f,sunoCreatedAt:e.target.value}))} style={iBase} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            <div><label style={lBase}>Production Stage</label>
              <select value={versionForm.stage} onChange={e=>setVersionForm(f=>({...f,stage:e.target.value}))}
                style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'10px 12px', fontSize:13, outline:'none', width:'100%' }}>
                {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select></div>
            <div><label style={lBase}>Release Status</label>
              <select value={versionForm.releaseStatus} onChange={e=>setVersionForm(f=>({...f,releaseStatus:e.target.value}))}
                style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'10px 12px', fontSize:13, outline:'none', width:'100%' }}>
                {RELEASE_STATUSES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
              </select></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onAnalyze} disabled={wizardAnalyzing||!versionForm.stylePrompt}
              style={{ flex:1, background:versionForm.stylePrompt?'linear-gradient(135deg,#C8942A,#9a7018)':'#1a1a1a', border:'none', borderRadius:4,
                       color:versionForm.stylePrompt?'#fff':'#777', padding:'11px 0', fontSize:12, cursor:versionForm.stylePrompt?'pointer':'default' }}>
              {wizardAnalyzing?'Analyzing…':'Analyze & Continue →'}
            </button>
            <button onClick={()=>setWizardStep('master')} style={{ background:'transparent', border:'1px solid #1e1e1e', borderRadius:4, color:'#bbb', padding:'11px 16px', fontSize:12, cursor:'pointer' }}>← Back</button>
          </div>
        </div>
      )}

      {wizardStep==='manual' && (
        <div style={{ background:'#0f0f0f', border:'1px solid #3a1a1a', borderRadius:8, padding:24 }}>
          <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C84A4A', textTransform:'uppercase', marginBottom:8 }}>AI Analysis Unavailable</div>
          <div style={{ fontSize:13, color:'#aaa', marginBottom:20, lineHeight:1.7 }}>
            The AI analysis couldn't run — likely due to API credits or connectivity. You can still save this song by picking a persona manually, or leave it unassigned and reassign it later.
          </div>
          <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#888', textTransform:'uppercase', marginBottom:10 }}>Choose a Persona</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
            {personas.map(p=>(
              <button key={p.id} onClick={()=>onConfirm(p.id)}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#bbb', padding:'7px 12px', fontSize:11, cursor:'pointer' }}>
                {p.name}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button onClick={()=>onConfirm('')}
              style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:4, color:'#888', padding:'8px 18px', fontSize:11, cursor:'pointer' }}>
              Save as Unassigned
            </button>
            <button onClick={()=>setWizardStep('version')}
              style={{ background:'transparent', border:'1px solid #222', borderRadius:4, color:'#bbb', padding:'8px 16px', fontSize:11, cursor:'pointer' }}>
              ← Back to Edit
            </button>
          </div>
        </div>
      )}

      {(wizardStep==='analyzing'||wizardStep==='confirm') && (
        <div style={{ background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:8, padding:24 }}>
          <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:20 }}>Confirm Persona</div>
          {wizardStep==='analyzing' ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:13 }}>Analyzing "{masterForm.title}"…</div>
          ) : pendingAnalysis && (
            <div>
              <div style={{ fontSize:13, color:'#ccc', lineHeight:1.7, marginBottom:14 }}>{pendingAnalysis.versionSummary}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                {(pendingAnalysis.themes||[]).map(t=><Tag key={t} label={t} color='#C8942A99' />)}
                {pendingAnalysis.mood && <Tag label={pendingAnalysis.mood} />}
                {pendingAnalysis.targetAudience && <Tag label={pendingAnalysis.targetAudience} />}
                {pendingAnalysis.duration && <Tag label={pendingAnalysis.duration} />}
              </div>
              {pendingAnalysis.albumNote && <div style={{ fontSize:12, color:'#aaa', fontStyle:'italic', marginBottom:16 }}>📀 {pendingAnalysis.albumNote}</div>}
              {pendingAnalysis.suggestNewPersona && pendingAnalysis.suggestedNewPersonaName && (
                <div style={{ background:'#0f1a0f', border:'1px solid #1a4a1a', borderRadius:5, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#34D399', textTransform:'uppercase', marginBottom:6 }}>💡 New Persona Suggested</div>
                  <div style={{ fontSize:13, color:'#ccc', marginBottom:4 }}><strong style={{color:'#34D399'}}>{pendingAnalysis.suggestedNewPersonaName}</strong> — {pendingAnalysis.suggestedNewPersonaGenre}</div>
                  <div style={{ fontSize:12, color:'#666', marginBottom:10 }}>{pendingAnalysis.suggestedNewPersonaDesc}</div>
                  <button onClick={()=>{
                    const newP = { id:'persona-'+uid(), name:pendingAnalysis.suggestedNewPersonaName,
                      genre:pendingAnalysis.suggestedNewPersonaGenre, desc:pendingAnalysis.suggestedNewPersonaDesc,
                      color: PERSONA_COLORS[personas.length % PERSONA_COLORS.length] };
                    savePersonas([...personas, newP]);
                    flash('✓ New persona added — select it below');
                  }} style={{ background:'#1a4a1a', border:'1px solid #2a6a2a', borderRadius:4, color:'#34D399', padding:'6px 14px', fontSize:11, cursor:'pointer' }}>
                    + Add This Persona
                  </button>
                </div>
              )}
              <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', marginBottom:10 }}>
                Suggested: <span style={{ color:getP(pendingAnalysis.suggestedPersona,personas).color }}>{getP(pendingAnalysis.suggestedPersona,personas).name}</span>
                <span style={{ color:'#999', fontWeight:400, textTransform:'none', letterSpacing:0 }}> — {pendingAnalysis.personaReason}</span>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:18 }}>
                {personas.map(p=>(
                  <button key={p.id} onClick={()=>onConfirm(p.id)}
                    style={{ background:p.id===pendingAnalysis.suggestedPersona?`${p.color}22`:'transparent',
                             border:`1px solid ${p.id===pendingAnalysis.suggestedPersona?p.color:'#252525'}`,
                             borderRadius:4, color:p.id===pendingAnalysis.suggestedPersona?p.color:'#bbb',
                             padding:'7px 12px', fontSize:11, cursor:'pointer' }}>
                    {p.name}
                  </button>
                ))}
              </div>
              <button onClick={()=>setWizardStep('version')} style={{ background:'transparent', border:'1px solid #222', borderRadius:4, color:'#bbb', padding:'8px 16px', fontSize:11, cursor:'pointer' }}>
                ← Back to Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
