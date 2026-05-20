// Copyright Vault — single-click timestamped proof of authorship for the catalog.
//
// The flow:
//   1. Build a JSON manifest of every song + persona + Suno URL, declaring
//      Vito DeLuca as the songwriter and The Message Records as the owner.
//   2. Pack it into a single-entry STORED (uncompressed) zip — small, deterministic,
//      and not dependent on any third-party zip library.
//   3. SHA-256 the zip bytes via the browser's Web Crypto API.
//   4. POST the digest to the OpenTimestamps calendar at
//      https://a.pool.opentimestamps.org/digest and, if it comes back, assemble
//      a best-effort .ots proof file (standard header + sha256 op + digest +
//      calendar attestation bytes) and offer it as a download.
//   5. If the calendar call fails (CORS, network, etc.), surface the digest in
//      a copyable form with a link to opentimestamps.org so the stamping can be
//      finished manually with the zip.
//
// All output is bytes — nothing here mutates app state directly. App.jsx owns
// the buttons, download triggers, and localStorage record of the last stamp.

const CALENDAR_URL = 'https://a.pool.opentimestamps.org/digest';

// ---------- manifest ----------

export function buildVaultManifest(masters, personas) {
  const personaName = (id) => {
    const p = (personas || []).find(p => p.id === id);
    return p ? p.name : null;
  };

  const songs = [];
  (masters || []).forEach(m => {
    (m.versions || []).forEach(v => {
      const urls = (v.takes || [])
        .map(t => (t.sunoUrl || '').trim())
        .filter(Boolean);
      songs.push({
        masterId: m.id,
        title: m.title || '',
        versionLabel: v.label || '',
        persona: personaName(v.persona) || 'Unassigned',
        personaId: v.persona || null,
        sunoUrls: urls,
        addedAt: v.addedAt || m.addedAt || null,
      });
    });
  });

  return {
    type: 'the-message-records-copyright-vault',
    manifestVersion: '1.0',
    stampedAt: new Date().toISOString(),
    owner: 'The Message Records',
    songwriter: 'Vito DeLuca',
    songCount: songs.length,
    songs,
  };
}

// ---------- zip ----------

// CRC-32 (IEEE 802.3) — table built lazily, used by the zip header.
let _crcTable = null;
function crcTable() {
  if (_crcTable) return _crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  _crcTable = t;
  return t;
}
function crc32(bytes) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Build a single-entry zip with the given filename + bytes. Uncompressed
// (method 0 / "stored") so we don't need a deflate implementation — the
// manifest is small and integrity is what we care about, not size.
export function buildSingleEntryZip(filename, bytes) {
  const nameBytes = new TextEncoder().encode(filename);
  const crc = crc32(bytes);
  const size = bytes.length;

  // Local file header: 30 bytes + filename + data
  const lf = new Uint8Array(30 + nameBytes.length);
  const dv = new DataView(lf.buffer);
  dv.setUint32(0,  0x04034b50, true);   // local file header signature
  dv.setUint16(4,  20, true);           // version needed
  dv.setUint16(6,  0x0800, true);       // flags: UTF-8 filename
  dv.setUint16(8,  0, true);            // method: stored
  dv.setUint16(10, 0, true);            // mod time
  dv.setUint16(12, 0x0021, true);       // mod date (1980-01-01)
  dv.setUint32(14, crc, true);
  dv.setUint32(18, size, true);         // compressed size
  dv.setUint32(22, size, true);         // uncompressed size
  dv.setUint16(26, nameBytes.length, true);
  dv.setUint16(28, 0, true);            // extra field length
  lf.set(nameBytes, 30);

  // Central directory header: 46 bytes + filename
  const cd = new Uint8Array(46 + nameBytes.length);
  const cdv = new DataView(cd.buffer);
  cdv.setUint32(0,  0x02014b50, true);  // central dir signature
  cdv.setUint16(4,  20, true);          // version made by
  cdv.setUint16(6,  20, true);          // version needed
  cdv.setUint16(8,  0x0800, true);      // flags
  cdv.setUint16(10, 0, true);           // method
  cdv.setUint16(12, 0, true);
  cdv.setUint16(14, 0x0021, true);
  cdv.setUint32(16, crc, true);
  cdv.setUint32(20, size, true);
  cdv.setUint32(24, size, true);
  cdv.setUint16(28, nameBytes.length, true);
  cdv.setUint16(30, 0, true);           // extra
  cdv.setUint16(32, 0, true);           // comment
  cdv.setUint16(34, 0, true);           // disk number start
  cdv.setUint16(36, 0, true);           // internal attrs
  cdv.setUint32(38, 0, true);           // external attrs
  cdv.setUint32(42, 0, true);           // local header offset
  cd.set(nameBytes, 46);

  // End of central directory: 22 bytes
  const lfSize = lf.length + size;
  const cdSize = cd.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0,  0x06054b50, true);
  ev.setUint16(4,  0, true);
  ev.setUint16(6,  0, true);
  ev.setUint16(8,  1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, lfSize, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(lfSize + cdSize + eocd.length);
  let o = 0;
  out.set(lf, o);    o += lf.length;
  out.set(bytes, o); o += bytes.length;
  out.set(cd, o);    o += cd.length;
  out.set(eocd, o);
  return out;
}

// ---------- hashing ----------

export async function sha256(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

export function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

// ---------- opentimestamps ----------

// POST the digest to a public OpenTimestamps calendar and return the raw
// response bytes (the calendar attestation). Throws on any non-200 or
// network/CORS failure — the caller is responsible for surfacing the
// manual fallback in that case.
export async function postDigestToCalendar(digestBytes) {
  const resp = await fetch(CALENDAR_URL, {
    method: 'POST',
    body: digestBytes,
    headers: { 'Accept': 'application/vnd.opentimestamps.v1' },
  });
  if (!resp.ok) throw new Error('Calendar responded ' + resp.status);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

// Build a best-effort .ots proof file from a SHA-256 digest and a calendar
// response. Standard OpenTimestamps format:
//   - magic header (31 bytes)
//   - file-hash op for sha256 (0x08)
//   - 32-byte original digest
//   - the calendar attestation tree (response body)
//
// If a future audit needs a guaranteed-valid .ots, the manual flow (upload
// the zip at opentimestamps.org) is always the fallback.
export function buildOtsFile(digestBytes, calendarResponse) {
  const magic = new Uint8Array([
    0x00, 0x4F, 0x70, 0x65, 0x6E, 0x54, 0x69, 0x6D, 0x65, 0x73,
    0x74, 0x61, 0x6D, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6F,
    0x6F, 0x66, 0x00, 0xBF, 0x89, 0xE2, 0xE8, 0x84, 0xE8, 0x92, 0x94,
  ]);
  const version = new Uint8Array([0x01]);
  const sha256Op = new Uint8Array([0x08]);
  const total = magic.length + version.length + sha256Op.length + digestBytes.length + calendarResponse.length;
  const out = new Uint8Array(total);
  let o = 0;
  out.set(magic, o);            o += magic.length;
  out.set(version, o);          o += version.length;
  out.set(sha256Op, o);         o += sha256Op.length;
  out.set(digestBytes, o);      o += digestBytes.length;
  out.set(calendarResponse, o);
  return out;
}

// ---------- download helper ----------

export function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- filename helpers ----------

// Match Vito's existing copyright archive naming convention so all the
// proofs sort together in his "Copyright Proof Keep Forever" folder.
export function vaultBaseFilename(d) {
  const date = d || new Date();
  const pad = n => String(n).padStart(2, '0');
  return `Vito DeLuca Copyright Proof Archive_${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}
