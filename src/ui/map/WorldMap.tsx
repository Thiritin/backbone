import { Warehouse } from "lucide-react";
import { memo, useEffect, useRef, type ReactNode } from "react";
import { Logo } from "../art/logos";
import { CABLES, CITIES, COAST, type City } from "./world-data";
import "./map.css";

export type { City };
export interface Bounds { west: number; south: number; east: number; north: number }
export interface Marker {
  id: string; lon: number; lat: number; label: string;
  kind: "basement" | "location" | "datacenter";
  selected?: boolean; alert?: boolean; provider?: string | null; count?: number;
}
interface Props { initial?: Bounds; markers?: Marker[]; onMarkerClick?: (id: string) => void; onCityClick?: (city: City) => void; className?: string; children?: ReactNode }

export const EUROPE: Bounds = { west: -9.14, south: 41.9, east: 21.01, north: 59.91 };
export const WORLD: Bounds = { west: -180, south: -58, east: 180, north: 84 };
export const cityNamed = (name: string) => CITIES.find((c) => c.name === name);

// Equirectangular with its standard parallel at about 45 degrees, so Europe keeps its shape.
const KX = 0.7;
const X = (lon: number) => Math.round(lon * KX * 100) / 100;
const Y = (lat: number) => -lat;
const X0 = X(WORLD.west), X1 = X(WORLD.east), Y0 = Y(WORLD.north), Y1 = Y(WORLD.south);
const MIN_W = 4;

const ring = (pts: [number, number][]) => "M" + pts.map(([lon, lat]) => `${X(lon)} ${Y(lat)}`).join("L");
// Catmull-Rom through the waypoints, as cubic Beziers.
function curve(ll: [number, number][]) {
  const p = ll.map(([lon, lat]) => [X(lon), Y(lat)]);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c;
    const f = (n: number) => Math.round(n * 100) / 100;
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return d;
}

const LAND = COAST.map((r) => ring(r) + "Z").join("");
let GRID = "";
for (let lon = -180; lon <= 180; lon += 15) GRID += `M${X(lon)} ${Y0}V${Y1}`;
for (let lat = -45; lat <= 75; lat += 15) GRID += `M${X0} ${Y(lat)}H${X1}`;
// A path past the dateline is drawn again one world over; the clip hides the overhang.
const CABLE_D = CABLES.map((c) => ({
  ...c,
  d: c.paths.flatMap((p) => {
    const d = curve(p), xs = p.map((q) => q[0]);
    const shift = (lon: number) => ({ d, tf: `translate(${X(lon)} 0)` });
    return [{ d, tf: undefined }, ...(Math.max(...xs) > 180 ? [shift(-360)] : []), ...(Math.min(...xs) < -180 ? [shift(360)] : [])];
  }),
}));

type View = { x: number; y: number; w: number };

export function WorldMap({ initial = EUROPE, markers = [], onMarkerClick, onCityClick, className, children }: Props) {
  const wrap = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), tip = useRef<HTMLDivElement>(null);
  const cityClick = useRef(onCityClick);
  cityClick.current = onCityClick;
  const dragged = useRef(false);
  const pins = markers.map((m) => `${m.id}:${m.label}:${m.lon}:${m.lat}`).join("|");
  useEffect(() => declutter(svg.current!), [pins]);

  useEffect(() => {
    const el = wrap.current!, s = svg.current!, t = tip.current!;
    let cw = 0, ch = 0, raf = 0, z = "";
    const cur: View = { x: 0, y: 0, w: X1 - X0 }, goal: View = { ...cur };
    const clamp = (v: View) => {
      const a = ch / cw;
      v.w = Math.min(Math.max(v.w, MIN_W), X1 - X0, (Y1 - Y0) / a);
      v.x = Math.min(Math.max(v.x, X0), X1 - v.w);
      v.y = Math.min(Math.max(v.y, Y0), Y1 - v.w * a);
    };
    const apply = () => {
      s.setAttribute("viewBox", `${cur.x} ${cur.y} ${cur.w} ${(cur.w * ch) / cw}`);
      const k = cur.w / cw, nz = k > 0.12 ? "1" : k > 0.035 ? "2" : "3";
      s.style.setProperty("--k", String(k));
      if (nz !== z) el.dataset.z = z = nz;
    };
    const step = () => {
      cur.w *= (goal.w / cur.w) ** 0.3;
      cur.x += (goal.x - cur.x) * 0.3;
      cur.y += (goal.y - cur.y) * 0.3;
      const done = Math.abs(goal.w - cur.w) + Math.abs(goal.x - cur.x) + Math.abs(goal.y - cur.y) < cur.w * 1e-4;
      if (done) Object.assign(cur, goal);
      apply();
      raf = done ? 0 : requestAnimationFrame(step);
      if (done) declutter(s);
    };
    const animate = () => { if (!raf) raf = requestAnimationFrame(step); };
    const jump = () => { clamp(cur); Object.assign(goal, cur); apply(); declutter(s); };
    // Zoom by factor f keeping the map point under the screen fraction (px, py) in place.
    const zoom = (f: number, px: number, py: number, v: View = goal) => {
      const a = ch / cw, wx = cur.x + px * cur.w, wy = cur.y + py * cur.w * a;
      v.w *= f;
      clamp(v);
      v.x = wx - px * v.w;
      v.y = wy - py * v.w * a;
      clamp(v);
    };

    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (!width || !height) return;
      if (!cw) {
        cw = width; ch = height;
        const a = ch / cw, b = initial;
        cur.w = Math.max((X(b.east) - X(b.west)) * 1.12, ((Y(b.south) - Y(b.north)) * 1.12) / a);
        cur.x = (X(b.west) + X(b.east)) / 2 - cur.w / 2;
        cur.y = (Y(b.north) + Y(b.south)) / 2 - (cur.w * a) / 2;
      } else {
        cur.w *= width / cw;
        cw = width; ch = height;
      }
      jump();
    });
    ro.observe(el);

    const rel = (cx: number, cy: number) => { const r = s.getBoundingClientRect(); return [(cx - r.left) / r.width, (cy - r.top) / r.height]; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [px, py] = rel(e.clientX, e.clientY);
      zoom(Math.exp(e.deltaY * (e.deltaMode ? 0.05 : e.ctrlKey ? 0.01 : 0.002)), px, py);
      animate();
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    const pts = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; dragged.current = false; }
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) {
        const c = (e.target as Element).closest<SVGElement>("[data-cable]");
        t.hidden = !c;
        if (c) { const r = el.getBoundingClientRect(); t.textContent = c.dataset.cable!; t.style.transform = `translate(${e.clientX - r.left + 12}px, ${e.clientY - r.top + 12}px)`; }
        return;
      }
      if (!dragged.current && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
      if (!dragged.current) { dragged.current = true; s.setPointerCapture(e.pointerId); s.classList.add("drag"); t.hidden = true; }
      const prev = [...pts.values()];
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (prev.length === 1) {
        cur.x -= ((e.clientX - p.x) * cur.w) / cw;
        cur.y -= ((e.clientY - p.y) * cur.w) / cw;
      } else {
        const now = [...pts.values()];
        const mid = (q: typeof now) => [(q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2];
        const [ax, ay] = mid(prev), [bx, by] = mid(now);
        cur.x -= ((bx - ax) * cur.w) / cw;
        cur.y -= ((by - ay) * cur.w) / cw;
        const [px, py] = rel(bx, by);
        zoom(Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y) / Math.max(1, Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y)), px, py, cur);
      }
      jump();
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (!pts.size) s.classList.remove("drag"); };
    const leave = () => { t.hidden = true; };
    s.addEventListener("pointerdown", down);
    s.addEventListener("pointermove", move);
    s.addEventListener("pointerup", up);
    s.addEventListener("pointercancel", up);
    s.addEventListener("pointerleave", leave);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("wheel", onWheel);
      s.removeEventListener("pointerdown", down);
      s.removeEventListener("pointermove", move);
      s.removeEventListener("pointerup", up);
      s.removeEventListener("pointercancel", up);
      s.removeEventListener("pointerleave", leave);
    };
    // The initial view applies on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = new Map<string, Marker[]>();
  for (const m of markers) { const k = `${m.lon},${m.lat}`; groups.set(k, [...(groups.get(k) ?? []), m]); }

  return (
    <div ref={wrap} className={`wm ${className ?? ""}`}>
      <svg ref={svg} role="group" aria-label="World map" onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); dragged.current = false; } }}>
        <Base onCity={(c) => cityClick.current?.(c)} />
        {[...groups.values()].map((g) => (
          <g key={g[0].id} transform={`translate(${X(g[0].lon)} ${Y(g[0].lat)})`}>
            <g className="wm-s">
              {g[0].kind === "datacenter"
                ? g.map((m, i) => <Pin key={m.id} m={m} y={-i * 24} onClick={() => onMarkerClick?.(m.id)} />)
                : <><path className="wm-stem" d="M0 0V-9" />{g.map((m, i) => <Pin key={m.id} m={m} y={-19 - i * 24} onClick={() => onMarkerClick?.(m.id)} />)}</>}
            </g>
          </g>
        ))}
      </svg>
      <div ref={tip} className="wm-tip" hidden />
      {children}
    </div>
  );
}

// Hides city names that a pin or its label covers; the names keep their size, so they are measured while hidden.
function declutter(s: SVGSVGElement) {
  const pins = [...s.querySelectorAll(".wm-pin")].map((p) => p.getBoundingClientRect());
  const cities = [...s.querySelectorAll<SVGGElement>(".wm-city")].map((c) => [c, c.querySelector("text")!.getBoundingClientRect()] as const);
  for (const [c, r] of cities) {
    c.classList.toggle("wm-covered", r.width > 0 && pins.some((p) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top));
  }
}

function Pin({ m, y, onClick }: { m: Marker; y: number; onClick: () => void }) {
  return (
    <g className={`wm-pin wm-${m.kind}${m.selected ? " sel" : ""}`} transform={`translate(0 ${y})`} role="button" tabIndex={0} aria-label={m.label} aria-pressed={m.selected}
      onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>
      <title>{m.label}</title>
      <circle r="10" />
      <g transform="translate(-7 -7)">
        {m.kind === "datacenter" ? <Warehouse width={14} height={14} strokeWidth={1.75} /> : <Logo provider={m.kind === "basement" ? null : m.provider ?? null} size={14} />}
      </g>
      {(m.count ?? 0) > 1 && <g className="wm-badge" transform="translate(9 -8)"><circle r="6" /><text y="3">{m.count}</text></g>}
      {m.alert && <circle className="wm-alert" cx="7.5" cy="-7.5" r="3.5" />}
      <text className="wm-plabel" x="15" y="4">{m.label}</text>
    </g>
  );
}

// Coast, graticule, cables and cities never change, so they render once.
const Base = memo(function Base({ onCity }: { onCity: (c: City) => void }) {
  return (
    <>
      <path className="wm-grat" d={GRID} />
      <path className="wm-land" d={LAND} />
      <clipPath id="wm-world"><rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} /></clipPath>
      <g className="wm-cables" clipPath="url(#wm-world)">
        {CABLE_D.map((c) => (
          <g key={c.id} className="wm-cable" data-cable={c.name}>
            {c.d.map(({ d, tf }, i) => <g key={i} transform={tf}><path className="wm-cable-line" d={d} /><path className="wm-cable-hit" d={d} /></g>)}
          </g>
        ))}
      </g>
      <g className="wm-cities">
        {CITIES.map((c) => (
          <g key={c.code} className={`wm-city wm-t${c.tier}`} transform={`translate(${X(c.lon)} ${Y(c.lat)})`} onClick={() => onCity(c)}>
            <g className="wm-s"><circle r="2.2" /><text x="5" y="3.5">{c.name}</text></g>
          </g>
        ))}
      </g>
    </>
  );
}, () => true);
