import type { KeyboardEvent, ReactNode } from "react";
import type { DeviceModel } from "../../sim/10-catalog/hardware";
import type { CableKind, End } from "../../sim/50-state";
import { Back, portSpots, type Side } from "./backs";
import { CABLE, Defs, Front, type Lamp, type PortLamp } from "./fronts";

export interface RackItem { id: string; slot: number; model: DeviceModel; brand: string; name: string; state: Lamp; ports: PortLamp[]; groups: number[][] }
// One cable end in this rack; peer is set when the other end is in this rack too, label names it otherwise.
export interface RackLink { id: string; end: End; peer: End | null; kind: CableKind; label: string }

interface Props {
  units: number;
  items: RackItem[];
  links?: RackLink[];
  side?: Side;
  w: number;
  u: number;
  selected?: string | null;
  // The cable to highlight; the others fade.
  hot?: string | null;
  onDevice: (id: string) => void;
  // lo and hi are the free unit range around the clicked spot.
  onFree: (lo: number, hi: number, el: Element) => void;
}

const MONO = "JetBrains Mono, monospace", DIM = "oklch(0.62 0.01 255)", ROW = 12;

const press = (fn: (el: Element) => void) => ({
  role: "button",
  tabIndex: 0,
  onClick: (e: { currentTarget: Element }) => fn(e.currentTarget),
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e.currentTarget); }
  },
});

// A rack is drawn top unit first; runs of 3 or more free units collapse into one band.
// Cables between two visible ports hang as curves; the rest run up a lane on the right and out of the top.
export function RackFront({ units, items, links = [], side = "front", w, u, selected, hot = null, onDevice, onFree }: Props) {
  const pad = 30, fs = Math.max(7, u * 0.4), at = new Map<number, RackItem>();
  for (const it of items) for (let k = 0; k < it.model.height; k++) at.set(it.slot + k, it);
  const placed = new Map<string, { it: RackItem; y: number; h: number }>();
  const out: ReactNode[] = [];
  let y = 0;
  for (let n = units; n >= 1;) {
    if (!at.has(n)) {
      let m = n;
      while (m >= 1 && !at.has(m)) m--;
      const lo = m + 1, hi = n;
      if (hi - lo >= 2) {
        const bh = u * 1.4;
        out.push(
          <g key={`f${n}`} className="rack-free" aria-label={`U${lo} to U${hi} free`} {...press((el) => onFree(lo, hi, el))}>
            <rect x={pad} y={y + 1} width={w} height={bh - 2} rx="2" fill="oklch(0.2 0.006 255 / 0.01)" stroke="oklch(0.3 0.006 255)" strokeDasharray="3 3" />
            <text x={pad + w / 2} y={y + bh / 2 + fs * 0.35} textAnchor="middle" fontFamily={MONO} fontSize={fs} fill={DIM}>U{lo}–U{hi} free</text>
          </g>,
        );
        y += bh;
        n = m;
        continue;
      }
      for (let k = n; k > m; k--) {
        out.push(
          <g key={`e${k}`} className="rack-free" aria-label={`U${k} free`} {...press((el) => onFree(lo, hi, el))}>
            <text x={pad - 8} y={y + u / 2 + fs * 0.35} textAnchor="end" fontFamily={MONO} fontSize={fs} fill={DIM}>{k}</text>
            <rect x={pad} y={y + 0.5} width={w} height={u - 1} fill="oklch(0.2 0.006 255)" stroke="oklch(0.24 0.006 255)" strokeWidth="0.5" />
          </g>,
        );
        y += u;
      }
      n = m;
      continue;
    }
    const it = at.get(n)!, top = it.slot + it.model.height - 1, h = it.model.height * u;
    for (let k = 0; k < it.model.height; k++) {
      out.push(<text key={`n${n - k}`} x={pad - 8} y={y + k * u + u / 2 + fs * 0.35} textAnchor="end" fontFamily={MONO} fontSize={fs} fill={DIM}>{n - k}</text>);
    }
    if (top === n) {
      placed.set(it.id, { it, y, h });
      out.push(
        <g key={it.id} className="rack-dev" transform={`translate(${pad} ${y})`} aria-label={it.name} aria-pressed={it.id === selected} {...press(() => onDevice(it.id))}>
          {side === "front" ? <Front {...it} w={w} h={h} /> : <Back {...it} w={w} h={h} />}
        </g>,
      );
      if (it.id === selected) out.push(<rect key="sel" x={pad - 2} y={y - 1.5} width={w + 4} height={h + 3} rx="3" fill="none" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />);
    }
    y += h;
    n = it.slot - 1;
  }

  const spot = (e: End) => {
    const p = placed.get(e.device);
    const s = p && portSpots(p.it.model, p.it.name, side, w, p.h).get(e.port);
    return s && { x: pad + s.x + s.w / 2, y: p.y + s.y + s.h / 2 };
  };
  const curves: ReactNode[] = [], drawn = new Set<string>();
  const loose: { l: RackLink; x: number; y: number }[] = [];
  for (const l of links) {
    const a = spot(l.end);
    if (!a) continue;
    const b = l.peer && spot(l.peer);
    if (!b) { loose.push({ l, ...a }); continue; }
    if (drawn.has(l.id)) continue;
    drawn.add(l.id);
    const sag = 10 + Math.abs(a.x - b.x) * 0.08 + Math.abs(a.y - b.y) * 0.25;
    curves.push(<Wire key={l.id} kind={l.kind} hot={hot === null ? undefined : hot === l.id} d={`M${a.x} ${a.y}C${a.x} ${a.y + sag} ${b.x} ${b.y + sag} ${b.x} ${b.y}`} />);
  }
  // Top ports take the inner lanes and the lowest label rows, so no two cables cross.
  loose.sort((p, q) => p.y - q.y);
  const head = loose.length ? loose.length * ROW + 6 : 0, lane0 = pad + w + 9, right = Math.max(pad, 14 + loose.length * 4);
  const W = pad + w + right, H = head + y + 8;
  const exits = loose.map(({ l, x, y: py }, i) => {
    const lx = lane0 + i * 4, ry = head - 4 - i * ROW, py2 = py + head + 4;
    return (
      <g key={`x${l.id}${l.end.device}`}>
        <Wire kind={l.kind} hot={hot === null ? undefined : hot === l.id} d={`M${x} ${py2}C${x} ${py2 + 12} ${lx} ${py2 + 8} ${lx} ${py2 - 4}L${lx} ${ry + 4}Q${lx} ${ry} ${lx - 4} ${ry}L${pad} ${ry}`} />
        <text x={pad + 2} y={ry - 3} fontFamily={MONO} fontSize="8" fill="var(--text-2)">{l.label}</text>
      </g>
    );
  });
  return (
    <svg className="device-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={side === "front" ? "Rack front" : "Rack back"}>
      <Defs />
      <rect y={head} width={W} height={H - head} rx="4" fill="var(--rack)" />
      <g transform={`translate(0 ${head + 4})`}>
        <rect x={pad - 6} y="-2" width="5" height={y + 4} rx="1" fill="var(--metal-2)" />
        <rect x={pad + w + 1} y="-2" width="5" height={y + 4} rx="1" fill="var(--metal-2)" />
        {out}
        <g pointerEvents="none">{curves}</g>
      </g>
      <g pointerEvents="none">{exits}</g>
    </svg>
  );
}

// hot is undefined when nothing is highlighted; otherwise the hot cable thickens and the rest fade.
function Wire({ d, kind, hot }: { d: string; kind: CableKind; hot?: boolean }) {
  return (
    <g opacity={hot === false ? 0.3 : 1}>
      <path d={d} fill="none" stroke="oklch(0.12 0.004 255)" strokeWidth={hot ? 5 : 3.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={CABLE[kind]} strokeWidth={hot ? 3 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
