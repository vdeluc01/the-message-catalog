import { CLIENT_ID, REDIRECT_URI, SCOPES, CATALOG_FILENAME } from './constants.js';

export function getToken() {
  const t = localStorage.getItem('gdrive_token');
  const e = parseInt(localStorage.getItem('gdrive_token_expiry')||'0');
  return (t && Date.now() < e-60000) ? t : null;
}

export function startOAuth() {
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth`+
    `?client_id=${encodeURIComponent(CLIENT_ID)}`+
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`+
    `&response_type=token`+
    `&scope=${encodeURIComponent(SCOPES)}`+
    `&prompt=consent`;
}

export async function driveFind(token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${CATALOG_FILENAME}'+and+trashed=false&fields=files(id,name)`,
    { headers:{ Authorization:`Bearer ${token}` } });
  const d = await r.json();
  return d.files && d.files.length > 0 ? d.files[0] : null;
}

export async function driveLoad(token) {
  const file = await driveFind(token);
  if (!file) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers:{ Authorization:`Bearer ${token}` } });
  return { data: await r.json(), fileId: file.id };
}

export async function driveSave(token, masters, fileId) {
  const body = JSON.stringify({ masters, savedAt:new Date().toISOString(), version:'4.0' }, null, 2);
  const blob = new Blob([body], { type:'application/json' });
  if (fileId) {
    const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method:'PATCH', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:blob });
    return r.ok ? fileId : null;
  } else {
    const meta = new Blob([JSON.stringify({ name:CATALOG_FILENAME, mimeType:'application/json' })], { type:'application/json' });
    const form = new FormData(); form.append('metadata',meta); form.append('file',blob);
    const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
      { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:form });
    const d = await r.json(); return d.id || null;
  }
}
