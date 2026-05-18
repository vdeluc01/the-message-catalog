import { useState } from 'react';
import { PITCH_PLATFORMS, PITCH_RESULTS } from '../constants.js';

// ── Per-persona stats card ───────────────────────────────────────────────
// Click to expand: shows totals, released-songs list with Spotify links,
// active HyperFollow links, and all pending pitches across this persona.
function PersonaRow({ persona, masters, expanded, onToggle }) {
  // Pull all (master, version) pairs assigned to this persona.
  const pairs = masters.flatMap(m =>
    (m.versions||[])
      .filter(v => v.persona === persona.id)
      .map(v => ({ master: m, version: v }))
  );
  // State counts. Status is derived from primary-take releaseStatus plus DK fields.
  const total       = pairs.length;
  const live        = pairs.filter(({version: v}) => !!v.distrokid?.spotifyUrl?.trim()).length;
  const submitted   = pairs.filter(({version: v}) => !!v.distrokid?.submittedDate?.trim() && !v.distrokid?.spotifyUrl?.trim()).length;
  const ready       = pairs.filter(({version: v}) => {
    const t = (v.takes||[]).find(t=>t.isPrimary) || (v.takes||[])[0];
    return t?.releaseStatus === 'ready' && !v.distrokid?.submittedDate?.trim();
  }).length;
  const inProgress  = pairs.filter(({version: v}) => {
    const t = (v.takes||[]).find(t=>t.isPrimary) || (v.takes||[])[0];
    const status = t?.releaseStatus || 'draft';
    return status !== 'released' && status !== 'ready';
  }).filter(({version: v}) => !v.distrokid?.submittedDate?.trim() && !v.distrokid?.spotifyUrl?.trim()).length;

  return (
    <div style={{ marginBottom:8, border:`1px solid ${persona.color}33`, borderLeft:`3px solid ${persona.color}`, borderRadius:6, overflow:'hidden' }}>
      <div onClick={onToggle} style={{ background:expanded?'#0f0f0f':'#0a0a0a', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:'#f0e8d8', marginBottom:4 }}>{persona.name}</div>
          <div style={{ fontSize:11, color:'#888', fontStyle:'italic', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{persona.genre}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
          <Stat label="songs"     count={total}      color={persona.color} />
          {live>0       && <Stat label="live"        count={live}       color="#34D399" />}
          {submitted>0  && <Stat label="submitted"   count={submitted}  color="#5B8DD9" />}
          {ready>0      && <Stat label="ready"       count={ready}      color="#C8942A" />}
          {inProgress>0 && <Stat label="in progress" count={inProgress} color="#888" />}
          <span style={{ color:'#999', fontSize:12 }}>{expanded?'▲':'▼'}</span>
        </div>
      </div>
      {expanded && <PersonaDetail persona={persona} pairs={pairs} />}
    </div>
  );
}

const Stat = ({ label, count, color }) => (
  <div style={{ textAlign:'center', minWidth:48 }}>
    <div style={{ fontSize:18, fontWeight:700, color, lineHeight:1 }}>{count}</div>
    <div style={{ fontSize:9, color:'#666', letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
  </div>
);

function PersonaDetail({ persona, pairs }) {
  // Live releases (Spotify URL present) — most useful link list for outreach
  const liveList = pairs.filter(({version: v}) => !!v.distrokid?.spotifyUrl?.trim());
  // HyperFollow links that are still useful (active upcoming OR live)
  const hfList = pairs.filter(({version: v}) => !!v.distrokid?.hyperFollowUrl?.trim());
  // Pending pitches across every version assigned to this persona
  const pending = pairs.flatMap(({master, version}) =>
    (version.pitches||[])
      .filter(p => p.result === 'pending')
      .map(p => ({ master, version, pitch: p }))
  );

  return (
    <div style={{ background:'#0a0a0a', borderTop:'1px solid #141414', padding:'14px 18px' }}>
      {persona.desc && <div style={{ fontSize:12, color:'#aaa', fontStyle:'italic', lineHeight:1.6, marginBottom:14 }}>{persona.desc}</div>}

      <Section title={`Released songs (${liveList.length})`} empty="No songs live on streaming yet.">
        {liveList.map(({master, version}) => {
          const dk = version.distrokid || {};
          return (
            <div key={version.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'#0f0f0f', border:'1px solid #181818', borderRadius:4, marginBottom:5 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:'#e8dcc8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{master.title}</div>
                <div style={{ fontSize:10, color:'#666' }}>{version.label}</div>
              </div>
              {dk.spotifyUrl         && <a href={dk.spotifyUrl}         target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#34D399' }}>🎧 Spotify</a>}
              {dk.appleMusicTrackUrl && <a href={dk.appleMusicTrackUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#F87171' }}>🍎 Apple Music</a>}
            </div>
          );
        })}
      </Section>

      <Section title={`HyperFollow links (${hfList.length})`} empty="No HyperFollow links yet.">
        {hfList.map(({master, version}) => (
          <div key={version.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'#0f0f0f', border:'1px solid #181818', borderRadius:4, marginBottom:4 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:'#e8dcc8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{master.title}</div>
              <div style={{ fontSize:10, color:'#666' }}>{version.label}{version.distrokid?.releaseDate ? ` · releasing ${version.distrokid.releaseDate}` : ''}</div>
            </div>
            <a href={version.distrokid.hyperFollowUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#C8942A' }}>🔗 HyperFollow</a>
          </div>
        ))}
      </Section>

      <Section title={`Pending pitches (${pending.length})`} empty="No pitches waiting on a response.">
        {pending.map(({master, version, pitch}) => {
          const pf = PITCH_PLATFORMS.find(x=>x.id===pitch.platform) || PITCH_PLATFORMS[4];
          return (
            <div key={pitch.id} style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px', gap:10, alignItems:'center', padding:'6px 10px', background:'#0f0f0f', border:'1px solid #181818', borderRadius:4, marginBottom:4 }}>
              <span style={{ fontSize:10, color:pf.color }}>{pf.label}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, color:'#e8dcc8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pitch.contact || <span style={{ color:'#666' }}>(no contact)</span>}</div>
                <div style={{ fontSize:10, color:'#666' }}>{master.title} — {version.label}</div>
              </div>
              <span style={{ fontSize:10, color:'#888', textAlign:'right' }}>{pitch.submittedDate || '—'}</span>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

const Section = ({ title, empty, children }) => {
  const items = Array.isArray(children) ? children : (children ? [children] : []);
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:9, letterSpacing:'0.2em', color:'#555', textTransform:'uppercase', marginBottom:7 }}>{title}</div>
      {items.length === 0
        ? <div style={{ fontSize:11, color:'#666', fontStyle:'italic' }}>{empty}</div>
        : children}
    </div>
  );
};

// ── Top-level view ───────────────────────────────────────────────────────
export default function PersonasView({ personas, masters }) {
  const [expandedId, setExpandedId] = useState(null);

  // Sort by song count (most active personas first).
  const enriched = personas.map(p => ({
    ...p,
    count: masters.reduce((a,m) => a + (m.versions||[]).filter(v=>v.persona===p.id).length, 0),
  }));
  const sorted = [...enriched].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, letterSpacing:'0.25em', color:'#bbb', textTransform:'uppercase', marginBottom:3 }}>Personas</div>
        <div style={{ fontSize:12, color:'#888' }}>{personas.length} artist personas · click to see release stats, links, and pending pitches</div>
      </div>
      {sorted.map(p => (
        <PersonaRow key={p.id} persona={p} masters={masters}
          expanded={expandedId===p.id}
          onToggle={()=>setExpandedId(expandedId===p.id?null:p.id)}
        />
      ))}
    </div>
  );
}
