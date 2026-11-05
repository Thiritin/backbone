import type { ReactElement } from "react";
import { iso } from "../grid";
import type { Item, SiteSpec } from "./layout";

// Developer overlay behind the ?grid query flag: the whole-tile lattice over the plot and each item's footprint diamond.
export const GRID_DEBUG = typeof location !== "undefined" && new URLSearchParams(location.search).has("grid");

const pt = (x: number, y: number) => { const p = iso(x, y); return `${p.x},${p.y}`; };

export function GridDebug({ s, layer }: { s: SiteSpec; layer: Item["layer"] }) {
  const { x0, y0, x1, y1 } = s.plot, lines: ReactElement[] = [];
  for (let x = Math.ceil(x0); x <= x1; x++) lines.push(<line key={`x${x}`} x1={iso(x, y0).x} y1={iso(x, y0).y} x2={iso(x, y1).x} y2={iso(x, y1).y} stroke={x % 5 ? "#0af" : "#f0a"} strokeWidth={x % 5 ? 0.5 : 1} opacity={0.55} />);
  for (let y = Math.ceil(y0); y <= y1; y++) lines.push(<line key={`y${y}`} x1={iso(x0, y).x} y1={iso(x0, y).y} x2={iso(x1, y).x} y2={iso(x1, y).y} stroke={y % 5 ? "#0af" : "#f0a"} strokeWidth={y % 5 ? 0.5 : 1} opacity={0.55} />);
  return (
    <g pointerEvents="none">
      {lines}
      {s.items.filter((i) => i.layer === layer && i.t !== "walk" && i.t !== "street").map((i, k) => <polygon key={k} points={[pt(i.x0, i.y0), pt(i.x1, i.y0), pt(i.x1, i.y1), pt(i.x0, i.y1)].join(" ")} fill="none" stroke="#f60" strokeWidth={1} />)}
    </g>
  );
}
