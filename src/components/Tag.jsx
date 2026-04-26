export default function Tag({ label, color }) {
  return <span style={{ background:'#141414', border:`1px solid ${color||'#252525'}`, borderRadius:3, padding:'2px 8px', fontSize:11, color:color||'#666' }}>{label}</span>;
}
