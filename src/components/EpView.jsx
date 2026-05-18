import { useState } from 'react';
import { uid, getP, iBase, lBase } from '../utils.js';
import { EP_STATUSES } from '../constants.js';

const sel = { background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:4, color:'#aaa', padding:'9px 12px', fontSize:13, outline:'none', width:'100%' };

function statusBadge(statusId) {
  const s = EP_STATUSES.find(x=>x.id===statusId) || EP_STATUSES[0];
  return (
    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:3, background:`${s.color}18`, border:`1px solid ${s.color}55`, color:s.color, letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  );
}

// ── EP CARD (collapsed list row) ─────────────────────────────────────────
function EpRow({ ep, personas, masters, expanded, onToggle, onUpdate, onDelete }) {
  const p = getP(ep.persona, personas);
  const trackCount = (ep.tracks||[]).length;
  const isrcCount  = (ep.tracks||[]).filter(t=>t.isrc?.trim()).length;
  return (
    <div style={{ marginBottom:8, border:`1px solid ${p.color}33`, borderLeft:`3px solid ${p.color}`, borderRadius:6, overflow:'hidden' }}>
      <div onClick={onToggle} style={{ background:expanded?'#0f0f0f':'#0a0a0a', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:'#f0e8d8', marginBottom:4 }}>{ep.name}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:10, color:p.color, letterSpacing:'0.1em' }}>{p.name}</span>
            <span style={{ fontSize:10, color:'#444' }}>·</span>
            <span style={{ fontSize:10, color:'#aaa' }}>{trackCount} track{trackCount!==1?'s':''}</span>
            {ep.releaseDate && <><span style={{ fontSize:10, color:'#444' }}>·</span><span style={{ fontSize:10, color:'#aaa' }}>{ep.releaseDate}</span></>}
            {ep.upc && <><span style={{ fontSize:10, color:'#444' }}>·</span><span style={{ fontSize:10, color:'#666' }}>UPC {ep.upc}</span></>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {trackCount>0 && (
            <span title="EP tracks with ISRC captured" style={{ fontSize:10, color: isrcCount===trackCount?'#34D399':'#C8942A', letterSpacing:'0.05em' }}>
              {isrcCount}/{trackCount} ISRC
            </span>
          )}
          {statusBadge(ep.status)}
          <span style={{ color:'#999', fontSize:12 }}>{expanded?'▲':'▼'}</span>
        </div>
      </div>
      {expanded && (
        <EpDetail ep={ep} personas={personas} masters={masters} onUpdate={onUpdate} onDelete={onDelete} />
      )}
    </div>
  );
}

// ── EP DETAIL + EDIT ─────────────────────────────────────────────────────
function EpDetail({ ep, personas, masters, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name:           ep.name||'',
    persona:        ep.persona||'',
    releaseDate:    ep.releaseDate||'',
    upc:            ep.upc||'',
    hyperFollowUrl: ep.hyperFollowUrl||'',
    spotifyUrl:     ep.spotifyUrl||'',
    appleMusicUrl:  ep.appleMusicUrl||'',
    status:         ep.status||'upcoming',
    notes:          ep.notes||'',
    tracks:         (ep.tracks||[]).map(t=>({...t})),
  });

  const startEdit = () => {
    setForm({
      name:ep.name||'', persona:ep.persona||'', releaseDate:ep.releaseDate||'', upc:ep.upc||'',
      hyperFollowUrl:ep.hyperFollowUrl||'', spotifyUrl:ep.spotifyUrl||'', appleMusicUrl:ep.appleMusicUrl||'',
      status:ep.status||'upcoming', notes:ep.notes||'',
      tracks:(ep.tracks||[]).map(t=>({...t})),
    });
    setEditing(true);
  };

  const save = () => {
    onUpdate(ep.id, {
      ...form,
      tracks: form.tracks
        .filter(t=>t.masterId && t.versionId)
        .map((t,i)=>({ masterId:t.masterId, versionId:t.versionId, trackNumber: t.trackNumber || (i+1), isrc: (t.isrc||'').trim() }))
        .sort((a,b)=>(a.trackNumber||0)-(b.trackNumber||0)),
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={{ background:'#0a0a0a', borderTop:'1px solid #141414', padding:'16px 18px' }}>
        {ep.notes && <div style={{ fontSize:12, color:'#bbb', fontStyle:'italic', marginBottom:10, lineHeight:1.7 }}>{ep.notes}</div>}
        <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:12 }}>
          {ep.hyperFollowUrl && <a href={ep.hyperFollowUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#C8942A' }}>🔗 HyperFollow</a>}
          {ep.spotifyUrl     && <a href={ep.spotifyUrl}     target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#34D399' }}>🎧 Spotify</a>}
          {ep.appleMusicUrl  && <a href={ep.appleMusicUrl}  target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#5B8DD9' }}>🍎 Apple Music</a>}
        </div>
        <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#999', textTransform:'uppercase', marginBottom:8 }}>Tracklist</div>
        {(ep.tracks||[]).length === 0 ? (
          <div style={{ fontSize:12, color:'#666', fontStyle:'italic', marginBottom:10 }}>No tracks added yet. Click Edit EP to add them.</div>
        ) : (
          <div style={{ display:'grid', gap:5, marginBottom:14 }}>
            {ep.tracks.map(tr => {
              const m = masters.find(x=>x.id===tr.masterId);
              const v = m?.versions?.find(vv=>vv.id===tr.versionId);
              const p = getP(v?.persona||'', personas);
              return (
                <div key={`${tr.masterId}-${tr.versionId}-${tr.trackNumber}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#0f0f0f', border:'1px solid #181818', borderRadius:4 }}>
                  <div style={{ fontSize:11, color:'#777', width:24, textAlign:'right', flexShrink:0 }}>{tr.trackNumber}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:'#e8dcc8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m?.title || <span style={{color:'#c55'}}>(missing song)</span>}</div>
                    <div style={{ fontSize:10, color:p.color, letterSpacing:'0.06em' }}>{v?.label || ''} · {p.name}</div>
                  </div>
                  <div style={{ fontSize:10, color: tr.isrc?'#34D399':'#C8942A', whiteSpace:'nowrap' }}>
                    {tr.isrc ? `ISRC ${tr.isrc}` : '⚠ ISRC missing'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={startEdit}
            style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'6px 14px', fontSize:11, cursor:'pointer' }}>
            ✎ Edit EP
          </button>
          <button onClick={()=>{ if (window.confirm(`Delete EP "${ep.name}"? Tracks on the masters are NOT deleted.`)) onDelete(ep.id); }}
            style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#6a2a2a', padding:'6px 14px', fontSize:11, cursor:'pointer', marginLeft:'auto' }}>
            Delete EP
          </button>
        </div>
      </div>
    );
  }

  // Editing
  const setTrack = (idx, fields) => setForm(f => ({ ...f, tracks: f.tracks.map((t,i)=>i===idx?{...t,...fields}:t) }));
  const addTrackRow = () => setForm(f => ({ ...f, tracks:[...f.tracks, { masterId:'', versionId:'', trackNumber:f.tracks.length+1, isrc:'' }] }));
  const removeTrack = (idx) => setForm(f => ({ ...f, tracks: f.tracks.filter((_,i)=>i!==idx) }));

  return (
    <div style={{ background:'#0a0a0a', borderTop:'1px solid #141414', padding:'16px 18px' }}>
      <div style={{ background:'#111', border:'1px solid #252525', borderRadius:5, padding:16, marginBottom:0 }}>
        <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:12 }}>Edit EP</div>
        <div style={{ display:'grid', gap:10, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
            <div><label style={lBase}>EP Name</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={iBase} /></div>
            <div><label style={lBase}>Status</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={sel}>
                {EP_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lBase}>Persona</label>
              <select value={form.persona} onChange={e=>setForm(f=>({...f,persona:e.target.value}))} style={sel}>
                <option value="">— Select persona —</option>
                {personas.map(p=><option key={p.id} value={p.id}>{p.name} — {p.genre}</option>)}
              </select></div>
            <div><label style={lBase}>Release Date</label>
              <input type="date" value={form.releaseDate} onChange={e=>setForm(f=>({...f,releaseDate:e.target.value}))} style={iBase} /></div>
          </div>
          <div><label style={lBase}>UPC (from DistroKid)</label>
            <input value={form.upc} onChange={e=>setForm(f=>({...f,upc:e.target.value}))} placeholder="12-digit UPC" style={iBase} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lBase}>HyperFollow URL</label>
              <input value={form.hyperFollowUrl} onChange={e=>setForm(f=>({...f,hyperFollowUrl:e.target.value}))} placeholder="https://distrokid.com/hyperfollow/…" style={iBase} /></div>
            <div><label style={lBase}>Spotify URL</label>
              <input value={form.spotifyUrl} onChange={e=>setForm(f=>({...f,spotifyUrl:e.target.value}))} placeholder="https://open.spotify.com/album/…" style={iBase} /></div>
          </div>
          <div><label style={lBase}>Apple Music URL</label>
            <input value={form.appleMusicUrl} onChange={e=>setForm(f=>({...f,appleMusicUrl:e.target.value}))} placeholder="https://music.apple.com/…" style={iBase} /></div>
          <div><label style={lBase}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
              style={{ ...iBase, resize:'vertical', lineHeight:1.6 }} /></div>
        </div>

        {/* Tracklist editor */}
        <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:14, marginBottom:14 }}>
          <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:10 }}>Tracklist</div>
          <div style={{ fontSize:11, color:'#888', fontStyle:'italic', marginBottom:10, lineHeight:1.6 }}>
            Each track points to a song already in the catalog. The ISRC here is the <strong style={{color:'#ccc'}}>EP-specific ISRC</strong> from DistroKid — different from each song's single-release ISRC.
          </div>
          <div style={{ display:'grid', gap:8, marginBottom:10 }}>
            {form.tracks.map((tr, idx) => {
              const masterOptions = masters.filter(m=>!form.persona || (m.versions||[]).some(v=>v.persona===form.persona));
              const masterForRow = masters.find(m=>m.id===tr.masterId);
              const versionOptions = (masterForRow?.versions || []).filter(v=>!form.persona || v.persona===form.persona);
              return (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'48px 2fr 1.4fr 1.2fr 28px', gap:8, alignItems:'center' }}>
                  <input type="number" min="1" value={tr.trackNumber||idx+1}
                    onChange={e=>setTrack(idx,{trackNumber:Number(e.target.value)||(idx+1)})}
                    style={{ ...iBase, padding:'7px 6px', textAlign:'center' }} />
                  <select value={tr.masterId} onChange={e=>setTrack(idx,{masterId:e.target.value, versionId:''})} style={sel}>
                    <option value="">— Pick song —</option>
                    {masterOptions.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                  <select value={tr.versionId} onChange={e=>setTrack(idx,{versionId:e.target.value})} style={sel} disabled={!tr.masterId}>
                    <option value="">— Pick version —</option>
                    {versionOptions.map(v=><option key={v.id} value={v.id}>{v.label} — {getP(v.persona,personas).name}</option>)}
                  </select>
                  <input value={tr.isrc||''} onChange={e=>setTrack(idx,{isrc:e.target.value})}
                    placeholder="EP-specific ISRC" style={iBase} />
                  <button onClick={()=>removeTrack(idx)} title="Remove track"
                    style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#6a2a2a', padding:'5px 0', fontSize:10, cursor:'pointer' }}>✕</button>
                </div>
              );
            })}
          </div>
          <button onClick={addTrackRow}
            style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'6px 14px', fontSize:11, cursor:'pointer' }}>
            + Add Track
          </button>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setEditing(false)}
            style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#aaa', padding:'8px 16px', fontSize:11, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || !form.persona}
            style={{ flex:1, background:form.name.trim()&&form.persona?'linear-gradient(135deg,#C8942A,#9a7018)':'#141414',
                     border:'none', borderRadius:3, color:form.name.trim()&&form.persona?'#fff':'#777',
                     padding:'8px 0', fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase',
                     cursor:form.name.trim()&&form.persona?'pointer':'default' }}>
            ✓ Save EP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NEW EP WIZARD ────────────────────────────────────────────────────────
function NewEpForm({ personas, masters, onCreate, onCancel }) {
  const [form, setForm] = useState({
    name:'', persona:'', releaseDate:'', upc:'',
    hyperFollowUrl:'', spotifyUrl:'', appleMusicUrl:'',
    status:'upcoming', notes:'',
    tracks: [{ masterId:'', versionId:'', trackNumber:1, isrc:'' }],
  });
  const setTrack = (idx, fields) => setForm(f => ({ ...f, tracks: f.tracks.map((t,i)=>i===idx?{...t,...fields}:t) }));
  const addTrackRow = () => setForm(f => ({ ...f, tracks:[...f.tracks, { masterId:'', versionId:'', trackNumber:f.tracks.length+1, isrc:'' }] }));
  const removeTrack = (idx) => setForm(f => ({ ...f, tracks: f.tracks.filter((_,i)=>i!==idx) }));

  return (
    <div style={{ background:'#0f0f0f', border:'1px solid #C8942A33', borderLeft:'3px solid #C8942A', borderRadius:6, padding:18, marginBottom:14 }}>
      <div style={{ fontSize:10, letterSpacing:'0.2em', color:'#C8942A', textTransform:'uppercase', marginBottom:14 }}>+ New EP</div>
      <div style={{ display:'grid', gap:10, marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
          <div><label style={lBase}>EP Name *</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Already Written" style={iBase} /></div>
          <div><label style={lBase}>Status</label>
            <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={sel}>
              {EP_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={lBase}>Persona *</label>
            <select value={form.persona} onChange={e=>setForm(f=>({...f,persona:e.target.value}))} style={sel}>
              <option value="">— Select persona —</option>
              {personas.map(p=><option key={p.id} value={p.id}>{p.name} — {p.genre}</option>)}
            </select></div>
          <div><label style={lBase}>Release Date</label>
            <input type="date" value={form.releaseDate} onChange={e=>setForm(f=>({...f,releaseDate:e.target.value}))} style={iBase} /></div>
        </div>
        <div><label style={lBase}>UPC (from DistroKid)</label>
          <input value={form.upc} onChange={e=>setForm(f=>({...f,upc:e.target.value}))} placeholder="12-digit UPC" style={iBase} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={lBase}>HyperFollow URL</label>
            <input value={form.hyperFollowUrl} onChange={e=>setForm(f=>({...f,hyperFollowUrl:e.target.value}))} placeholder="https://distrokid.com/hyperfollow/…" style={iBase} /></div>
          <div><label style={lBase}>Spotify URL</label>
            <input value={form.spotifyUrl} onChange={e=>setForm(f=>({...f,spotifyUrl:e.target.value}))} placeholder="https://open.spotify.com/album/…" style={iBase} /></div>
        </div>
        <div><label style={lBase}>Apple Music URL</label>
          <input value={form.appleMusicUrl} onChange={e=>setForm(f=>({...f,appleMusicUrl:e.target.value}))} placeholder="https://music.apple.com/…" style={iBase} /></div>
        <div><label style={lBase}>Notes</label>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
            style={{ ...iBase, resize:'vertical', lineHeight:1.6 }} /></div>
      </div>
      <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:14, marginBottom:14 }}>
        <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#bbb', textTransform:'uppercase', marginBottom:10 }}>Tracklist</div>
        <div style={{ fontSize:11, color:'#888', fontStyle:'italic', marginBottom:10, lineHeight:1.6 }}>
          Pick songs already in your catalog. The ISRC here is the <strong style={{color:'#ccc'}}>EP-specific ISRC</strong> from DistroKid — different from each song's single-release ISRC.
        </div>
        <div style={{ display:'grid', gap:8, marginBottom:10 }}>
          {form.tracks.map((tr, idx) => {
            const masterOptions = masters.filter(m=>!form.persona || (m.versions||[]).some(v=>v.persona===form.persona));
            const masterForRow = masters.find(m=>m.id===tr.masterId);
            const versionOptions = (masterForRow?.versions || []).filter(v=>!form.persona || v.persona===form.persona);
            return (
              <div key={idx} style={{ display:'grid', gridTemplateColumns:'48px 2fr 1.4fr 1.2fr 28px', gap:8, alignItems:'center' }}>
                <input type="number" min="1" value={tr.trackNumber||idx+1}
                  onChange={e=>setTrack(idx,{trackNumber:Number(e.target.value)||(idx+1)})}
                  style={{ ...iBase, padding:'7px 6px', textAlign:'center' }} />
                <select value={tr.masterId} onChange={e=>setTrack(idx,{masterId:e.target.value, versionId:''})} style={sel}>
                  <option value="">— Pick song —</option>
                  {masterOptions.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <select value={tr.versionId} onChange={e=>setTrack(idx,{versionId:e.target.value})} style={sel} disabled={!tr.masterId}>
                  <option value="">— Pick version —</option>
                  {versionOptions.map(v=><option key={v.id} value={v.id}>{v.label} — {getP(v.persona,personas).name}</option>)}
                </select>
                <input value={tr.isrc||''} onChange={e=>setTrack(idx,{isrc:e.target.value})}
                  placeholder="EP-specific ISRC" style={iBase} />
                <button onClick={()=>removeTrack(idx)} title="Remove track"
                  style={{ background:'transparent', border:'1px solid #2a1515', borderRadius:3, color:'#6a2a2a', padding:'5px 0', fontSize:10, cursor:'pointer' }}>✕</button>
              </div>
            );
          })}
        </div>
        <button onClick={addTrackRow}
          style={{ background:'transparent', border:'1px solid #252525', borderRadius:3, color:'#bbb', padding:'6px 14px', fontSize:11, cursor:'pointer' }}>
          + Add Track
        </button>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onCancel} style={{ background:'transparent', border:'1px solid #222', borderRadius:3, color:'#aaa', padding:'9px 16px', fontSize:11, cursor:'pointer' }}>Cancel</button>
        <button onClick={()=>{
          const ep = {
            id: uid(),
            name: form.name.trim(),
            persona: form.persona,
            releaseDate: form.releaseDate,
            upc: form.upc.trim(),
            hyperFollowUrl: form.hyperFollowUrl.trim(),
            spotifyUrl: form.spotifyUrl.trim(),
            appleMusicUrl: form.appleMusicUrl.trim(),
            status: form.status,
            notes: form.notes,
            tracks: form.tracks
              .filter(t=>t.masterId && t.versionId)
              .map((t,i)=>({ masterId:t.masterId, versionId:t.versionId, trackNumber:t.trackNumber||(i+1), isrc:(t.isrc||'').trim() }))
              .sort((a,b)=>(a.trackNumber||0)-(b.trackNumber||0)),
          };
          onCreate(ep);
        }} disabled={!form.name.trim() || !form.persona}
          style={{ flex:1, background:form.name.trim()&&form.persona?'linear-gradient(135deg,#C8942A,#9a7018)':'#141414',
                   border:'none', borderRadius:3, color:form.name.trim()&&form.persona?'#fff':'#777',
                   padding:'9px 0', fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase',
                   cursor:form.name.trim()&&form.persona?'pointer':'default' }}>
          ✓ Create EP
        </button>
      </div>
    </div>
  );
}

// ── EXPORT: TOP-LEVEL VIEW ───────────────────────────────────────────────
export default function EpView({ eps, masters, personas, onCreateEp, onUpdateEp, onDeleteEp }) {
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const sorted = [...eps].sort((a,b)=>{
    const ad = a.releaseDate || '9999';
    const bd = b.releaseDate || '9999';
    return ad.localeCompare(bd) || (a.name||'').localeCompare(b.name||'');
  });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, letterSpacing:'0.25em', color:'#bbb', textTransform:'uppercase', marginBottom:3 }}>EPs / Albums</div>
          <div style={{ fontSize:12, color:'#888' }}>{eps.length} EP{eps.length!==1?'s':''} · separate releases with their own UPCs and per-track ISRCs</div>
        </div>
        {!creating && (
          <button onClick={()=>setCreating(true)}
            style={{ background:'linear-gradient(135deg,#C8942A,#9a7018)', border:'none', borderRadius:4, color:'#fff', padding:'9px 18px', fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer' }}>
            ＋ New EP
          </button>
        )}
      </div>

      {creating && (
        <NewEpForm
          personas={personas}
          masters={masters}
          onCancel={()=>setCreating(false)}
          onCreate={(ep)=>{ onCreateEp(ep); setCreating(false); setExpandedId(ep.id); }}
        />
      )}

      {sorted.length === 0 && !creating && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#666', fontSize:13 }}>
          No EPs yet. Click "＋ New EP" to create one — songs already in your catalog can be grouped into an EP with its own UPC and per-track ISRCs.
        </div>
      )}

      {sorted.map(ep => (
        <EpRow key={ep.id} ep={ep} personas={personas} masters={masters}
          expanded={expandedId===ep.id}
          onToggle={()=>setExpandedId(expandedId===ep.id?null:ep.id)}
          onUpdate={onUpdateEp} onDelete={onDeleteEp}
        />
      ))}
    </div>
  );
}
