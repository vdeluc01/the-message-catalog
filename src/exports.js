import { getP } from './utils.js';

// ── Shared export helpers ──────────────────────────────────────────────
export function csvBlob(rows) {
  const csv = rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  return new Blob([csv],{type:'text/csv'});
}

export function downloadCSV(blob, filename) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

export function openPDF(html) {
  const win = window.open('','_blank'); win.document.write(html); win.document.close();
  setTimeout(()=>win.print(), 500);
}

export function pdfShell(title, subtitle, description, body, masters, personas) {
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:Georgia,serif;color:#111;background:#fff;margin:0;padding:0}
  .cover{padding:60px 60px 36px;border-bottom:2px solid #111;margin-bottom:40px}
  .cover h1{font-size:28px;font-weight:normal;letter-spacing:0.08em;margin:0 0 6px}
  .cover h2{font-size:15px;font-weight:normal;color:#555;margin:0 0 14px}
  .cover .desc{font-size:12px;color:#777;line-height:1.7;max-width:560px;margin:0 0 14px}
  .cover .meta{font-size:11px;color:#aaa}
  .section{page-break-before:always;padding:40px 60px}
  .section:first-of-type{page-break-before:avoid}
  .sec-title{font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:22px}
  .sec-count{float:right;color:#aaa}
  .song{margin-bottom:26px;padding-bottom:26px;border-bottom:1px solid #eee}
  .song:last-child{border-bottom:none}
  .song-title{font-size:15px;font-weight:bold;margin:0 0 3px}
  .song-meta{font-size:11px;color:#888;margin:0 0 6px;letter-spacing:0.04em}
  .song-tags{font-size:11px;color:#555;margin:0 0 6px}
  .song-desc{font-size:12px;color:#333;line-height:1.7;margin:0 0 6px}
  .song-link{font-size:11px;color:#555}
  .song-link a{color:#333}
  @media print{.section{page-break-before:always}}
</style></head><body>
<div class="cover">
  <div style="font-size:10px;letter-spacing:0.3em;color:#888;text-transform:uppercase;margin-bottom:10px">The Message Records</div>
  <h1>${title}</h1>
  <h2>${subtitle}</h2>
  <div class="desc">${description}</div>
  <div class="meta">Generated ${date} &nbsp;·&nbsp; ${masters.length} songs &nbsp;·&nbsp; ${personas.length} artist personas</div>
</div>${body}</body></html>`;
}

// ── 1. Music Supervisor Export ─────────────────────────────────────────
export function exportSupervisorCSV(masters, personas) {
  const eligible = masters
    .filter(m => m.versions.some(v => v.takes.some(t => t.releaseStatus==='ready'||t.releaseStatus==='released')))
    .sort((a,b) => {
      const va = a.versions.find(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))||a.versions[0];
      const vb = b.versions.find(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))||b.versions[0];
      return (va?.mood||'').localeCompare(vb?.mood||'') || (va?.genre||'').localeCompare(vb?.genre||'') || a.title.localeCompare(b.title);
    });
  const rows = [['Title','Persona','Genre','Mood','Instrumental Mood','Themes','Duration','BPM','Key','Sync Available','Listen Link','Status']];
  eligible.forEach(m => {
    m.versions.filter(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released')).forEach(v => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      rows.push([m.title, p.name, v.genre||'', v.mood||'', v.instrumentalMood||'',
        (v.themes||[]).join(', '), v.duration||'', v.bpm||'', v.musicalKey||'',
        v.syncAvailable||'', take?.sunoUrl||'', take?.releaseStatus||'']);
    });
  });
  downloadCSV(csvBlob(rows), 'the-message-supervisor.csv');
  return '✓ Music Supervisor CSV exported';
}

export function exportSupervisorPDF(masters, personas) {
  const eligible = masters
    .filter(m => m.versions.some(v => v.takes.some(t => t.releaseStatus==='ready'||t.releaseStatus==='released')))
    .sort((a,b) => {
      const va = a.versions.find(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))||a.versions[0];
      const vb = b.versions.find(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released'))||b.versions[0];
      return (va?.mood||'').localeCompare(vb?.mood||'') || a.title.localeCompare(b.title);
    });
  const byMood = {};
  eligible.forEach(m => {
    m.versions.filter(v=>v.takes.some(t=>t.releaseStatus==='ready'||t.releaseStatus==='released')).forEach(v => {
      const mood = v.mood||'Unspecified';
      if (!byMood[mood]) byMood[mood] = [];
      byMood[mood].push({m, v});
    });
  });
  let body = '';
  Object.keys(byMood).sort().forEach((mood) => {
    const items = byMood[mood];
    body += `<div class="section"><div class="sec-title">${mood} <span class="sec-count">${items.length} song${items.length!==1?'s':''}</span></div>`;
    items.forEach(({m, v}) => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      const tech = [v.bpm?`${v.bpm} BPM`:'', v.musicalKey||'', v.duration||'', v.instrumentalMood||''].filter(Boolean).join(' · ');
      const sync = v.syncAvailable ? ` · Sync: ${v.syncAvailable}` : '';
      body += `<div class="song">
<div class="song-title">${m.title}</div>
<div class="song-meta">${p.name} · ${v.genre||'—'}${sync}</div>
${tech?`<div class="song-tags">${tech}</div>`:''}
${(v.themes||[]).length?`<div class="song-tags">Themes: ${v.themes.join(', ')}</div>`:''}
${v.versionSummary?`<div class="song-desc">${v.versionSummary}</div>`:''}
${take?.sunoUrl?`<div class="song-link">Listen: <a href="${take.sunoUrl}">${take.sunoUrl}</a></div>`:''}
</div>`;
    });
    body += `</div>`;
  });
  openPDF(pdfShell(
    'Music Supervisor Catalog',
    'Ready & Released Songs — Organized by Mood',
    'Prepared for sync licensing review. Contains only songs marked Ready to Release or Released on Spotify, organized by mood then genre. Technical metadata (BPM, key, duration) and sync availability are noted where available.',
    body,
    masters,
    personas
  ));
  return '✓ Supervisor PDF opened — use Print to save';
}

// ── 2. Label / A&R Export ──────────────────────────────────────────────
export function exportLabelCSV(masters, personas) {
  const rows = [['Title','Persona / Artist','Genre','Mood','Themes','Version Summary','Release Status','Suno Created','Listen Link']];
  personas.forEach(p => {
    const songs = [...masters].filter(m=>m.versions.some(v=>v.persona===p.id)).sort((a,b)=>a.title.localeCompare(b.title));
    if (!songs.length) return;
    rows.push([`--- ${p.name} (${songs.length} songs) ---`,'','','','','','','','']);
    songs.forEach(m => {
      m.versions.filter(v=>v.persona===p.id).forEach(v => {
        const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
        const createdAt = take?.sunoCreatedAt ? take.sunoCreatedAt.slice(0,10) : '';
        rows.push([m.title, p.name, v.genre||'', v.mood||'', (v.themes||[]).join(', '), v.versionSummary||'', take?.releaseStatus||'draft', createdAt, take?.sunoUrl||'']);
      });
    });
    rows.push(['','','','','','','','','']);
  });
  downloadCSV(csvBlob(rows), 'the-message-label-ar.csv');
  return '✓ Label / A&R CSV exported';
}

export function exportLabelPDF(masters, personas) {
  let body = '';
  personas.forEach(p => {
    const songs = [...masters].filter(m=>m.versions.some(v=>v.persona===p.id)).sort((a,b)=>a.title.localeCompare(b.title));
    if (!songs.length) return;
    body += `<div class="section"><div class="sec-title" style="border-color:${p.color}44;color:${p.color}">${p.name} <span class="sec-count" style="color:${p.color}88">${songs.length} songs</span></div>`;
    if (p.desc) body += `<div style="font-size:11px;color:#888;font-style:italic;margin-bottom:18px">${p.desc}</div>`;
    songs.forEach(m => {
      m.versions.filter(v=>v.persona===p.id).forEach(v => {
        const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
        const status = take?.releaseStatus||'draft';
        const statusColor = status==='released'?'#22c55e':status==='ready'?'#f59e0b':'#888';
        body += `<div class="song">
<div class="song-title">${m.title} <span style="font-size:10px;font-weight:normal;color:${statusColor};letter-spacing:0.1em;text-transform:uppercase;margin-left:8px">${status}</span></div>
<div class="song-meta">${v.genre||'—'} · ${v.mood||'—'}</div>
${(v.themes||[]).length?`<div class="song-tags">Themes: ${v.themes.join(', ')}</div>`:''}
${v.versionSummary?`<div class="song-desc">${v.versionSummary}</div>`:''}
${take?.sunoCreatedAt?`<div class="song-meta" style="color:#888">Created on Suno: ${take.sunoCreatedAt.slice(0,10)}</div>`:''}
${take?.sunoUrl?`<div class="song-link">Listen: <a href="${take.sunoUrl}">${take.sunoUrl}</a></div>`:''}
</div>`;
      });
    });
    body += `</div>`;
  });
  openPDF(pdfShell(
    'Song Catalog — Label / A&R',
    'Full Catalog by Artist Persona',
    'Prepared for label and A&R review. All songs organized by artist persona to demonstrate the breadth and consistency of each creative identity. Includes genre, mood, themes, and catalog descriptions.',
    body,
    masters,
    personas
  ));
  return '✓ Label/A&R PDF opened — use Print to save';
}

// ── 3. Publisher Export ────────────────────────────────────────────────
export function exportPublisherCSV(masters, personas) {
  const sorted = [...masters].sort((a,b)=>a.title.localeCompare(b.title));
  const rows = [['Title','Persona / Artist','Genre','Themes','PRO Status','ISRC','Listen Link']];
  sorted.forEach(m => {
    m.versions.forEach(v => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      rows.push([m.title, p.name, v.genre||'', (v.themes||[]).join(', '), v.proStatus||'', take?.isrc||'', take?.sunoUrl||'']);
    });
  });
  downloadCSV(csvBlob(rows), 'the-message-publisher.csv');
  return '✓ Publisher CSV exported';
}

export function exportPublisherPDF(masters, personas) {
  const sorted = [...masters].sort((a,b)=>a.title.localeCompare(b.title));
  let body = `<div class="section"><div class="sec-title">All Songs — Alphabetical <span class="sec-count">${sorted.length} songs</span></div>`;
  sorted.forEach(m => {
    m.versions.forEach(v => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      const rights = [v.proStatus?`PRO: ${v.proStatus}`:'', take?.isrc?`ISRC: ${take.isrc}`:''].filter(Boolean).join(' · ');
      body += `<div class="song">
<div class="song-title">${m.title}</div>
<div class="song-meta">${p.name} · ${v.genre||'—'}</div>
${(v.themes||[]).length?`<div class="song-tags">Themes: ${v.themes.join(', ')}</div>`:''}
${rights?`<div class="song-tags" style="color:#888">${rights}</div>`:''}
${take?.sunoUrl?`<div class="song-link">Listen: <a href="${take.sunoUrl}">${take.sunoUrl}</a></div>`:''}
</div>`;
    });
  });
  body += `</div>`;
  openPDF(pdfShell(
    'Song Catalog — Publisher',
    'Full Catalog — Alphabetical',
    'Prepared for music publishing review. All songs listed alphabetically with rights management information (PRO registration status, ISRC codes) where available. Contact us to discuss licensing terms.',
    body,
    masters,
    personas
  ));
  return '✓ Publisher PDF opened — use Print to save';
}

// ── 4. Playlist Curator Export ─────────────────────────────────────────
export function exportCuratorCSV(masters, personas) {
  const released = [...masters]
    .filter(m => m.versions.some(v => v.takes.some(t => t.releaseStatus==='released')))
    .sort((a,b) => {
      const va = a.versions.find(v=>v.takes.some(t=>t.releaseStatus==='released'))||a.versions[0];
      const vb = b.versions.find(v=>v.takes.some(t=>t.releaseStatus==='released'))||b.versions[0];
      return (va?.targetAudience||'').localeCompare(vb?.targetAudience||'') || (va?.mood||'').localeCompare(vb?.mood||'') || a.title.localeCompare(b.title);
    });
  const rows = [['Title','Persona / Artist','Genre','Mood','Target Audience','Duration','Runtime','Listen Link']];
  released.forEach(m => {
    m.versions.filter(v=>v.takes.some(t=>t.releaseStatus==='released')).forEach(v => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      rows.push([m.title, p.name, v.genre||'', v.mood||'', v.targetAudience||'General', v.duration||'', v.runtime||'', take?.sunoUrl||'']);
    });
  });
  downloadCSV(csvBlob(rows), 'the-message-curator.csv');
  return '✓ Curator CSV exported';
}

export function exportCuratorPDF(masters, personas) {
  const released = [...masters]
    .filter(m => m.versions.some(v => v.takes.some(t => t.releaseStatus==='released')))
    .sort((a,b) => {
      const va = a.versions.find(v=>v.takes.some(t=>t.releaseStatus==='released'))||a.versions[0];
      const vb = b.versions.find(v=>v.takes.some(t=>t.releaseStatus==='released'))||b.versions[0];
      return (va?.targetAudience||'').localeCompare(vb?.targetAudience||'') || (va?.mood||'').localeCompare(vb?.mood||'') || a.title.localeCompare(b.title);
    });
  const byAudience = {};
  released.forEach(m => {
    m.versions.filter(v=>v.takes.some(t=>t.releaseStatus==='released')).forEach(v => {
      const aud = v.targetAudience||'General';
      if (!byAudience[aud]) byAudience[aud] = [];
      byAudience[aud].push({m, v});
    });
  });
  let body = '';
  Object.keys(byAudience).sort().forEach(aud => {
    const items = byAudience[aud];
    body += `<div class="section"><div class="sec-title">${aud} <span class="sec-count">${items.length} song${items.length!==1?'s':''}</span></div>`;
    items.forEach(({m, v}) => {
      const take = v.takes.find(t=>t.isPrimary)||v.takes[0];
      const p = getP(v.persona, personas);
      const meta2 = [v.mood||'', v.genre||'', v.runtime||v.duration||''].filter(Boolean).join(' · ');
      body += `<div class="song">
<div class="song-title">${m.title}</div>
<div class="song-meta">${p.name}${meta2?' · '+meta2:''}</div>
${take?.sunoUrl?`<div class="song-link">Listen: <a href="${take.sunoUrl}">${take.sunoUrl}</a></div>`:''}
</div>`;
    });
    body += `</div>`;
  });
  openPDF(pdfShell(
    'Song Catalog — Playlist Curator',
    'Released Songs by Target Audience',
    'Prepared for playlist curators and streaming platform editorial teams. Contains only released songs, organized by target audience then mood. Ideal for identifying tracks that fit specific playlist contexts.',
    body,
    masters,
    personas
  ));
  return '✓ Curator PDF opened — use Print to save';
}

// ── 5. Lyrics Bulk Upload (Musixmatch / Genius) ────────────────────────
// One row per Version (persona-recording). Lyrics live on the Master and
// are duplicated across each persona's row — that's intentional. Musixmatch
// matches on Title + Artist, so each persona needs its own claimable row
// even though the lyrics are identical. Songwriter column ties everything
// back to one human writer for credit/royalty purposes.

// Smart/curly punctuation tends to confuse older bulk-upload scripts.
// Convert to straight ASCII equivalents. Newlines in lyrics are preserved
// (they sit inside the quoted CSV field per RFC 4180).
function sanitizeLyrics(s) {
  if (!s) return '';
  return String(s)
    .replace(/[‘’‚‛]/g, "'")   // single curly quotes
    .replace(/[“”„‟]/g, '"')   // double curly quotes
    .replace(/[–—]/g, '-')                // en/em dash
    .replace(/…/g, '...')                      // ellipsis
    .replace(/ /g, ' ');                       // non-breaking space
}

export function exportLyricsCSV(masters, personas) {
  const SONGWRITER = 'Vito DeLuca';
  const DEFAULT_ALBUM = 'The Archive';

  const rows = [['track_title','artist_name','album_title','lyrics','isrc','duration','songwriter']];

  const withLyrics = [...masters]
    .filter(m => m.lyrics && m.lyrics.trim())
    .sort((a,b) => a.title.localeCompare(b.title));

  let rowCount = 0;
  withLyrics.forEach(m => {
    const cleanLyrics = sanitizeLyrics(m.lyrics);
    m.versions.forEach(v => {
      const p = getP(v.persona, personas);
      if (!p || !p.name) return;
      const take = v.takes?.find(t=>t.isPrimary) || v.takes?.[0];
      const isrc = take?.isrc || '';
      const duration = v.duration || '';   // expected MM:SS or blank
      rows.push([
        m.title,
        p.name,
        DEFAULT_ALBUM,
        cleanLyrics,
        isrc,
        duration,
        SONGWRITER
      ]);
      rowCount++;
    });
  });

  // Build CSV with CSV-RFC quoting (every field wrapped in "..."
  // and embedded " escaped as ""). Prepend UTF-8 BOM so Excel and
  // strict uploaders detect the encoding correctly. Apostrophes and
  // dashes survive intact.
  const csv = rows
    .map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  downloadCSV(blob, 'the-message-lyrics-musixmatch.csv');

  const skipped = masters.length - withLyrics.length;
  return `✓ Lyrics CSV exported — ${rowCount} rows from ${withLyrics.length} songs${skipped?` (${skipped} masters skipped: no lyrics)`:''}`;
}
