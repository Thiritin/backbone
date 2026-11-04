import { at3, Prism } from "../draw";
import { faceX, faceY, flat } from "./geo";
import type { Item } from "./layout";

export interface Gear { kind: "xfmr" | "cond"; x: number; y: number }
const FENCE = 40;

export function Transformer({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Prism x0={x - 0.15} y0={y - 0.15} x1={x + 2.15} y1={y + 1.75} z1={3} tone="w-tone-concrete" />
      <Prism x0={x + 2.1} y0={y + 0.25} x1={x + 2.55} y1={y + 1.35} z0={4} z1={28} tone="w-tone-cond" />
      <Prism x0={x} y0={y} x1={x + 2} y1={y + 1.6} z0={3} z1={34} tone="w-tone-xfmr" />
      {[0.45, 1, 1.55].map((d) => <Prism key={d} x0={x + d - 0.14} y0={y + 0.7} x1={x + d + 0.14} y1={y + 0.98} z0={34} z1={47} tone="w-tone-porcelain" />)}
    </g>
  );
}

export function Condenser({ x, y }: { x: number; y: number }) {
  const c = at3(x + 1.1, y + 0.7, 24);
  return (
    <g>
      <Prism x0={x} y0={y} x1={x + 2.2} y1={y + 1.4} z1={24} tone="w-tone-cond" />
      <ellipse className="w-fan" cx={c.x} cy={c.y} rx={24} ry={12} />
      <path className="w-fan-blade" d={`M${c.x - 16} ${c.y - 2}L${c.x + 16} ${c.y + 2}M${c.x - 6} ${c.y - 10}L${c.x + 6} ${c.y + 10}M${c.x + 6} ${c.y - 10}L${c.x - 6} ${c.y + 10}`} />
    </g>
  );
}

// A mesh panel of the fence on a vertical plane with its top rail; posts every two tiles.
const MeshY = ({ x0, x1, y }: { x0: number; x1: number; y: number }) => (
  <g><polygon className="w-mesh-panel" points={faceY(x0, x1, y, 0, FENCE)} fill="url(#w-mesh)" />
    <polyline className="w-rail" points={`${at3(x0, y, FENCE).x},${at3(x0, y, FENCE).y} ${at3(x1, y, FENCE).x},${at3(x1, y, FENCE).y}`} />
    {Array.from({ length: Math.floor(x1 - x0) / 2 + 1 | 0 }, (_, k) => <polygon key={k} className="w-fpost" points={faceY(x0 + k * 2 - 0.06, x0 + k * 2 + 0.06, y, 0, FENCE + 4)} />)}
  </g>
);
const MeshX = ({ y0, y1, x }: { y0: number; y1: number; x: number }) => (
  <g><polygon className="w-mesh-panel" points={faceX(x, y0, y1, 0, FENCE)} fill="url(#w-mesh)" />
    <polyline className="w-rail" points={`${at3(x, y0, FENCE).x},${at3(x, y0, FENCE).y} ${at3(x, y1, FENCE).x},${at3(x, y1, FENCE).y}`} />
    {Array.from({ length: Math.floor(y1 - y0) / 2 + 1 | 0 }, (_, k) => <polygon key={k} className="w-fpost" points={faceX(x, y0 + k * 2 - 0.06, y0 + k * 2 + 0.06, 0, FENCE + 4)} />)}
  </g>
);

// A fenced yard: mesh fence with a gate in the front, gravel floor and the gear list.
export function Yard({ i, gear }: { i: Item; gear: Gear[] }) {
  const { x0, x1, y0, y1 } = i, gx = (x0 + x1) / 2;
  return (
    <g pointerEvents="none">
      <polygon className="w-f-yard" points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} />
      <MeshY x0={x0} x1={x1} y={y0} />
      <MeshX y0={y0} y1={y1} x={x0} />
      {[...gear].sort((a, b) => a.x + a.y - b.x - b.y).map((g, k) => g.kind === "xfmr" ? <Transformer key={k} x={g.x} y={g.y} /> : <Condenser key={k} x={g.x} y={g.y} />)}
      <MeshY x0={x0} x1={gx - 1.2} y={y1} />
      <MeshY x0={gx + 1.2} x1={x1} y={y1} />
      <MeshX y0={y0} y1={y1} x={x1} />
      <Prism x0={gx - 1.3} y0={y1 - 0.1} x1={gx - 1.1} y1={y1 + 0.1} z1={FENCE + 8} tone="w-tone-fence" />
      <Prism x0={gx + 1.1} y0={y1 - 0.1} x1={gx + 1.3} y1={y1 + 0.1} z1={FENCE + 8} tone="w-tone-fence" />
      <polygon className="w-mesh-panel" points={faceX(gx + 1.2, y1, y1 - 1.1, 0, FENCE - 4)} fill="url(#w-mesh)" />
    </g>
  );
}
