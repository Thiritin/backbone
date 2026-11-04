import { at3, pts, WALL } from "../draw";
import { iso } from "../grid";
import { flat, faceY } from "./geo";
import { fnv1a, type SiteSpec } from "./layout";

// The ground behind everything: one flat tone over the whole viewport, so no pan or zoom shows a void.
export function Ground({ view, kind }: { view: { x: number; y: number; w: number; h: number }; kind: SiteSpec["kind"] }) {
  return <rect className={kind === "garden" ? "w-f-soil" : kind === "plot" ? "w-f-lawn-far" : "w-f-neutral"} x={view.x - 2} y={view.y - 2} width={view.w + 4} height={view.h + 4} pointerEvents="none" />;
}

// Three to six seeded patches of a slightly different tone inside a ground rectangle: flat blobs of five corners, no pattern.
export function Patches({ seed, tag, x0, y0, x1, y1, z = 0, tone }: { seed: number; tag: string; x0: number; y0: number; x1: number; y1: number; z?: number; tone: string }) {
  const r = (k: number) => (fnv1a(`${seed}:${tag}:${k}`) % 1000) / 1000, n = 3 + Math.floor(r(0) * 4);
  return (
    <g pointerEvents="none">
      {Array.from({ length: n }, (_, k) => {
        const cx = x0 + (x1 - x0) * (0.1 + 0.8 * r(k * 9 + 1)), cy = y0 + (y1 - y0) * (0.1 + 0.8 * r(k * 9 + 2)), rx = Math.min(5, (x1 - x0) * 0.14) * (0.6 + r(k * 9 + 3)), ry = Math.min(3.5, (y1 - y0) * 0.2) * (0.6 + r(k * 9 + 4));
        const ring = Array.from({ length: 5 }, (_, j) => { const a = (j / 5) * Math.PI * 2 + r(k * 9 + 5) * 2, m = 0.75 + 0.25 * r(k * 9 + 6 + (j % 3)); return [cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m] as [number, number]; });
        return <polygon key={k} className={`${tone}-${k % 2 ? "a" : "b"}`} points={flat(z, ...ring)} />;
      })}
    </g>
  );
}

// An L of ground at the wall top behind both far walls, reaching out by e tiles.
const garden = (z: number, w: number, h: number, e: number, x0: number, y0: number) => flat(z, [x0 - e, y0 - e], [w + e, y0 - e], [w + e, 0], [0, 0], [0, h], [x0 - e, h]);

// A flat field with parallel furrows along x and a hedge-green border.
function Field({ k, x0, y0, x1, y1 }: { k: "a" | "b"; x0: number; y0: number; x1: number; y1: number }) {
  const furrows = Array.from({ length: Math.floor((y1 - y0) / 2) - 1 }, (_, n) => { const y = y0 + 2 * n + 2, a = iso(x0, y), b = iso(x1, y); return `M${a.x} ${a.y}L${b.x} ${b.y}`; }).join("");
  return <g><polygon className={`w-f-field-${k}`} points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} /><path className={`w-f-furrow-${k}`} d={furrows} /></g>;
}

export function GroundBack({ s }: { s: SiteSpec }) {
  const { w, h, plot } = s;
  if (s.kind === "garden") {
    const E = 60, left = (x0: number, x1: number, y: number) => pts(at3(x0, y, WALL), at3(x1, y, WALL), at3(x1, y, -400), at3(x0, y, -400));
    return (
      <g pointerEvents="none">
        <polygon className="w-f-soil-l" points={left(-E, 0, h)} />
        <polygon className="w-f-soil-l" points={left(w, w + E, 0)} />
        <polygon className="w-f-lawn-far" points={garden(WALL, w, h, E, 0, 0)} />
        <polygon className="w-f-lawn" points={garden(WALL, w, h, 0, plot.x0, plot.y0)} />
        <Patches seed={s.seed} tag="gb" x0={plot.x0} y0={plot.y0} x1={w} y1={-0.5} z={WALL} tone="w-f-patch" />
        <Patches seed={s.seed} tag="gl" x0={plot.x0} y0={0} x1={-0.5} y1={h} z={WALL} tone="w-f-patch" />
        <polygon className="w-f-slab-l" points={faceY(0, w, h, 0, -6)} />
        <polygon className="w-f-slab-r" points={pts(at3(w, h, 0), at3(w, 0, 0), at3(w, 0, -6), at3(w, h, -6))} />
      </g>
    );
  }
  if (s.kind !== "plot") return null;
  return (
    <g pointerEvents="none">
      <polygon className="w-f-lawn" points={flat(0, [plot.x0 - 140, plot.y0 - 100], [plot.x1 + 140, plot.y0 - 100], [plot.x1 + 140, plot.y1 + 140], [plot.x0 - 140, plot.y1 + 140])} />
      <Field k="a" x0={plot.x0 - 40} y0={plot.y1 + 28} x1={plot.x0 - 6} y1={plot.y1 + 44} />
      <Field k="b" x0={plot.x0 + 2} y0={plot.y1 + 32} x1={plot.x0 + 30} y1={plot.y1 + 46} />
      <Field k="a" x0={plot.x1 + 6} y0={plot.y1 + 30} x1={plot.x1 + 40} y1={plot.y1 + 44} />
      <Patches seed={s.seed} tag="pb" x0={plot.x0 - 100} y0={plot.y0 - 90} x1={plot.x1 + 100} y1={plot.y0 - 2} tone="w-f-patch" />
      <polygon className="w-f-apron" points={flat(0, [plot.x0, plot.y0], [plot.x1, plot.y0], [plot.x1, plot.y1], [plot.x0, plot.y1])} />
    </g>
  );
}

// The room's silhouette is cut out so the night darkens the site once and the room once.
export function SiteNight({ s, view, opacity }: { s: SiteSpec; view: { x: number; y: number; w: number; h: number }; opacity: number }) {
  if (s.kind === "none") return null;
  const { w, h } = s, q = (p: { x: number; y: number }) => `${p.x} ${p.y}`;
  const room = [iso(0, h), at3(0, h, WALL), at3(0, 0, WALL), at3(w, 0, WALL), iso(w, 0), iso(w, h)];
  const d = `M${view.x - 2} ${view.y - 2}h${view.w + 4}v${view.h + 4}h${-view.w - 4}ZM${room.map(q).join("L")}Z`;
  return <path className="w-dark" fillRule="evenodd" pointerEvents="none" style={{ opacity }} d={d} />;
}

