import "./setting.css";
import { iso } from "../grid";
import { flat } from "./geo";
import type { Item, SiteSpec } from "./layout";

// What a field looks like in a month: ploughed over winter, sprouting in spring, ripe in summer, stubble in autumn.
export const phase = (month: number): "plough" | "sprout" | "crop" | "stubble" => (month < 3 || month === 11 ? "plough" : month < 5 ? "sprout" : month < 8 ? "crop" : "stubble");

// A flat field with furrows along x; each field runs a few months ahead of its neighbour.
function Field({ i, month }: { i: Item; month: number }) {
  const furrows = Array.from({ length: Math.floor((i.y1 - i.y0) / 2) - 1 }, (_, n) => { const y = i.y0 + 2 * n + 2, a = iso(i.x0, y), b = iso(i.x1, y); return `M${a.x} ${a.y}L${b.x} ${b.y}`; }).join("");
  return <g className={`w-fld-${phase((month + 4 * (i.count ?? 0)) % 12)}`}><polygon points={flat(0, [i.x0, i.y0], [i.x1, i.y0], [i.x1, i.y1], [i.x0, i.y1])} /><path d={furrows} /></g>;
}

// Two steel rails on ties along x.
function Rail({ i }: { i: Item }) {
  const line = (y: number) => { const a = iso(i.x0, y), b = iso(i.x1, y); return `M${a.x} ${a.y}L${b.x} ${b.y}`; };
  const ties = Array.from({ length: Math.floor((i.x1 - i.x0) / 1.4) }, (_, k) => { const a = iso(i.x0 + k * 1.4, i.y0 + 0.2), b = iso(i.x0 + k * 1.4, i.y1 - 0.2); return `M${a.x} ${a.y}L${b.x} ${b.y}`; }).join("");
  return <g><polygon className="w-f-gravel" points={flat(0, [i.x0, i.y0], [i.x1, i.y0], [i.x1, i.y1], [i.x0, i.y1])} /><path className="w-f-ties" d={ties} /><path className="w-f-steel" d={line(i.y0 + 0.8) + line(i.y1 - 0.8)} /></g>;
}

const EDGE = { industrial: ["w-f-lawn", "w-f-slab"], nowhere: ["w-f-lawn", "w-f-gravel"], business: ["w-f-lawn", "w-f-paving"], suburb: ["w-f-lawn", "w-f-apron"] } as const;

// The ground of a compound: the surroundings, the plot in its surface and the fields and rails of the setting.
export function SettingGround({ s, month }: { s: SiteSpec; month: number }) {
  const { plot } = s, [around, surface] = EDGE[s.setting], rect = (x0: number, y0: number, x1: number, y1: number) => flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  return (
    <g pointerEvents="none">
      <defs><pattern id="sp-mesh2" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0M0 0L8 8" className="w-mesh-line" /></pattern></defs>
      <polygon className={around} points={rect(plot.x0 - 700, plot.y0 - 700, plot.x1 + 700, plot.y1 + 700)} />
      {s.items.filter((i) => i.t === "field").map((i, k) => <Field key={k} i={i} month={month} />)}
      {s.items.filter((i) => i.t === "rail").map((i, k) => <Rail key={k} i={i} />)}
      <polygon className={surface} points={rect(plot.x0, plot.y0, plot.x1, plot.y1)} />
      {s.setting === "industrial" && <polygon className="w-f-asph" points={rect(plot.x0, plot.y1 - 3, plot.x1, plot.y1)} />}
      {s.setting === "business" && <polygon className="w-f-lawn" points={rect(plot.x0, plot.y0, plot.x1, plot.y0 + 2)} />}
    </g>
  );
}
