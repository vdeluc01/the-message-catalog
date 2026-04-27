import { useState, useEffect, useRef } from 'react';
import { getP, fmtDate, effectiveStage, iBase, lBase } from '../utils.js';
import { STAGES, RELEASE_STATUSES, PERSONA_COLORS } from '../constants.js';
import { analyzeWithAI } from '../ai.js';
import StagePill from './StagePill.jsx';
import StatusBadge from './StatusBadge.jsx';
import Tag from './Tag.jsx';
import AddVersionPanel from './AddVersionPanel.jsx';

// ── TAKE BLOCK ───────────────────────────────────────────────────────────────

function TakeBlock({ take, master, version, p, effStage, isAutoDetected, onUpdateTake, onSetPrimary, onDeleteTake }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ label:take.label||'', sunoUrl:take.sunoUrl||'', stylePrompt:take.stylePrompt||'', sunoCreatedAt:take.sunoCreatedAt||'' });
  const fi = { background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:12, outline:'none', width:'100%' };

  const handleSave = () => {
    onUpdateTake(master.id, version.id, take.id, { label:editForm.label, sunoUrl:editForm.sunoUrl, stylePrompt:editForm.stylePrompt, sunoCreatedAt:editForm.sunoCreatedAt });
    setEditing(false);
  };

  return (
    <div style={{ background:'#0f0f0f', border:`1px solid ${take.isPrimary?p.color+'44':'#1a1a1a'}`, borderRadius:4, padding:'10px 12px', marginBottom:6 }}>
      {!editing ? (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:take.isPrimary?p.color:'#bbb' }}>{take.label}{take.isPrimary?' ★':''}</span>
            {isAutoDetected && <span style={{ fontSize:9, color:'#bbb', fontStyle:'italic' }}>auto-detected</span>}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {STAGES.map(s=>(
                <button key={s.id} onClick={()=>onUpdateTake(master.id,version.id,take.id,'stage',s.id)}
                  style={{ background:effStage===s.id?`${s.color}22`:'transparent', border:`1px solid ${effStage===s.id?s.color:'#1e1e1e'}`,
                           borderRadius:3, color:effStage===s.id?s.color:'#999', padding:'3px 8px', fontSize:10, cursor:'pointer' }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
              <button onClick={()=>{ setEditForm({label:take.label||'',sunoUrl:take.sunoUrl||'',stylePrompt:take.stylePrompt||'',sunoCreatedAt:take.sunoCreatedAt||''}); setEditing(true); }}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'3px 8px', fontSize:10, cursor:'pointer' }}>✎ Edit</button>
              {!take.isPrimary && (
                <button onClick={()=>onSetPrimary(master.id,version.id,take.id)}
                  style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'3px 8px', fontSize:10, cursor:'pointer' }}>Set Primary</button>
              )}
              <button onClick={()=>onDeleteTake(master.id,version.id,take.id)}
                style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#6a2a2a', padding:'3px 8px', fontSize:10, cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: (take.sunoUrl||take.stylePrompt)?6:0 }}>
            {RELEASE_STATUSES.map(r=>(
              <button key={r.id} onClick={()=>onUpdateTake(master.id,version.id,take.id,'releaseStatus',r.id)}
                style={{ background:(take.releaseStatus||'draft')===r.id?`${r.color}18`:'transparent', border:`1px solid ${(take.releaseStatus||'draft')===r.id?r.color:'#1e1e1e'}`,
                         borderRadius:3, color:(take.releaseStatus||'draft')===r.id?r.color:'#999', padding:'3px 10px', fontSize:10, cursor:'pointer' }}>
                {r.label}
              </button>
            ))}
            {take.sunoUrl && <a href={take.sunoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#C8942A', marginLeft:'auto', alignSelf:'center' }}>🔗 Suno</a>}
          </div>
          {take.sunoCreatedAt && (
            <div style={{ fontSize:10, color:'#666', marginBottom:4 }}>
              📅 Created on Suno: <span style={{ color:'#999' }}>{take.sunoCreatedAt.slice(0,10)}</span>
            </div>
          )}
          {take.stylePrompt && <div style={{ fontSize:11, color:'#bbb', fontStyle:'italic', lineHeight:1.6 }}>🎛 {take.stylePrompt}</div>}
        </>
      ) : (
        <div style={{ display:'grid', gap:8 }}>
          <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#C8942A', textTransform:'uppercase', marginBottom:4 }}>Edit Take</div>
          <div><label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Take Label</label>
            <input value={editForm.label} onChange={e=>setEditForm(f=>({...f,label:e.target.value}))} style={fi} /></div>
          <div><label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Suno URL</label>
            <input value={editForm.sunoUrl} onChange={e=>setEditForm(f=>({...f,sunoUrl:e.target.value}))} placeholder="https://suno.com/s/…" style={fi} /></div>
          <div><label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Suno Creation Date</label>
            <input value={editForm.sunoCreatedAt} onChange={e=>setEditForm(f=>({...f,sunoCreatedAt:e.target.value}))} placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ" style={fi} /></div>
          <div><label style={{ fontSize:9, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:4 }}>Style Prompt</label>
            <textarea value={editForm.stylePrompt} onChange={e=>setEditForm(f=>({...f,stylePrompt:e.target.value}))} rows={2}
              style={{ ...fi, resize:'vertical', lineHeight:1.6, fontFamily:'Georgia,serif' }} /></div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setEditing(false)} style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#aaa', padding:'6px 14px', fontSize:11, cursor:'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ flex:1, background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:3, color:'#fff', padding:'6px 0', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>✓ Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VERSION BLOCK ─────────────────────────────────────────────────────────────

function VersionBlock({ version, master, p, isVersionExpanded, onToggleVersion, personas, apiKey,
  onUpdateVersion, addingTakeTo, setAddingTakeTo, takeForm, setTakeForm,
  onAddTake, onUpdateTake, onSetPrimary, onDeleteVersion, onDeleteTake, savePersonas, flash }) {

  const [editingVersion, setEditingVersion] = useState(false);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [paAnalyzing, setPaAnalyzing] = useState(false);
  const [paSuggestion, setPaSuggestion] = useState(null);
  const [paError, setPaError] = useState('');
  const [paHovered, setPaHovered] = useState(null);
  const [vEditForm, setVEditForm] = useState({
    label: version.label||'', persona: version.persona||'',
    stylePrompt: version.takes?.[0]?.stylePrompt||'',
    genre: version.genre||'', mood: version.mood||'',
    instrumentalMood: version.instrumentalMood||'',
    targetAudience: version.targetAudience||'',
    duration: version.duration||'',
    versionSummary: version.versionSummary||'',
    albumNote: version.albumNote||'',
    themes: (version.themes||[]).join(', '),
    bpm: version.bpm||'',
    musicalKey: version.musicalKey||'',
    runtime: version.runtime||'',
    syncAvailable: version.syncAvailable||'',
    proStatus: version.proStatus||'',
  });

  const sel = { background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'8px 10px', fontSize:12, outline:'none', width:'100%' };

  return (
    <div style={{ marginBottom:10, border:`1px solid ${p.color}22`, borderRadius:5, overflow:'hidden' }}>
      <div style={{ background:'#0f0f0f', borderLeft:`3px solid ${p.color}` }}>
        <div onClick={onToggleVersion} style={{ padding:'11px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:p.color, letterSpacing:'0.1em', marginBottom:3 }}>{version.label} · {p.name}</div>
            <div style={{ fontSize:11, color:'#bbb', fontStyle:'italic' }}>{version.genre}</div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {version.takes?.[0] && <StagePill take={version.takes.find(t=>t.isPrimary)||version.takes[0]} masterLyrics={master.lyrics} />}
            {version.takes?.[0] && <StatusBadge status={(version.takes.find(t=>t.isPrimary)||version.takes[0]).releaseStatus} />}
            {(() => {
              const t0 = version.takes?.[0] || {};
              const autos = [!!(t0.sunoUrl?.trim()), !!(version.genre && version.mood && version.themes?.length > 0), !!(master.lyrics?.trim())];
              const manuals = [version.releaseChecklist?.listened, version.releaseChecklist?.coverArt, version.releaseChecklist?.audioDownloaded];
              const done = [...autos, ...manuals].filter(Boolean).length;
              const all = done === 6;
              const dk = version.distrokid || {};
              const isLive = !!(dk.spotifyUrl?.trim());
              const isSubmitted = !!(dk.submittedDate?.trim());
              const releaseDate = dk.releaseDate?.trim();
              if (isLive) return (
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:3, background:'#1a3a1a', border:'1px solid #34D399', color:'#34D399', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>🟢 Live</span>
              );
              if (isSubmitted && releaseDate) return (
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:3, background:'#1a2a3a', border:'1px solid #5B8DD9', color:'#5B8DD9', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>📅 {releaseDate}</span>
              );
              if (isSubmitted) return (
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:3, background:'#1a2a3a', border:'1px solid #5B8DD9', color:'#5B8DD9', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>📬 Submitted</span>
              );
              return (
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:3,
                               background: all ? '#34D39922' : '#1a1a1a',
                               border: `1px solid ${all ? '#34D399' : '#2a2a2a'}`,
                               color: all ? '#34D399' : '#666',
                               letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                  {all ? '✓ Ready' : `${done}/6`}
                </span>
              );
            })()}
            <button onClick={e=>{ e.stopPropagation(); setQuickAssignOpen(o=>!o); }}
              style={{ background: quickAssignOpen ? `${p.color}22` : 'transparent', border:`1px solid ${quickAssignOpen ? p.color : '#333'}`,
                       borderRadius:3, color: quickAssignOpen ? p.color : '#888', padding:'3px 9px', fontSize:10,
                       cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
              ⤷ Persona
            </button>
            <span style={{ color:'#999', fontSize:12 }}>{isVersionExpanded?'▲':'▼'}</span>
          </div>
        </div>
        {quickAssignOpen && (
          <div style={{ padding:'12px 14px 14px', borderTop:`1px solid ${p.color}22`, background:'#0c0c0c' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:9, letterSpacing:'0.25em', color:'#555', textTransform:'uppercase' }}>Assign Persona — {version.label}</div>
              {apiKey && !paAnalyzing && (
                <button onClick={async ()=>{
                  setPaAnalyzing(true); setPaSuggestion(null); setPaError('');
                  try {
                    const stylePrompt = version.takes?.[0]?.stylePrompt || '';
                    const result = await analyzeWithAI(master.title, stylePrompt, master.lyrics||'', apiKey, personas);
                    setPaSuggestion(result);
                  } catch(e) { setPaError(e.message); }
                  setPaAnalyzing(false);
                }}
                  style={{ background:'transparent', border:'1px solid #333', borderRadius:3, color:'#C8942A', padding:'3px 10px', fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>
                  ✨ Analyze with AI
                </button>
              )}
            </div>
            {paAnalyzing && <div style={{ fontSize:11, color:'#777', marginBottom:10 }}>✨ Analyzing song…</div>}
            {paError && <div style={{ fontSize:11, color:'#c55', marginBottom:10 }}>{paError}</div>}
            {paSuggestion && (
              <>
                <div style={{ background:'#0f0f0f', border:'1px solid #222', borderRadius:4, padding:'8px 12px', marginBottom:8 }}>
                  <span style={{ fontSize:10, color:'#aaa' }}>AI suggests: </span>
                  <span style={{ fontSize:11, color: getP(paSuggestion.suggestedPersona, personas).color, fontWeight:600 }}>
                    {getP(paSuggestion.suggestedPersona, personas).name}
                  </span>
                  {paSuggestion.personaReason && <div style={{ fontSize:11, color:'#777', marginTop:4, fontStyle:'italic' }}>{paSuggestion.personaReason}</div>}
                </div>
                {paSuggestion.suggestNewPersona && paSuggestion.suggestedNewPersonaName && (
                  <div style={{ background:'#0f1a0f', border:'1px solid #1a4a1a', borderRadius:4, padding:'10px 12px', marginBottom:8 }}>
                    <div style={{ fontSize:10, letterSpacing:'0.15em', color:'#34D399', textTransform:'uppercase', marginBottom:4 }}>💡 New Persona Suggested</div>
                    <div style={{ fontSize:12, color:'#ccc', marginBottom:3 }}><strong style={{color:'#34D399'}}>{paSuggestion.suggestedNewPersonaName}</strong> — {paSuggestion.suggestedNewPersonaGenre}</div>
                    <div style={{ fontSize:11, color:'#666', marginBottom:8 }}>{paSuggestion.suggestedNewPersonaDesc}</div>
                    <button onClick={()=>{
                      const newP = { id:'persona-'+Math.random().toString(36).slice(2)+Date.now().toString(36), name:paSuggestion.suggestedNewPersonaName,
                        genre:paSuggestion.suggestedNewPersonaGenre, desc:paSuggestion.suggestedNewPersonaDesc,
                        color: PERSONA_COLORS[personas.length % PERSONA_COLORS.length] };
                      savePersonas([...personas, newP]);
                      flash('✓ New persona added — select it below');
                    }} style={{ background:'#1a4a1a', border:'1px solid #2a6a2a', borderRadius:3, color:'#34D399', padding:'5px 12px', fontSize:10, cursor:'pointer' }}>
                      + Add This Persona
                    </button>
                  </div>
                )}
              </>
            )}
            {paHovered && (
              <div style={{ background:'#111', border:`1px solid ${paHovered.color}44`, borderRadius:4, padding:'10px 12px', marginBottom:10 }}>
                <div style={{ fontSize:12, color:paHovered.color, fontWeight:600, marginBottom:2 }}>{paHovered.name}</div>
                <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>{paHovered.genre}</div>
                <div style={{ fontSize:11, color:'#666', marginBottom:10 }}>{paHovered.desc}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>{ onUpdateVersion(master.id, version.id, { persona:paHovered.id }); setQuickAssignOpen(false); setPaSuggestion(null); setPaHovered(null); }}
                    style={{ flex:1, background:paHovered.color, border:'none', borderRadius:3, color:'#000', padding:'7px 0', fontSize:11, fontWeight:600, cursor:'pointer', letterSpacing:'0.05em' }}>
                    ✓ Assign to {paHovered.name}
                  </button>
                  <button onClick={()=>setPaHovered(null)}
                    style={{ background:'transparent', border:'1px solid #333', borderRadius:3, color:'#666', padding:'7px 12px', fontSize:11, cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {personas.map(p2=>{
                const isCurrent = version.persona===p2.id;
                const isSuggested = paSuggestion?.suggestedPersona===p2.id;
                const isHovered = paHovered?.id===p2.id;
                return (
                  <button key={p2.id} onClick={()=>setPaHovered(p2)}
                    style={{ background: (isCurrent||isSuggested||isHovered) ? `${p2.color}33` : 'transparent',
                             border:`1px solid ${(isCurrent||isSuggested||isHovered) ? p2.color : '#2a2a2a'}`,
                             borderRadius:4, color: (isCurrent||isSuggested||isHovered) ? p2.color : '#aaa',
                             padding:'6px 13px', fontSize:11, cursor:'pointer', textAlign:'left',
                             fontWeight: (isCurrent||isSuggested||isHovered) ? 600 : 400 }}>
                    <div>{isCurrent ? '✓ ' : isSuggested ? '★ ' : ''}{p2.name}</div>
                    <div style={{ fontSize:9, opacity:0.6, fontWeight:400 }}>{p2.genre}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isVersionExpanded && (
        <div style={{ background:'#0a0a0a', borderTop:'1px solid #141414', padding:'14px' }}>

          {!editingVersion ? (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                {(version.themes||[]).map(t=><Tag key={t} label={t} color={p.color+'99'} />)}
                {version.mood && <Tag label={version.mood} />}
                {version.instrumentalMood && <Tag label={version.instrumentalMood} />}
                {version.targetAudience && <Tag label={version.targetAudience} />}
                {version.duration && <Tag label={version.duration} />}
              </div>
              {version.versionSummary && <div style={{ fontSize:12, color:'#bbb', lineHeight:1.7, marginBottom:8 }}>{version.versionSummary}</div>}
              {version.albumNote && <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic', marginBottom:12 }}>📀 {version.albumNote}</div>}
              {/* Release Checklist */}
              {(() => {
                const t0 = version.takes?.[0] || {};
                const checks = [
                  { key:'auto-url',         label:'Suno URL present',       auto:true,  done: !!(t0.sunoUrl?.trim()) },
                  { key:'auto-meta',        label:'Metadata complete',      auto:true,  done: !!(version.genre && version.mood && version.themes?.length > 0) },
                  { key:'auto-lyrics',      label:'Lyrics added',           auto:true,  done: !!(master.lyrics?.trim()) },
                  { key:'listened',         label:'Listened end-to-end',    auto:false, done: !!(version.releaseChecklist?.listened) },
                  { key:'coverArt',         label:'Cover art ready',        auto:false, done: !!(version.releaseChecklist?.coverArt) },
                  { key:'audioDownloaded',  label:'Audio file downloaded',  auto:false, done: !!(version.releaseChecklist?.audioDownloaded) },
                ];
                const doneCount = checks.filter(c=>c.done).length;
                const allDone = doneCount === 6;
                return (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#555', textTransform:'uppercase', marginBottom:7 }}>Release Checklist</div>
                    <div style={{ background:'#0c0c0c', border:`1px solid ${allDone?'#34D39933':'#1e1e1e'}`, borderRadius:5, padding:'10px 12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:11, color:allDone?'#34D399':'#888' }}>
                          {allDone ? '✓ Ready to Submit' : `${doneCount} of 6 complete`}
                        </span>
                        {allDone && <span style={{ fontSize:9, color:'#34D399', letterSpacing:'0.15em', textTransform:'uppercase' }}>DistroKid Ready</span>}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                        {checks.map(c=>(
                          <div key={c.key}
                            onClick={()=>{
                              if (!c.auto) {
                                const cur = version.releaseChecklist || {};
                                onUpdateVersion(master.id, version.id, { releaseChecklist:{ ...cur, [c.key]: !cur[c.key] } });
                              }
                            }}
                            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 7px', borderRadius:3,
                                     background:c.done?'#0f1a0f':'#0a0a0a',
                                     border:`1px solid ${c.done?'#34D39933':'#1a1a1a'}`,
                                     cursor:c.auto?'default':'pointer' }}>
                            <span style={{ fontSize:12, lineHeight:1, flexShrink:0 }}>{c.done?'✅':'⬜'}</span>
                            <span style={{ fontSize:10, color:c.done?'#34D399':'#888', flex:1 }}>{c.label}</span>
                            {c.auto && <span style={{ fontSize:8, color:'#333' }}>auto</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* DistroKid Submission Tracker */}
              {(() => {
                const t0 = version.takes?.[0] || {};
                const autos = [!!(t0.sunoUrl?.trim()), !!(version.genre && version.mood && version.themes?.length > 0), !!(master.lyrics?.trim())];
                const manuals = [version.releaseChecklist?.listened, version.releaseChecklist?.coverArt, version.releaseChecklist?.audioDownloaded];
                const checklistDone = [...autos, ...manuals].filter(Boolean).length === 6;
                const dk = version.distrokid || {};
                const [dkOpen, setDkOpen] = React.useState(false);
                const [dkForm, setDkForm] = React.useState({
                  submittedDate: dk.submittedDate||'',
                  releaseDate: dk.releaseDate||'',
                  hyperFollowUrl: dk.hyperFollowUrl||'',
                  spotifyUrl: dk.spotifyUrl||'',
                });
                const isLive = !!(dk.spotifyUrl?.trim());
                const isSubmitted = !!(dk.submittedDate?.trim());
                const fi2 = { background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:3, color:'#e8dcc8', padding:'6px 9px', fontSize:11, outline:'none', width:'100%' };
                const saveDk = () => {
                  onUpdateVersion(master.id, version.id, { distrokid: dkForm });
                  setDkOpen(false);
                };
                return (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#555', textTransform:'uppercase', marginBottom:7 }}>DistroKid</div>
                    <div style={{ background:'#0c0c0c', border:`1px solid ${isLive?'#34D39933':isSubmitted?'#5B8DD933':'#1e1e1e'}`, borderRadius:5, padding:'10px 12px' }}>
                      {/* Status row */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dkOpen ? 10 : 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {isLive ? (
                            <span style={{ fontSize:11, color:'#34D399' }}>🟢 Live on Spotify</span>
                          ) : isSubmitted ? (
                            <span style={{ fontSize:11, color:'#5B8DD9' }}>📬 Submitted{dk.releaseDate ? ` · Releasing ${dk.releaseDate}` : ''}</span>
                          ) : checklistDone ? (
                            <span style={{ fontSize:11, color:'#C8942A' }}>✓ Checklist complete — ready to submit</span>
                          ) : (
                            <span style={{ fontSize:11, color:'#444' }}>Complete checklist before submitting</span>
                          )}
                        </div>
                        <button onClick={()=>{ setDkForm({ submittedDate:dk.submittedDate||'', releaseDate:dk.releaseDate||'', hyperFollowUrl:dk.hyperFollowUrl||'', spotifyUrl:dk.spotifyUrl||'' }); setDkOpen(o=>!o); }}
                          style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#888', padding:'3px 9px', fontSize:10, cursor:'pointer' }}>
                          {dkOpen ? 'Cancel' : isSubmitted ? '✎ Edit' : '+ Log Submission'}
                        </button>
                      </div>
                      {/* Quick-view links when not editing */}
                      {!dkOpen && (dk.hyperFollowUrl||dk.spotifyUrl) && (
                        <div style={{ display:'flex', gap:10, marginTop:8 }}>
                          {dk.hyperFollowUrl && <a href={dk.hyperFollowUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#C8942A' }}>🔗 HyperFollow</a>}
                          {dk.spotifyUrl && <a href={dk.spotifyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#34D399' }}>🎧 Spotify</a>}
                        </div>
                      )}
                      {/* Edit form */}
                      {dkOpen && (
                        <div style={{ display:'grid', gap:8 }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            <div><label style={{ fontSize:9, letterSpacing:'0.12em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:3 }}>Submitted Date</label>
                              <input value={dkForm.submittedDate} onChange={e=>setDkForm(f=>({...f,submittedDate:e.target.value}))} placeholder="YYYY-MM-DD" style={fi2} /></div>
                            <div><label style={{ fontSize:9, letterSpacing:'0.12em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:3 }}>Release Date</label>
                              <input value={dkForm.releaseDate} onChange={e=>setDkForm(f=>({...f,releaseDate:e.target.value}))} placeholder="YYYY-MM-DD" style={fi2} /></div>
                          </div>
                          <div><label style={{ fontSize:9, letterSpacing:'0.12em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:3 }}>HyperFollow URL</label>
                            <input value={dkForm.hyperFollowUrl} onChange={e=>setDkForm(f=>({...f,hyperFollowUrl:e.target.value}))} placeholder="https://distrokid.com/hyperfollow/…" style={fi2} /></div>
                          <div><label style={{ fontSize:9, letterSpacing:'0.12em', color:'#aaa', textTransform:'uppercase', display:'block', marginBottom:3 }}>Spotify URL (once live)</label>
                            <input value={dkForm.spotifyUrl} onChange={e=>setDkForm(f=>({...f,spotifyUrl:e.target.value}))} placeholder="https://open.spotify.com/track/…" style={fi2} /></div>
                          <button onClick={saveDk} style={{ background:'linear-gradient(135deg,#5B8DD9,#3a6ab0)', border:'none', borderRadius:3, color:'#fff', padding:'7px 0', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                            ✓ Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              <button onClick={()=>{ setVEditForm({ label:version.label||'', persona:version.persona||'',
                stylePrompt:version.takes?.[0]?.stylePrompt||'', genre:version.genre||'',
                mood:version.mood||'', instrumentalMood:version.instrumentalMood||'',
                targetAudience:version.targetAudience||'', duration:version.duration||'',
                versionSummary:version.versionSummary||'', albumNote:version.albumNote||'',
                themes:(version.themes||[]).join(', '),
                bpm:version.bpm||'', musicalKey:version.musicalKey||'',
                runtime:version.runtime||'', syncAvailable:version.syncAvailable||'',
                proStatus:version.proStatus||'' }); setEditingVersion(true); }}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'4px 12px', fontSize:10, cursor:'pointer', marginBottom:14 }}>
                ✎ Edit Version Details
              </button>
            </>
          ) : (
            <div style={{ background:'#111', border:'1px solid #252525', borderRadius:5, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:12 }}>Edit Version Details</div>
              <div style={{ display:'grid', gap:10, marginBottom:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={lBase}>Version Label</label>
                    <input value={vEditForm.label} onChange={e=>setVEditForm(f=>({...f,label:e.target.value}))} style={iBase} /></div>
                  <div><label style={lBase}>Persona</label>
                    <select value={vEditForm.persona} onChange={e=>setVEditForm(f=>({...f,persona:e.target.value}))} style={sel}>
                      {personas.map(p2=><option key={p2.id} value={p2.id}>{p2.name} — {p2.genre}</option>)}
                    </select></div>
                </div>
                <div><label style={lBase}>Style Prompt</label>
                  <textarea value={vEditForm.stylePrompt} onChange={e=>setVEditForm(f=>({...f,stylePrompt:e.target.value}))} rows={3}
                    placeholder="The Suno style prompt…" style={{ ...iBase, resize:'vertical', lineHeight:1.6 }} /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={lBase}>Genre</label>
                    <input value={vEditForm.genre} onChange={e=>setVEditForm(f=>({...f,genre:e.target.value}))} style={iBase} /></div>
                  <div><label style={lBase}>Mood</label>
                    <select value={vEditForm.mood} onChange={e=>setVEditForm(f=>({...f,mood:e.target.value}))} style={sel}>
                      <option value="">—</option>
                      {['Hopeful','Mournful','Triumphant','Contemplative','Urgent','Joyful','Raw','Tender','Epic','Defiant'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={lBase}>Instrumental Mood</label>
                    <select value={vEditForm.instrumentalMood} onChange={e=>setVEditForm(f=>({...f,instrumentalMood:e.target.value}))} style={sel}>
                      <option value="">—</option>
                      {['Sparse','Orchestral','Driving','Ambient','Acoustic','Electronic','Big Band','Stripped','Choir-led','Rhythm-heavy','Cinematic'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select></div>
                  <div><label style={lBase}>Target Audience</label>
                    <select value={vEditForm.targetAudience} onChange={e=>setVEditForm(f=>({...f,targetAudience:e.target.value}))} style={sel}>
                      <option value="">—</option>
                      {['General','Young Adults','Elderly Listeners','Congregation','Seekers','Families','Men','Women','Youth'].map(a=><option key={a} value={a}>{a}</option>)}
                    </select></div>
                </div>
                <div><label style={lBase}>Duration</label>
                  <select value={vEditForm.duration} onChange={e=>setVEditForm(f=>({...f,duration:e.target.value}))} style={sel}>
                    <option value="">—</option>
                    {['Short (under 2 min)','Standard (2-4 min)','Extended (4+ min)'].map(d=><option key={d} value={d}>{d}</option>)}
                  </select></div>
                <div><label style={lBase}>Themes (comma-separated)</label>
                  <input value={vEditForm.themes} onChange={e=>setVEditForm(f=>({...f,themes:e.target.value}))}
                    placeholder="Faith, Hope, Journey…" style={iBase} /></div>
                <div><label style={lBase}>Version Summary</label>
                  <textarea value={vEditForm.versionSummary} onChange={e=>setVEditForm(f=>({...f,versionSummary:e.target.value}))} rows={2}
                    style={{ ...iBase, resize:'vertical', lineHeight:1.6 }} /></div>
                <div><label style={lBase}>Album Note</label>
                  <input value={vEditForm.albumNote} onChange={e=>setVEditForm(f=>({...f,albumNote:e.target.value}))} style={iBase} /></div>
                <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:10, marginTop:2 }}>
                  <div style={{ fontSize:9, letterSpacing:'0.25em', color:'#666', textTransform:'uppercase', marginBottom:10 }}>Industry Metadata (for exports)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                    <div><label style={lBase}>BPM</label>
                      <input value={vEditForm.bpm} onChange={e=>setVEditForm(f=>({...f,bpm:e.target.value}))} placeholder="e.g. 120" style={iBase} /></div>
                    <div><label style={lBase}>Key</label>
                      <input value={vEditForm.musicalKey} onChange={e=>setVEditForm(f=>({...f,musicalKey:e.target.value}))} placeholder="e.g. C Major" style={iBase} /></div>
                    <div><label style={lBase}>Runtime</label>
                      <input value={vEditForm.runtime} onChange={e=>setVEditForm(f=>({...f,runtime:e.target.value}))} placeholder="e.g. 3:24" style={iBase} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={lBase}>Sync Availability</label>
                      <select value={vEditForm.syncAvailable} onChange={e=>setVEditForm(f=>({...f,syncAvailable:e.target.value}))} style={sel}>
                        <option value="">—</option>
                        {['Available','Exclusive','Pending','Not Available'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select></div>
                    <div><label style={lBase}>PRO Status</label>
                      <select value={vEditForm.proStatus} onChange={e=>setVEditForm(f=>({...f,proStatus:e.target.value}))} style={sel}>
                        <option value="">—</option>
                        {['Registered','Pending','Not Registered'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select></div>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setEditingVersion(false)} style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#aaa', padding:'8px 16px', fontSize:11, cursor:'pointer' }}>Cancel</button>
                <button onClick={()=>{
                  const themes = vEditForm.themes.split(',').map(t=>t.trim()).filter(Boolean);
                  onUpdateVersion(master.id, version.id, { label:vEditForm.label, persona:vEditForm.persona,
                    genre:vEditForm.genre, mood:vEditForm.mood, instrumentalMood:vEditForm.instrumentalMood,
                    targetAudience:vEditForm.targetAudience, duration:vEditForm.duration, themes,
                    versionSummary:vEditForm.versionSummary, albumNote:vEditForm.albumNote,
                    bpm:vEditForm.bpm, musicalKey:vEditForm.musicalKey, runtime:vEditForm.runtime,
                    syncAvailable:vEditForm.syncAvailable, proStatus:vEditForm.proStatus,
                    takes: version.takes.map((t,i)=>i===0?{...t,stylePrompt:vEditForm.stylePrompt}:t) });
                  setEditingVersion(false);
                }} style={{ flex:1, background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:3, color:'#fff', padding:'8px 0', fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer' }}>
                  ✓ Save Version
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#999', textTransform:'uppercase', marginBottom:8 }}>Takes</div>
          {(version.takes||[]).map(take=>{
            const effStage = effectiveStage(take, master.lyrics);
            const isAutoDetected = (!take.stage || (take.stage !== 'reviewing' && take.stage !== 'final')) && effStage !== take.stage;
            return (
            <TakeBlock key={take.id} take={take} master={master} version={version} p={p}
              effStage={effStage} isAutoDetected={isAutoDetected}
              onUpdateTake={onUpdateTake} onSetPrimary={onSetPrimary} onDeleteTake={onDeleteTake}
            />
          )})}

          {addingTakeTo?.masterId===master.id && addingTakeTo?.versionId===version.id ? (
            <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:4, padding:12, marginTop:6 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <input placeholder="Take label" value={takeForm.label} onChange={e=>setTakeForm(f=>({...f,label:e.target.value}))}
                  style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:12, outline:'none' }} />
                <input placeholder="Suno URL" value={takeForm.sunoUrl} onChange={e=>setTakeForm(f=>({...f,sunoUrl:e.target.value}))}
                  style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:3, color:'#e8dcc8', padding:'7px 10px', fontSize:12, outline:'none' }} />
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>onAddTake(master.id,version.id)} style={{ background:'#141414', border:'1px solid #C8942A', borderRadius:3, color:'#C8942A', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>Add Take</button>
                <button onClick={()=>setAddingTakeTo(null)} style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#bbb', padding:'7px 12px', fontSize:11, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAddingTakeTo({masterId:master.id,versionId:version.id})}
              style={{ background:'transparent', border:'1px solid #1e1e1e', borderRadius:3, color:'#999', padding:'6px 12px', fontSize:11, cursor:'pointer', marginTop:4 }}>
              + Add Take
            </button>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12, paddingTop:10, borderTop:'1px solid #141414' }}>
            <button onClick={()=>onDeleteVersion(master.id,version.id)}
              style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#6a2a2a', padding:'5px 12px', fontSize:10, cursor:'pointer' }}>
              Delete Version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MASTER ROW ────────────────────────────────────────────────────────────────

export default function MasterRow({ master, personas, apiKey, expanded, onToggle, expandedVersion, setExpandedVersion,
  addingVersionTo, setAddingVersionTo, addVersionForm, setAddVersionForm,
  addVersionAnalyzing, addVersionConfirming, addVersionAnalysis,
  onAddVersionAnalyze, onAddVersionConfirm, setAddVersionConfirming,
  addingTakeTo, setAddingTakeTo, takeForm, setTakeForm, onAddTake,
  onUpdateTake, onSetPrimary, onUpdateMaster, onUpdateVersion, onDeleteMaster, onDeleteVersion, onDeleteTake, savePersonas, flash }) {

  const [editingMaster, setEditingMaster] = useState(false);
  const [editForm, setEditForm] = useState({ title:master.title, lyrics:master.lyrics||'', notes:master.notes||'' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top:0, right:0 });
  const listenBtnRef = useRef(null);

  const topPersonas = [...new Set((master.versions||[]).map(v=>v.persona))].slice(0,3);
  const primaryTakes = (master.versions||[]).map(v=>(v.takes||[]).find(t=>t.isPrimary)||(v.takes||[])[0]).filter(Boolean);
  const firstPersonaColor = getP((master.versions||[])[0]?.persona||'', personas).color || '#333';

  const handleListen = (take) => {
    setPickerOpen(false);
    if (take.sunoUrl) window.open(take.sunoUrl, '_blank', 'noopener,noreferrer');
  };

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e) => {
      if (listenBtnRef.current && !listenBtnRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  return (
    <div style={{ marginBottom:8, border:'1px solid #1a1a1a', borderRadius:6, overflow:'hidden' }}>

      {/* Header row */}
      <div onClick={onToggle} style={{ background:expanded?'#0f0f0f':'#0a0a0a', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderLeft:`3px solid ${firstPersonaColor}` }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:'#f0e8d8', marginBottom:4 }}>{master.title}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {topPersonas.map(pid=>{ const p=getP(pid,personas); return <span key={pid} style={{ fontSize:10, color:p.color, letterSpacing:'0.1em' }}>{p.name}</span>; })}
            <span style={{ fontSize:10, color:'#999' }}>·</span>
            <span style={{ fontSize:10, color:'#aaa' }}>{master.versions?.length||0} version{(master.versions?.length||0)!==1?'s':''}</span>
            {master.addedAt && <><span style={{ fontSize:10, color:'#444' }}>·</span><span style={{ fontSize:10, color:'#444' }}>{fmtDate(master.addedAt)}</span></>}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          {primaryTakes.slice(0,2).map(t=><StagePill key={t.id} take={t} masterLyrics={master.lyrics} />)}

          {/* Listen button */}
          {primaryTakes.length > 0 && (
            <div ref={listenBtnRef} style={{ position:'relative' }}>
              <button
                onClick={e=>{ e.stopPropagation();
                  if (primaryTakes.length === 1) { handleListen(primaryTakes[0]); }
                  else {
                    if (!pickerOpen) {
                      const rect = listenBtnRef.current.getBoundingClientRect();
                      setPickerPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                    }
                    setPickerOpen(o=>!o);
                  }
                }}
                title="Open on Suno"
                style={{ background:pickerOpen?'#C8942A22':'transparent',
                         border:`1px solid ${pickerOpen?'#C8942A':'#333'}`,
                         borderRadius:3, color:pickerOpen?'#C8942A':'#888',
                         padding:'3px 9px', fontSize:13, cursor:'pointer', lineHeight:1, userSelect:'none' }}>
                ▶
              </button>
              {pickerOpen && (
                <div style={{ position:'fixed', top:pickerPos.top, right:pickerPos.right,
                              background:'#111', border:'1px solid #2a2a2a', borderRadius:5,
                              boxShadow:'0 4px 20px rgba(0,0,0,0.8)', zIndex:1000, minWidth:180, padding:6 }}
                     onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
                  <div style={{ fontSize:9, letterSpacing:'0.15em', color:'#555', textTransform:'uppercase', marginBottom:6, paddingLeft:4 }}>Choose version</div>
                  {primaryTakes.map(t=>{
                    const ver = (master.versions||[]).find(v=>(v.takes||[]).some(tk=>tk.id===t.id));
                    const pp = getP(ver?.persona||'', personas);
                    return (
                      <button key={t.id} onClick={e=>{ e.stopPropagation(); handleListen(t); }}
                        style={{ display:'block', width:'100%', textAlign:'left', background:'transparent',
                                 border:'none', borderRadius:3, color:pp.color||'#bbb',
                                 padding:'7px 10px', fontSize:12, cursor:'pointer' }}>
                        <span style={{ marginRight:6, color:'#555' }}>▶</span>{ver?.label||pp.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <span style={{ color:'#999', fontSize:14 }}>{expanded?'▲':'▼'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ background:'#0d0d0d', borderTop:'1px solid #161616', padding:'16px 18px' }}>

          {/* Master edit */}
          {!editingMaster ? (
            <div style={{ marginBottom:14 }}>
              {master.notes && <div style={{ fontSize:12, color:'#bbb', fontStyle:'italic', marginBottom:8, lineHeight:1.6 }}>{master.notes}</div>}
              {master.lyrics ? (
                <details style={{ marginBottom:8 }}>
                  <summary style={{ fontSize:10, letterSpacing:'0.15em', color:'#aaa', textTransform:'uppercase', cursor:'pointer', userSelect:'none' }}>Lyrics ▸</summary>
                  <pre style={{ fontSize:12, color:'#bbb', lineHeight:1.8, whiteSpace:'pre-wrap', marginTop:8, fontFamily:'Georgia,serif' }}>{master.lyrics}</pre>
                </details>
              ) : (
                <div style={{ fontSize:11, color:'#ccc', fontStyle:'italic', marginBottom:8 }}>No lyrics added yet.</div>
              )}
              <button onClick={()=>{ setEditForm({title:master.title,lyrics:master.lyrics||'',notes:master.notes||''}); setEditingMaster(true); }}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'4px 12px', fontSize:10, cursor:'pointer', letterSpacing:'0.1em' }}>
                ✎ Edit Song Details
              </button>
            </div>
          ) : (
            <div style={{ background:'#111', border:'1px solid #252525', borderRadius:5, padding:16, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:12 }}>Edit Song Details</div>
              <div style={{ display:'grid', gap:10, marginBottom:14 }}>
                <div>
                  <label style={lBase}>Title</label>
                  <input value={editForm.title} onChange={e=>setEditForm(f=>({...f,title:e.target.value}))} style={iBase} />
                </div>
                <div>
                  <label style={lBase}>Lyrics</label>
                  <textarea value={editForm.lyrics} onChange={e=>setEditForm(f=>({...f,lyrics:e.target.value}))}
                    rows={14} placeholder="Paste full lyrics here…"
                    style={{ ...iBase, resize:'vertical', lineHeight:1.75, fontFamily:'Georgia,serif' }} />
                </div>
                <div>
                  <label style={lBase}>Story / Notes</label>
                  <textarea value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}
                    rows={3} placeholder="Context, inspiration, personal meaning…"
                    style={{ ...iBase, resize:'vertical', lineHeight:1.7 }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setEditingMaster(false)} style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#aaa', padding:'8px 16px', fontSize:11, cursor:'pointer' }}>Cancel</button>
                <button onClick={()=>{ onUpdateMaster(master.id,editForm); setEditingMaster(false); }} disabled={!editForm.title.trim()}
                  style={{ flex:1, background:editForm.title.trim()?'linear-gradient(135deg,#C8942A,#9a7018)':'#141414', border:'none', borderRadius:3,
                           color:editForm.title.trim()?'#fff':'#777', padding:'8px 0', fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer' }}>
                  ✓ Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Versions */}
          {(master.versions||[]).map(version => {
            const p = getP(version.persona, personas);
            const isVersionExpanded = expandedVersion===version.id;
            return (
              <VersionBlock key={version.id} version={version} master={master} p={p}
                isVersionExpanded={isVersionExpanded}
                onToggleVersion={()=>setExpandedVersion(isVersionExpanded?null:version.id)}
                personas={personas} apiKey={apiKey} onUpdateVersion={onUpdateVersion}
                addingTakeTo={addingTakeTo} setAddingTakeTo={setAddingTakeTo}
                takeForm={takeForm} setTakeForm={setTakeForm} onAddTake={onAddTake}
                onUpdateTake={onUpdateTake} onSetPrimary={onSetPrimary}
                onDeleteVersion={onDeleteVersion} onDeleteTake={onDeleteTake}
                savePersonas={savePersonas} flash={flash}
              />
            );
          })}

          {/* Add version */}
          {addingVersionTo===master.id ? (
            <AddVersionPanel master={master} personas={personas}
              form={addVersionForm} setForm={setAddVersionForm}
              analyzing={addVersionAnalyzing} confirming={addVersionConfirming} analysis={addVersionAnalysis}
              onAnalyze={()=>onAddVersionAnalyze(master)}
              onConfirm={(pid)=>onAddVersionConfirm(master.id,pid)}
              onBack={()=>setAddVersionConfirming(false)}
              onCancel={()=>{ setAddingVersionTo(null); setAddVersionConfirming(false); }}
            />
          ) : (
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={()=>setAddingVersionTo(master.id)}
                style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#bbb', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>
                + Add Version
              </button>
              <button onClick={()=>onDeleteMaster(master.id)}
                style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:4, color:'#6a2a2a', padding:'7px 14px', fontSize:11, cursor:'pointer', marginLeft:'auto' }}>
                Delete Song
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
