import "./materials.css";
import { iso } from "../grid";
import { MODELS } from "./models.gen";

// The baked models, one group per model in the room's projection with its origin on the footprint's near-left ground corner.
export function ModelDefs() {
  return (
    <defs>
      {MODELS.map((m) => <g key={m.id} id={`sm-${m.id}`} className="sm">{m.paths.map(([c, d], k) => <path key={k} className={c} d={d} />)}</g>)}
      <pattern id="sp-mesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" className="w-mesh-line" /></pattern>
    </defs>
  );
}

// An instance at tile (x, y); the tone class recolours its paint, walls or leaves, z lifts it in px.
export function Model({ id, x, y, tone, z = 0 }: { id: string; x: number; y: number; tone?: string; z?: number }) {
  const p = iso(x, y);
  return <use href={`#sm-${id}`} x={p.x} y={p.y - z} className={tone} />;
}
