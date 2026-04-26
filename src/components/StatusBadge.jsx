import { getStatus } from '../utils.js';

export default function StatusBadge({ status }) {
  const s = getStatus(status);
  return <span style={{ background:`${s.color}18`, border:`1px solid ${s.color}44`, borderRadius:3, padding:'2px 9px', fontSize:11, color:s.color }}>{s.label}</span>;
}
