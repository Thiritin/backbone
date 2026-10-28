import type { KeyboardEvent, ReactNode } from "react";
import type { DeviceModel } from "../../sim/10-catalog/hardware";
import { BAY, Defs, Front, shelfHeight, type Lamp, type PortLamp } from "./fronts";

export interface RackItem { id: string; slot: number; model: DeviceModel; brand: string; name: string; state: Lamp; ports: PortLamp[]; groups: number[][] }

interface Props {
  units: number;
  shelf: boolean;
  items: RackItem[];
  w: number;
  u: number;
  selected?: string | null;
  onDevice: (id: string) => void;
  // lo and hi are the free unit range around the clicked spot.
  onFree: (lo: number, hi: number, el: Element) => void;
}

const MONO = "JetBrains Mono, monospace", DIM = "oklch(0.62 0.01 255)";

const press = (fn: (el: Element) => void) => ({
  role: "button",
  tabIndex: 0,
  onClick: (e: { currentTarget: Element }) => fn(e.currentTarget),
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e.currentTarget); }
  },
});

// A rack is drawn top unit first; runs of 3 or more free units collapse into one band.
export function RackFront(p: Props) {
  if (p.shelf) return <ShelfFront {...p} />;
  const { units, items, w, u, selected, onDevice, onFree } = p;
  const pad = 30, fs = Math.max(7, u * 0.4), at = new Map<number, RackItem>();
  for (const it of items) for (let k = 0; k < it.model.height; k++) at.set(it.slot + k, it);
  const out: ReactNode[] = [];
  let y = 4;
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
      out.push(
        <g key={it.id} className="rack-dev" transform={`translate(${pad} ${y})`} aria-label={it.name} aria-pressed={it.id === selected} {...press(() => onDevice(it.id))}>
          <Front {...it} w={w} h={h} />
        </g>,
      );
      if (it.id === selected) out.push(<rect key="sel" x={pad - 2} y={y - 1.5} width={w + 4} height={h + 3} rx="3" fill="none" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />);
    }
    y += h;
    n = it.slot - 1;
  }
  const H = y + 4, W = w + pad * 2;
  return (
    <svg className="device-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Rack front">
      <Defs />
      <rect width={W} height={H} rx="4" fill="var(--rack)" />
      <rect x={pad - 6} y="2" width="5" height={H - 4} rx="1" fill="var(--metal-2)" />
      <rect x={pad + w + 1} y="2" width="5" height={H - 4} rx="1" fill="var(--metal-2)" />
      {out}
    </svg>
  );
}

// A basement shelf: slots side by side on one board, slot 1 on the left.
function ShelfFront({ units, items, selected, onDevice, onFree }: Props) {
  const pad = 10, W = pad * 2 + units * BAY.w, H = BAY.h + 22, board = BAY.h + 4;
  const bySlot = new Map(items.map((it) => [it.slot, it]));
  const bays: ReactNode[] = [];
  for (let k = 1; k <= units; k++) {
    const x = pad + (k - 1) * BAY.w, it = bySlot.get(k);
    if (!it) {
      bays.push(
        <g key={k} className="rack-free" aria-label={`Slot ${k} free`} {...press((el) => onFree(k, k, el))}>
          <rect x={x + 6} y={8} width={BAY.w - 12} height={BAY.h - 6} rx="3" fill="oklch(0.2 0.006 255 / 0.01)" stroke="oklch(0.3 0.006 255)" strokeDasharray="3 3" />
          <text x={x + BAY.w / 2} y={BAY.h / 2 + 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={DIM}>Slot {k}</text>
        </g>,
      );
      continue;
    }
    const sh = shelfHeight(it.model), dw = it.model.kind === "server" ? BAY.w - 20 : BAY.w - 10, dx = x + (BAY.w - dw) / 2, dy = board - sh;
    bays.push(
      <g key={k} className="rack-dev" transform={`translate(${dx} ${dy})`} aria-label={it.name} aria-pressed={it.id === selected} {...press(() => onDevice(it.id))}>
        <Front {...it} w={dw} h={sh} />
      </g>,
    );
    if (it.model.kind !== "server") bays.push(<text key={`l${k}`} x={x + BAY.w / 2} y={dy - 6} textAnchor="middle" fontFamily={MONO} fontSize="7" fill={DIM}>{it.name}</text>);
    if (it.id === selected) bays.push(<rect key="sel" x={dx - 2.5} y={dy - 2.5} width={dw + 5} height={sh + 5} rx="4" fill="none" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />);
  }
  return (
    <svg className="device-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Shelf">
      <Defs />
      <rect width={W} height={H} rx="4" fill="var(--rack)" />
      <rect x="4" y={board} width={W - 8} height="6" rx="1" fill="var(--metal-3)" />
      <rect x="4" y={board + 6} width={W - 8} height="2" fill="var(--metal-line)" />
      {bays}
    </svg>
  );
}
