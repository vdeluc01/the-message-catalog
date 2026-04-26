export default function BatchAdd({ personas, batchSongs, setBatchSongs, batchStep, batchProgress, batchResults,
  onAnalyzeAll, onPersonaChange, onSaveAll, onReset, newBatchSong }) {

  const iB = { background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#e8dcc8', padding:'8px 11px', fontSize:12, outline:'none', width:'100%' };
  const lB = { display:'block', fontSize:9, letterSpacing:'0.18em', color:'#888', textTransform:'uppercase', marginBottom:5 };

  const addSong   = () => setBatchSongs(p => [...p, newBatchSong()]);
  const removeSong = (id) => setBatchSongs(p => p.filter(s => s.id !== id));
  const updateSong = (id, field, val) => setBatchSongs(p => p.map(s => s.id===id ? {...s,[field]:val} : s));

  const validCount = batchSongs.filter(s => s.title.trim()).length;

  // Input screen
  if (batchStep === 'input') return (
    <div style={{ padding:'24px', maxWidth:780, margin:'0 auto' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:6 }}>⚡ Batch Add Songs</div>
        <div style={{ fontSize:13, color:'#aaa', lineHeight:1.7 }}>
          Add up to 10 songs at once. For each song: paste the <strong style={{color:'#ccc'}}>title</strong>, <strong style={{color:'#ccc'}}>lyrics</strong> (copy from Suno's lyrics panel), and <strong style={{color:'#ccc'}}>style prompt</strong> (copy from Suno's edit screen). Suno link is optional. Hit Analyze All — AI fills in genre, themes, mood, audience, description, and suggests a persona for every song simultaneously. Then you review and save.
        </div>
      </div>

      <div style={{ display:'grid', gap:14, marginBottom:16 }}>
        {batchSongs.map((song, idx) => (
          <div key={song.id} style={{ background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:8, padding:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase' }}>Song {idx+1}</div>
              {batchSongs.length > 1 && (
                <button onClick={() => removeSong(song.id)}
                  style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#7a2020', padding:'3px 10px', fontSize:10, cursor:'pointer' }}>
                  Remove
                </button>
              )}
            </div>
            <div style={{ display:'grid', gap:10 }}>
              <div>
                <label style={lB}>Song Title *</label>
                <input value={song.title} onChange={e => updateSong(song.id,'title',e.target.value)}
                  placeholder="e.g. Heroes Unaware" style={iB} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lB}>Style Prompt (copy from Suno)</label>
                  <textarea value={song.stylePrompt} onChange={e => updateSong(song.id,'stylePrompt',e.target.value)}
                    rows={3} placeholder="americana folk, fingerpicked guitar, warm baritone…"
                    style={{ ...iB, resize:'vertical', lineHeight:1.6 }} />
                </div>
                <div>
                  <label style={lB}>Suno Link (optional)</label>
                  <input value={song.sunoUrl} onChange={e => updateSong(song.id,'sunoUrl',e.target.value)}
                    placeholder="https://suno.com/s/…" style={{ ...iB, marginBottom:8 }} />
                </div>
              </div>
              <div>
                <label style={lB}>Lyrics (paste from Suno — the more the better)</label>
                <textarea value={song.lyrics} onChange={e => updateSong(song.id,'lyrics',e.target.value)}
                  rows={4} placeholder="Paste full lyrics here…"
                  style={{ ...iB, resize:'vertical', lineHeight:1.8 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        {batchSongs.length < 10 && (
          <button onClick={addSong}
            style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#aaa', padding:'10px 18px', fontSize:12, cursor:'pointer', letterSpacing:'0.08em' }}>
            + Add Another Song
          </button>
        )}
        <button onClick={onAnalyzeAll} disabled={validCount === 0}
          style={{ flex:1, minWidth:200, background: validCount>0 ? 'linear-gradient(135deg,#C8942A,#9a7018)' : '#141414',
                   border:'none', borderRadius:4, color: validCount>0 ? '#fff' : '#666',
                   padding:'12px 0', fontSize:13, cursor: validCount>0 ? 'pointer' : 'default',
                   letterSpacing:'0.12em', textTransform:'uppercase' }}>
          🤖 Analyze {validCount > 0 ? `${validCount} Song${validCount!==1?'s':''}` : 'Songs'} with AI →
        </button>
      </div>
      {validCount === 0 && (
        <div style={{ fontSize:11, color:'#666', marginTop:8, textAlign:'center' }}>Enter at least one song title to continue</div>
      )}
    </div>
  );

  // Processing screen
  if (batchStep === 'processing') {
    const pct = batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0;
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', gap:20 }}>
        <div style={{ fontSize:36, opacity:0.6 }}>🤖</div>
        <div style={{ fontSize:14, color:'#ccc', letterSpacing:'0.1em' }}>
          Analyzing song {batchProgress.current} of {batchProgress.total}…
        </div>
        <div style={{ width:300, height:6, background:'#141414', borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#C8942A,#D4A84B)', borderRadius:3, transition:'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize:11, color:'#666' }}>{pct}% complete — please wait</div>
      </div>
    );
  }

  // Review screen
  if (batchStep === 'review') {
    const saved   = batchResults.filter(r => r.analysis && r.chosenPersona).length;
    const errored = batchResults.filter(r => r.error).length;
    return (
      <div style={{ padding:'24px', maxWidth:820, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:'0.3em', color:'#C8942A', textTransform:'uppercase', marginBottom:4 }}>Review AI Analysis</div>
            <div style={{ fontSize:12, color:'#aaa' }}>
              {saved} song{saved!==1?'s':''} ready to save{errored>0?` · ${errored} failed (check API key)`:''} — confirm or change personas, then save all.
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onReset}
              style={{ background:'transparent', border:'1px solid #252525', borderRadius:4, color:'#aaa', padding:'9px 16px', fontSize:11, cursor:'pointer' }}>
              ← Start Over
            </button>
            <button onClick={onSaveAll} disabled={saved === 0}
              style={{ background: saved>0 ? 'linear-gradient(135deg,#34D399,#1a9a6a)' : '#141414',
                       border:'none', borderRadius:4, color: saved>0 ? '#fff' : '#666',
                       padding:'9px 20px', fontSize:12, cursor: saved>0 ? 'pointer' : 'default',
                       letterSpacing:'0.1em', textTransform:'uppercase' }}>
              ✓ Save {saved} Song{saved!==1?'s':''} to Catalog
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gap:12 }}>
          {batchResults.map((r, idx) => {
            if (r.error) return (
              <div key={r.id} style={{ background:'#0f0f0f', border:'1px solid #2a1515', borderRadius:8, padding:16 }}>
                <div style={{ fontSize:13, color:'#C84A4A', marginBottom:4 }}>{r.title}</div>
                <div style={{ fontSize:11, color:'#7a2020' }}>Analysis failed: {r.error}</div>
              </div>
            );
            const a = r.analysis;
            const suggested = personas.find(p => p.id === a.suggestedPersona);
            const chosen    = personas.find(p => p.id === r.chosenPersona);
            return (
              <div key={r.id} style={{ background:'#0f0f0f', border:`1px solid ${chosen?.color||'#1e1e1e'}44`, borderLeft:`3px solid ${chosen?.color||'#C8942A'}`, borderRadius:8, padding:18 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, color:'#f0e6d0', marginBottom:4 }}>{r.title}</div>
                    <div style={{ fontSize:11, color:'#999', marginBottom:8 }}>{a.genre} · {a.mood} · {a.targetAudience} · {a.duration}</div>
                    <div style={{ fontSize:12, color:'#bbb', lineHeight:1.7, marginBottom:10 }}>{a.versionSummary}</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                      {(a.themes||[]).map(t=>(
                        <span key={t} style={{ background:'#141414', border:'1px solid #C8942A44', borderRadius:3, padding:'2px 8px', fontSize:10, color:'#C8942A88' }}>{t}</span>
                      ))}
                      {a.instrumentalMood && <span style={{ background:'#141414', border:'1px solid #333', borderRadius:3, padding:'2px 8px', fontSize:10, color:'#666' }}>{a.instrumentalMood}</span>}
                    </div>
                    {a.albumNote && <div style={{ fontSize:11, color:'#888', fontStyle:'italic' }}>📀 {a.albumNote}</div>}
                  </div>
                </div>

                <div style={{ borderTop:'1px solid #1a1a1a', paddingTop:12 }}>
                  <div style={{ fontSize:9, letterSpacing:'0.15em', color:'#888', textTransform:'uppercase', marginBottom:8 }}>
                    Assign to Persona {suggested && <span style={{ color:'#666', fontWeight:400, textTransform:'none', letterSpacing:0 }}>— AI suggests: <span style={{color:suggested.color}}>{suggested.name}</span></span>}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {personas.map(p => (
                      <button key={p.id} onClick={() => onPersonaChange(idx, p.id)}
                        style={{ background: r.chosenPersona===p.id ? `${p.color}22` : 'transparent',
                                 border: `1px solid ${r.chosenPersona===p.id ? p.color : '#252525'}`,
                                 borderRadius:4, color: r.chosenPersona===p.id ? p.color : '#888',
                                 padding:'5px 10px', fontSize:10, cursor:'pointer', transition:'all 0.15s' }}>
                          {p.name}
                        </button>
                    ))}
                    <button onClick={() => onPersonaChange(idx, '')}
                      style={{ background: !r.chosenPersona ? '#1a1a1a' : 'transparent',
                               border: `1px solid ${!r.chosenPersona ? '#555' : '#1e1e1e'}`,
                               borderRadius:4, color: !r.chosenPersona ? '#ccc' : '#444',
                               padding:'5px 10px', fontSize:10, cursor:'pointer' }}>
                      Unassigned
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={onSaveAll} disabled={saved === 0}
            style={{ background: saved>0 ? 'linear-gradient(135deg,#34D399,#1a9a6a)' : '#141414',
                     border:'none', borderRadius:4, color: saved>0 ? '#fff' : '#666',
                     padding:'12px 28px', fontSize:13, cursor: saved>0 ? 'pointer' : 'default',
                     letterSpacing:'0.12em', textTransform:'uppercase' }}>
            ✓ Save {saved} Song{saved!==1?'s':''} to Catalog
          </button>
        </div>
      </div>
    );
  }

  return null;
}
