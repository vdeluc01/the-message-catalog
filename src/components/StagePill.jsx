import { getStage, effectiveStage } from '../utils.js';

export default function StagePill({ stageId, take, masterLyrics }) {
  const id = take ? effectiveStage(take, masterLyrics) : (stageId || 'idea');
  const s = getStage(id);
  return <span style={{ background:`${s.color}18`, border:`1px solid ${s.color}55`, borderRadius:3, padding:'2px 9px', fontSize:11, color:s.color }}>{s.icon} {s.label}</span>;
}
