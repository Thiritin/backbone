import "./materials.css";
import { iso } from "../grid";
import { MODELS } from "./models.gen";

const PINE = MODELS.find((m) => m.id === "pine")!;
// Snow lies on the top-facing edge of each pine tier: flat white polygons on the lit and the shaded face, clipped to the needle faces.
const CAPS: Record<"l" | "r", string[]> = {
  l: ["7.4,-253.5 -35.9,-214.1 5.3,-206", "-76.1,-150.1 -30,-132.8 -30,-116.8 -85.5,-131.7", "-87.9,-104.3 -45,-92 -45,-76 -100,-87"],
  r: ["7.4,-253.5 30,-214.1 5.3,-206", "57.7,-150 25,-133.6 25,-117.6 70,-115", "83.3,-94.7 45,-84 45,-68 94,-79"],
};

// The baked models, one group per model in the room's projection with its origin on the footprint's near-left ground corner.
export function ModelDefs() {
  return (
    <defs>
      {MODELS.map((m) => <g key={m.id} id={`sm-${m.id}`} className="sm">{m.paths.map(([c, d], k) => <path key={k} className={c} d={d} />)}</g>)}
      {["l", "r"].map((k) => <clipPath key={k} id={`sp-pc-${k}`}>{PINE.paths.filter(([c]) => c === `m-needle f-${k}`).map(([, d], n) => <path key={n} d={d} />)}</clipPath>)}
      <pattern id="sp-mesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" className="w-mesh-line" /></pattern>
    </defs>
  );
}

// An instance at tile (x, y); the tone class recolours its paint or walls, z lifts it in px.
export function Model({ id, x, y, tone, z = 0 }: { id: string; x: number; y: number; tone?: string; z?: number }) {
  const p = iso(x, y);
  const use = <use href={`#sm-${id}`} x={p.x} y={p.y - z} className={tone} />;
  if (id !== "pine") return use;
  return (
    <>{use}
      <g className="w-pine-cap" transform={`translate(${p.x} ${p.y - z})`}>
        {(["l", "r"] as const).map((k) => <g key={k} clipPath={`url(#sp-pc-${k})`} className={`w-pine-cap-${k}`}>{CAPS[k].map((p) => <polygon key={p} points={p} />)}</g>)}
      </g>
    </>
  );
}
