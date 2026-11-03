import { t } from "../../i18n/en";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { OOB_PORT, oobPorts, type DeviceModel } from "../../sim/10-catalog/hardware";
import type { End } from "../../sim/50-state";
import { Back, bayRects, Cord, portSpots, psuInlets, type Side, type Spot } from "./backs";
import { Defs, Front, ledProps, PortJack, portNo, type Lamp, type Parts, type PortLamp, type PortLight } from "./fronts";

// plugs holds whether each power supply is plugged in.
export interface RackItem { id: string; slot: number; model: DeviceModel; brand: string; name: string; state: Lamp; badge?: string; blink?: boolean; fault?: boolean; parts?: Parts; ports: PortLamp[]; lights?: PortLight[]; groups: number[][]; plugs?: boolean[]; chassisId?: string | null; stick?: boolean }
// One cable end in this rack and the end it leads to, in this rack or on a remote box.
export interface RackLink { id: string; end: End; peer: End; color: string }
// A device outside the rack that the rack is or can be cabled to, drawn as a small box above it.
export interface RackRemote { id: string; label: string; title: string; model: DeviceModel; ports: PortLamp[]; lights?: PortLight[] }

interface Props {
  units: number;
  // Drawn as a metal shelf: units are boards counted from the top, each holding one device lying on it.
  shelf?: boolean;
  items: RackItem[];
  links?: RackLink[];
  remotes?: RackRemote[];
  side?: Side;
  w: number;
  u: number;
  selected?: string | null;
  // The cable to highlight; the others fade.
  hot?: string | null;
  onDevice: (id: string) => void;
  // A right-click on a mounted device.
  onDeviceMenu?: (id: string, e: ReactMouseEvent) => void;
  onFree: (unit: number, el: Element) => void;
  // A cable dragged from one port to another on the back.
  onConnect?: (a: End, b: End) => void;
  // A click on a power supply's inlet; psu is its index among the device's power supplies.
  onPlug?: (device: string, psu: number) => void;
  // A click on a server's console end on the back, where the monitor plugs in.
  onConsole?: (device: string) => void;
  // A click on a server's front USB port, where the stick plugs in.
  onUsb?: (device: string) => void;
  // A powered-off device dragged on the front to a new bottom unit.
  onMove?: (device: string, slot: number) => void;
  // Click-to-plug on the back, which replaces dragging: a click on any port, the port held as the cable in hand, and each port's hover text.
  onPort?: (e: End) => void;
  hand?: End | null;
  portTitle?: (e: End) => string;
  // A dragged cable dropped on an element marked data-away, which carries it out of the rack.
  onAway?: (from: End) => void;
  // A cover over the cable channel, so cables vanish into it after a short run from the port.
  duct?: boolean;
}

const MONO = "JetBrains Mono, monospace", DIM = "oklch(0.62 0.01 255)";
// Port hit areas reach past the jack to the neighbour's edge, so a dragged plug finds its port.
const HIT_X = 2.5, HIT_Y = 3;
const LANE = 5, ROW = 5, STEP = 11, VSTEP = 16, PER_ROW = 24, BOX_H = 32, BOX_GAP = 8, SOCK = 24;

const press = (fn: (el: Element) => void) => ({
  role: "button",
  tabIndex: 0,
  onClick: (e: { currentTarget: Element }) => fn(e.currentTarget),
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e.currentTarget); }
  },
});

// A polyline of horizontal and vertical runs with rounded corners.
function route(pts: [number, number][], r = 3): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const k1 = Math.min(r, Math.hypot(x - px, y - py) / 2), k2 = Math.min(r, Math.hypot(nx - x, ny - y) / 2);
    d += `L${x - Math.sign(x - px) * k1} ${y - Math.sign(y - py) * k1}Q${x} ${y} ${x + Math.sign(nx - x) * k2} ${y + Math.sign(ny - y) * k2}`;
  }
  return `${d}L${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
}

const endKey = (e: End) => `${e.device}:${e.port}`;
const parseEnd = (s: string): End => { const [device, port] = s.split(":"); return { device, port: Number(port) }; };

// Every unit is drawn on its own, top unit first. On the back, cables leave a port to the right, run up or down a
// channel beside the rack, one lane each, and come back left into the other port; cables to remote boxes climb the
// channel and turn into the box. Plugged power supplies send a cord left behind the rail to the power strip.
export function RackFront({ units, shelf = false, items, links = [], remotes = [], side = "front", w, u, selected, hot = null, onDevice, onDeviceMenu, onFree, onConnect, onPlug, onConsole, onUsb, onMove, onPort, hand = null, portTitle, onAway, duct }: Props) {
  const back = side === "back";
  const [slide, setSlide] = useState<{ id: string; from: number; y0: number; to: number; px: number } | null>(null);
  const slid = useRef(false);
  const pad = 30, fs = Math.max(7, u * 0.4), at = new Map<number, RackItem>();
  // A board is tall enough for a 2U device; a device takes one board whatever its height.
  const pitch = shelf ? shelfPitch(u) : u, span = (it: RackItem) => (shelf ? 1 : it.model.height);
  for (const it of items) for (let k = 0; k < span(it); k++) at.set(it.slot + k, it);
  const slides = (it: RackItem) => !!onMove && !back && !it.plugs?.some(Boolean) && it.model.height > 0;
  const fitsAt = (it: RackItem, slot: number) =>
    slot >= 1 && slot + span(it) - 1 <= units && Array.from({ length: span(it) }, (_, k) => at.get(slot + k)).every((x) => !x || x.id === it.id);
  // Dragging snaps to whole units; a drop on a free run moves the device there.
  const grabDevice = (it: RackItem) => ({
    onPointerDown: (e: ReactPointerEvent<SVGGElement>) => {
      if (e.button) return;
      e.preventDefault();
      setSlide({ id: it.id, from: it.slot, y0: e.clientY, to: it.slot, px: pitch * (e.currentTarget.ownerSVGElement?.getScreenCTM()?.d ?? 1) });
    },
  });
  const placed = new Map<string, { it: RackItem; y: number; h: number }>();
  const out: ReactNode[] = [];
  let y = 0;
  for (let n = units; n >= 1;) {
    if (!at.has(n) && shelf) {
      const k = n, board = units - k + 1;
      out.push(
        <g key={`e${k}`} className="rack-free" aria-label={t("art.shelfFree", { n: board })} {...press((el) => onFree(k, el))}>
          <rect x={pad} y={y} width={w} height={pitch} fill="transparent" />
          <Board x={pad} y={y + pitch} w={w} />
        </g>,
      );
      y += pitch;
      n--;
      continue;
    }
    if (!at.has(n)) {
      const k = n;
      out.push(
        <g key={`e${k}`} className="rack-free" aria-label={t("art.rackFree", { n: k })} {...press((el) => onFree(k, el))}>
          <text x={pad - 8} y={y + u / 2 + fs * 0.35} textAnchor="end" fontFamily={MONO} fontSize={fs} fill={DIM}>{k}</text>
          <rect x={pad} y={y + 0.5} width={w} height={u - 1} rx="1" fill="oklch(0.2 0.006 255)" stroke="oklch(0.27 0.006 255)" strokeWidth="0.6" />
          {[pad + 6, pad + w - 6].map((cx) => <circle key={cx} cx={cx} cy={y + u / 2} r="1.6" fill="oklch(0.3 0.006 255)" />)}
        </g>,
      );
      y += u;
      n--;
      continue;
    }
    const it = at.get(n)!, top = it.slot + span(it) - 1, h = it.model.height * u, room = span(it) * pitch;
    // On a shelf the device lies on its board's bottom.
    const dev = shelf ? y + pitch - BOARD - h : y;
    if (shelf) out.push(<Board key={`k${n}`} x={pad} y={y + pitch} w={w} />);
    else for (let k = 0; k < it.model.height; k++) {
      out.push(<text key={`n${n - k}`} x={pad - 8} y={y + k * u + u / 2 + fs * 0.35} textAnchor="end" fontFamily={MONO} fontSize={fs} fill={DIM}>{n - k}</text>);
    }
    if (top === n) {
      placed.set(it.id, { it, y: dev, h });
      const moving = slide?.id === it.id ? slide : null, dy = moving ? (moving.from - moving.to) * pitch : 0;
      out.push(
        <g key={it.id} className={`rack-dev${slides(it) ? " movable" : ""}`} transform={`translate(${pad} ${dev + dy})`} aria-label={it.name} aria-pressed={it.id === selected}
          {...press(() => { if (!slid.current) onDevice(it.id); })} {...(slides(it) ? grabDevice(it) : {})} onContextMenu={onDeviceMenu && ((e) => onDeviceMenu(it.id, e))}>
          {back ? <Back {...it} w={w} h={h} /> : <Front {...it} w={w} h={h} onUsb={onUsb && (() => onUsb(it.id))} />}
        </g>,
      );
      if (moving && moving.to !== moving.from) out.push(<rect key="slide" x={pad - 2} y={dev + dy - 1.5} width={w + 4} height={h + 3} rx="3" fill="none" stroke={fitsAt(it, moving.to) ? "var(--ok)" : "var(--bad)"} strokeWidth="2" pointerEvents="none" />);
      if (it.badge) {
        const bw = it.badge.length * fs * 0.62 + 8;
        out.push(<g key={`b${it.id}`} className="rack-badge" pointerEvents="none"><rect x={pad + w - bw - 2} y={dev + 2} width={bw} height={fs + 4} rx="2" fill="var(--accent)" /><text x={pad + w - bw / 2 - 2} y={dev + fs + 2} textAnchor="middle" fontFamily={MONO} fontSize={fs} fill="var(--on-accent, #fff)">{it.badge}</text></g>);
      }
      if (it.id === selected) out.push(<rect key="sel" x={pad - 2} y={dev - 1.5} width={w + 4} height={h + 3} rx="3" fill="none" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />);
    }
    y += shelf ? room : h;
    n = it.slot - 1;
  }

  // The nodes of a multi-node chassis draw over its bays, each with its own ports on the back.
  const bays: { it: RackItem; x: number; y: number; w: number; h: number }[] = [];
  for (const { it: c, y: cy, h: ch } of placed.values()) {
    if (!c.model.nodes) continue;
    const rects = bayRects(c.model, side, w, ch), dy = slide?.id === c.id ? (slide.from - slide.to) * pitch : 0;
    items.filter((x) => x.chassisId === c.id).forEach((it, i) => { if (rects[i]) bays.push({ it, x: pad + rects[i].x, y: cy + dy + rects[i].y, w: rects[i].w, h: rects[i].h }); });
  }
  for (const b of bays) {
    const sel = b.it.id === selected;
    out.push(
      <g key={b.it.id} className="rack-dev" transform={`translate(${b.x} ${b.y})`} aria-label={b.it.name} aria-pressed={sel} {...press(() => onDevice(b.it.id))} onContextMenu={onDeviceMenu && ((e) => onDeviceMenu(b.it.id, e))}>
        {back ? <Back {...b.it} w={b.w} h={b.h} /> : <Front {...b.it} w={b.w} h={b.h} onUsb={onUsb && (() => onUsb(b.it.id))} />}
        {sel && <rect x="-1" y="-1" width={b.w + 2} height={b.h + 2} rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.5" pointerEvents="none" />}
      </g>,
    );
  }

  // A 0U device (a vertical PDU) hangs on the right rail and takes no unit.
  // A 0U KVM hangs on the same rail at its slot, its two jacks stacked.
  const railSpots: [End, Spot][] = [];
  for (const it of items.filter((x) => x.model.height === 0 && !x.model.chassis)) {
    const x = pad + w + 1, sel = it.id === selected, dots = Math.min(it.model.outlets ?? 8, units * 2);
    if (it.model.kind === "kvm") {
      const y0 = (units - it.slot) * u, jh = (u - 5) / 2;
      const jacks = oobPorts(it.model).map((_, k): [End, Spot] => [{ device: it.id, port: OOB_PORT + k }, { x: x + 0.5, y: y0 + 2 + k * (jh + 1), w: 5, h: jh }]);
      railSpots.push(...jacks);
      out.push(
        <g key={it.id} className="rack-dev" aria-label={it.name} aria-pressed={sel} {...press(() => onDevice(it.id))} onContextMenu={onDeviceMenu && ((e) => onDeviceMenu(it.id, e))}>
          <title>{it.name}</title>
          <rect x={x - 1} y={y0 + 0.5} width="8" height={u - 1} rx="1.5" fill="oklch(0.42 0.1 150)" stroke={sel ? "var(--accent)" : "oklch(0.3 0.05 150)"} strokeWidth={sel ? 2 : 0.6} />
          {jacks.map(([e, s]) => <rect key={e.port} x={s.x} y={s.y} width={s.w} height={s.h} rx="0.5" fill="oklch(0.12 0.004 255)" />)}
        </g>,
      );
      continue;
    }
    out.push(
      <g key={it.id} className="rack-dev" aria-label={it.name} aria-pressed={sel} {...press(() => onDevice(it.id))} onContextMenu={onDeviceMenu && ((e) => onDeviceMenu(it.id, e))}>
        <title>{it.name}</title>
        <rect x={x - 1} y="-2" width="8" height={y + 4} rx="2" fill="oklch(0.24 0.005 255)" stroke={sel ? "var(--accent)" : "var(--metal-line)"} strokeWidth={sel ? 2 : 0.6} />
        {Array.from({ length: dots }, (_, k) => <rect key={k} x={x + 1} y={3 + (k * (y - 6)) / dots} width="4" height={Math.max(1.5, (y - 6) / dots - 2)} rx="0.8" fill={it.state === "off" ? "oklch(0.35 0.01 255)" : "oklch(0.78 0.18 145)"} />)}
      </g>,
    );
  }

  // Port centres in rack coordinates, before the rack is shifted down below the remote boxes.
  const spots = new Map<string, { x: number; y: number; h: number }>();
  if (back) for (const { it, y: py, h } of placed.values()) {
    for (const [i, s] of portSpots(it.model, it.name, side, w, h)) spots.set(endKey({ device: it.id, port: i }), { x: pad + s.x + s.w / 2, y: py + s.y + s.h / 2, h: s.h });
  }
  if (back) for (const b of bays) {
    for (const [i, s] of portSpots(b.it.model, b.it.name, side, b.w, b.h)) spots.set(endKey({ device: b.it.id, port: i }), { x: b.x + s.x + s.w / 2, y: b.y + s.y + s.h / 2, h: s.h });
  }
  if (back) for (const [e, s] of railSpots) spots.set(endKey(e), { x: s.x + s.w / 2, y: s.y + s.h / 2, h: s.h });
  const remoteIds = new Set(remotes.map((r) => r.id));
  const drawn = new Set<string>();
  const inner: { l: RackLink; a: { x: number; y: number; h: number }; b: { x: number; y: number; h: number } }[] = [];
  const up: { l: RackLink; a: { x: number; y: number; h: number } }[] = [];
  for (const l of links) {
    const a = spots.get(endKey(l.end));
    if (!a || drawn.has(l.id)) continue;
    const b = spots.get(endKey(l.peer));
    if (b) { drawn.add(l.id); inner.push({ l, a, b }); } else if (remoteIds.has(l.peer.device)) { drawn.add(l.id); up.push({ l, a }); }
  }
  // Short runs take the lanes next to the rack, so they cross as few others as possible; cables to remote boxes go outside.
  inner.sort((p, q) => Math.abs(p.a.y - p.b.y) - Math.abs(q.a.y - q.b.y));
  up.sort((p, q) => p.a.y - q.a.y);
  const lanes = inner.length + up.length, rail = pad + w + 1, lane0 = rail + 13;
  const channel = Math.max(48, 20 + lanes * LANE);
  const W = rail + 5 + channel;

  // Remote boxes flow left to right over the full width.
  const boxes: { r: RackRemote; x: number; y: number; bw: number; bh: number }[] = [];
  const remotePort = new Map<string, { x: number; y: number }>();
  let boxesH = 0;
  if (back) {
    let bx = 4, by = 2, rowH = 0;
    for (const r of remotes) {
      if (r.model.kind === "jack") continue;
      const per = Math.min(PER_ROW, r.ports.length), rows = Math.ceil(r.ports.length / PER_ROW);
      const bw = Math.max(per * STEP + 10, r.label.length * 6 + 16), bh = BOX_H + (rows - 1) * VSTEP;
      if (bx + bw > W - 4 && bx > 4) { bx = 4; by += rowH + BOX_GAP; rowH = 0; }
      boxes.push({ r, x: bx, y: by, bw, bh });
      r.ports.forEach((_, i) => remotePort.set(endKey({ device: r.id, port: i }), { x: bx + 5 + (i % PER_ROW) * STEP + 5, y: by + 20 + Math.floor(i / PER_ROW) * VSTEP }));
      bx += bw + BOX_GAP;
      rowH = Math.max(rowH, bh);
    }
    if (boxes.length) boxesH = by + rowH + 4;
  }
  // The wall socket sits in the duct column under the boxes, its port over the lane its cable climbs.
  const jack = back ? remotes.find((r) => r.model.kind === "jack") : undefined;
  const sockets: { r: RackRemote; x: number; y: number; px: number }[] = [];
  if (jack) {
    const k = up.findIndex((p) => p.l.peer.device === jack.id), lx = k < 0 ? rail + 5 + channel / 2 : lane0 + (inner.length + k) * LANE;
    const px = Math.min(rail + 3 + channel - SOCK / 2, Math.max(rail + 8 + SOCK / 2, lx));
    sockets.push({ r: jack, x: px - SOCK / 2, y: boxesH + 2, px: lx });
    remotePort.set(endKey({ device: jack.id, port: 0 }), { x: lx, y: boxesH + 2 + SOCK / 2 });
    boxesH += SOCK + 6;
  }
  const head = boxesH + (up.some((p) => p.l.peer.device !== jack?.id) ? 12 + up.length * ROW : 0), top = head + 4;
  const H = top + y + 4;

  const wires: ReactNode[] = [];
  const isHot = (id: string) => (hot === null ? undefined : hot === id);
  inner.forEach(({ l, a, b }, i) => {
    const lx = lane0 + i * LANE, da = a.h / 2 + 2 + (i % 3) * 1.4, db = b.h / 2 + 2 + (i % 3) * 1.4;
    wires.push(<Wire key={l.id} color={l.color} hot={isHot(l.id)} d={route([[a.x, a.y + top], [a.x, a.y + top + da], [lx, a.y + top + da], [lx, b.y + top + db], [b.x, b.y + top + db], [b.x, b.y + top]])} />);
  });
  up.forEach(({ l, a }, k) => {
    const i = inner.length + k, lx = lane0 + i * LANE, da = a.h / 2 + 2 + (i % 3) * 1.4;
    const p = remotePort.get(endKey(l.peer))!, gy = head - 6 - k * ROW;
    const rise: [number, number][] = l.peer.device === jack?.id ? [[lx, p.y]] : [[lx, gy], [p.x, gy], [p.x, p.y]];
    wires.push(<Wire key={l.id} color={l.color} hot={isHot(l.id)} d={route([[a.x, a.y + top], [a.x, a.y + top + da], [lx, a.y + top + da], ...rise])} />);
  });

  const cords: ReactNode[] = [];
  for (const { it, y: py, h } of placed.values()) {
    psuInlets(it.model, side, w, h).forEach((p, k) => {
      if (it.plugs?.[k]) cords.push(<g key={`${it.id}p${k}`} aria-label={t("art.powerCord", { name: it.name, n: k + 1 })}><Cord x={pad + p.x} y={top + py + p.y} mm={p.mm} x0={pad - 4} /></g>);
    });
  }

  // Dragging a cable from a port: the dashed line follows the pointer until it is dropped on another port.
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ from: End; x0: number; y0: number; x: number; y: number; moved: boolean } | null>(null);
  const toSvg = (cx: number, cy: number) => { const p = new DOMPoint(cx, cy).matrixTransform(svg.current!.getScreenCTM()!.inverse()); return { x: p.x, y: p.y }; };
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const live = useRef({ onConnect, onDevice, onAway, onPort });
  live.current = { onConnect, onDevice, onAway, onPort };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => d && { ...d, ...toSvg(e.clientX, e.clientY), moved: true });
    const up = (e: PointerEvent) => {
      const d = dragRef.current, el = document.elementFromPoint(e.clientX, e.clientY), to = el?.closest("[data-end]")?.getAttribute("data-end");
      setDrag(null);
      if (d && to && to !== endKey(d.from)) live.current.onConnect?.(d.from, parseEnd(to));
      else if (d && el?.closest("[data-away]")) live.current.onAway?.(d.from);
      // With click-to-plug the click that follows handles the port.
      else if (d && !d.moved && !live.current.onPort && !remoteIds.has(d.from.device)) live.current.onDevice(d.from.device);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const slideLive = useRef({ slide, onMove, fitsAt, items });
  slideLive.current = { slide, onMove, fitsAt, items };
  useEffect(() => {
    if (!slide) return;
    const move = (e: PointerEvent) => setSlide((d) => d && { ...d, to: d.from - Math.round((e.clientY - d.y0) / d.px) });
    const up = () => {
      const { slide: d, onMove: done, fitsAt: fits, items: all } = slideLive.current, it = all.find((x) => x.id === d?.id);
      setSlide(null);
      if (!d || !it || d.to === d.from) return;
      // The click that follows this pointerup is the drop, not a selection.
      slid.current = true;
      setTimeout(() => { slid.current = false; });
      if (fits(it, d.to)) done?.(it.id, d.to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [slide !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const held = hand && (remotePort.get(endKey(hand)) ?? (spots.get(endKey(hand)) && { x: spots.get(endKey(hand))!.x, y: spots.get(endKey(hand))!.y + top }));
  const tap = (end: End) => ({
    className: `rack-port${hand && endKey(hand) === endKey(end) ? " rack-hand" : ""}`,
    onClick: onPort && ((e: ReactMouseEvent) => { e.stopPropagation(); onPort(end); }),
    children: portTitle && <title>{portTitle(end)}</title>,
  });
  const grab = (end: End, x: number, cy: number) => (e: ReactPointerEvent) => {
    if (!onConnect || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({ from: end, x0: x, y0: cy, x, y: cy, moved: false });
  };

  const hits: ReactNode[] = [];
  if (back) for (const { it, y: py, h } of placed.values()) {
    for (const [i, s] of portSpots(it.model, it.name, side, w, h)) {
      const end = { device: it.id, port: i }, vga = onConsole && it.model.kind === "server" && oobPorts(it.model)[i - OOB_PORT] === "console";
      hits.push(vga
        ? <rect key={endKey(end)} className="rack-port rack-vga" data-end={endKey(end)} x={pad + s.x - HIT_X} y={top + py + s.y - HIT_Y} width={s.w + 2 * HIT_X} height={s.h + 2 * HIT_Y} rx="1" onPointerDown={grab(end, pad + s.x + s.w / 2, top + py + s.y + s.h / 2)} onClick={() => onConsole(it.id)}><title>Plug in monitor</title></rect>
        : <rect key={endKey(end)} {...tap(end)} data-end={endKey(end)} x={pad + s.x - HIT_X} y={top + py + s.y - HIT_Y} width={s.w + 2 * HIT_X} height={s.h + 2 * HIT_Y} rx="1" onPointerDown={grab(end, pad + s.x + s.w / 2, top + py + s.y + s.h / 2)} />);
    }
  }

  if (back) for (const [end, s] of railSpots) {
    hits.push(<rect key={endKey(end)} {...tap(end)} data-end={endKey(end)} x={s.x - 1} y={top + s.y - 1} width={s.w + 2} height={s.h + 2} rx="1" onPointerDown={grab(end, s.x + s.w / 2, top + s.y + s.h / 2)} />);
  }

  if (onPlug) for (const { it, y: py, h } of placed.values()) {
    psuInlets(it.model, side, w, h).forEach((p, k) => {
      const bw = 30 * p.mm, bh = 22 * p.mm, label = t(it.plugs?.[k] ? "art.unplugPsu" : "art.plugInPsu", { n: k + 1 });
      hits.push(
        <rect key={`${it.id}i${k}`} className="rack-port rack-inlet" role="button" tabIndex={0} aria-label={label} x={pad + p.x - bw / 2 - 1} y={top + py + p.y - bh / 2 - 1} width={bw + 2} height={bh + 2} rx="1"
          onClick={() => onPlug(it.id, k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPlug(it.id, k); } }}><title>{label}</title></rect>,
      );
    });
  }

  return (
    <svg ref={svg} className={`device-svg rack-svg${drag ? " dragging" : ""}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={back ? t("art.rackBack") : t("art.rackFront")}
      onPointerMove={held ? (e) => setPtr(toSvg(e.clientX, e.clientY)) : undefined}>
      <Defs />
      {boxes.map(({ r, x, y: by, bw, bh }) => (
        <g key={r.id} className="rack-remote" aria-label={r.title}>
          <title>{r.title}</title>
          <rect x={x} y={by} width={bw} height={bh} rx="3" fill="var(--rack)" stroke="var(--metal-line)" strokeWidth="0.6" />
          <text x={x + 6} y={by + 10} fontFamily={MONO} fontSize="8.5" fill="oklch(0.78 0.01 255)">{r.label}</text>
          {r.ports.map((st, i) => {
            const p = remotePort.get(endKey({ device: r.id, port: i }))!, end = { device: r.id, port: i };
            return (
              <g key={i}>
                <PortJack media={r.model.ports[i]?.media ?? "rj45"} x={p.x - 4} y={p.y - 4} w={8} h={8} st={st} />
                {r.lights?.[i] && <rect x={p.x - 3.2} y={p.y - 3.2} width="2.4" height="1.4" {...ledProps(r.lights[i], r.id, i)} />}
                <text x={p.x} y={p.y + 8.4} textAnchor="middle" fontFamily={MONO} fontSize="4.6" fill={DIM} aria-hidden="true">{portNo(r.model, i)}</text>
                <rect {...tap(end)} data-end={endKey(end)} x={p.x - 5} y={p.y - 5} width="10" height="10" rx="1" onPointerDown={grab(end, p.x, p.y)} />
              </g>
            );
          })}
        </g>
      ))}
      {sockets.map(({ r, x, y: sy, px }) => {
        const end = { device: r.id, port: 0 };
        return (
          <g key={r.id} className="rack-remote" aria-label={r.title}>
            <title>{r.title}</title>
            <rect x={x} y={sy} width={SOCK} height={SOCK} rx="2" fill="oklch(0.9 0.01 85)" stroke="oklch(0.72 0.012 85)" strokeWidth="0.8" />
            <rect x={x + 4} y={sy + 4} width={SOCK - 8} height={SOCK - 8} rx="1.5" fill="oklch(0.84 0.01 85)" />
            {[sy + 2.5, sy + SOCK - 2.5].map((cy) => <circle key={cy} cx={x + SOCK / 2} cy={cy} r="1" fill="oklch(0.65 0.01 85)" />)}
            <PortJack media={r.model.ports[0]?.media ?? "rj45"} x={px - 4} y={sy + SOCK / 2 - 4} w={8} h={8} st={r.ports[0]} />
            <rect {...tap(end)} data-end={endKey(end)} x={px - 5} y={sy + SOCK / 2 - 5} width="10" height="10" rx="1" onPointerDown={grab(end, px, sy + SOCK / 2)} />
          </g>
        );
      })}
      <rect y={top - 4} width={W} height={H - top + 4} rx="4" fill="var(--rack)" />
      <g transform={`translate(0 ${top})`}>
        {shelf && [...placed.values()].map(({ it, y: dy, h }) => <Loops key={it.id} x={pad + w / 2} y={dy + h} drop={pitch} n={it.ports.filter((p) => p !== "off").length} />)}
        {shelf ? [pad - 6, rail].map((x) => <Upright key={x} x={x} h={y} />) : [pad - 6, rail].map((x) => <rect key={x} x={x} y="-2" width="5" height={y + 4} rx="1" fill="var(--metal-2)" />)}
        {back && !shelf && (
          <g aria-label={t("art.cableChannel")}>
            <rect x={rail + 8} y="-2" width={channel - 10} height={y + 4} rx="2" fill="oklch(0.11 0.004 255)" />
            {Array.from({ length: units }, (_, k) => [rail + 8, rail + channel - 5].map((x) => <rect key={`${k}-${x}`} x={x} y={k * u + 3} width="3" height={u - 6} rx="1" fill="var(--metal-2)" />))}
          </g>
        )}
        {out}
      </g>
      <g pointerEvents="none">
        {cords}
        {shelf ? <g transform={`translate(0 ${top})`}><Upright x={pad - 6} h={y} /></g> : <rect x={pad - 6} y={top - 2} width="5" height={y + 4} rx="1" fill="var(--metal-2)" />}
        {wires}
        {back && duct && (
          <g className="rack-duct" aria-hidden="true">
            <rect x={rail + 7} y={top - 3} width={channel - 8} height={y + 6} fill="var(--metal-2)" stroke="var(--metal-line)" strokeWidth="0.8" />
            {Array.from({ length: Math.floor(y / 18) }, (_, k) => <rect key={k} x={rail + 12} y={top + 6 + k * 18} width={channel - 18} height="3" fill="var(--metal)" />)}
          </g>
        )}
      </g>
      {hits}
      {drag && drag.moved && <path className="rack-drag" d={`M${drag.x0} ${drag.y0}L${drag.x} ${drag.y}`} />}
      {drag && drag.moved && <rect className="rack-plug" x={drag.x - 4} y={drag.y - 3.5} width="8" height="7" rx="1" pointerEvents="none" />}
      {held && ptr && <path className="rack-drag" data-hand="" d={`M${held.x} ${held.y}L${ptr.x} ${ptr.y}`} />}
    </svg>
  );
}

export const shelfPitch = (u: number) => Math.round(u * 2.4);
const BOARD = 5;

// A punched shelf upright.
function Upright({ x, h }: { x: number; h: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x} y="-2" width="5" height={h + 4} fill="oklch(0.62 0.008 250)" />
      <rect x={x + 4} y="-2" width="1" height={h + 4} fill="oklch(0.5 0.01 250)" />
      {Array.from({ length: Math.floor(h / 8) }, (_, k) => <rect key={k} x={x + 1.5} y={2 + k * 8} width="2" height="3" fill="oklch(0.3 0.006 255)" />)}
    </g>
  );
}

// A shelf board, its top edge at y: the lit top, the front lip and its shadowed underside.
function Board({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x - 6} y={y - BOARD} width={w + 12} height="1.5" fill="oklch(0.78 0.006 250)" />
      <rect x={x - 6} y={y - BOARD + 1.5} width={w + 12} height={BOARD - 2.5} fill="oklch(0.64 0.008 250)" />
      <rect x={x - 6} y={y - 1} width={w + 12} height="1" fill="oklch(0.46 0.01 250)" />
    </g>
  );
}

// The cables of a device on a board, hanging in loops behind the board below it.
function Loops({ x, y, drop, n }: { x: number; y: number; drop: number; n: number }) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      {Array.from({ length: Math.min(3, n) }, (_, k) => {
        const x0 = x - 40 + k * 34, d = drop * (0.45 + k * 0.12);
        return <path key={k} d={`M${x0} ${y - 2}C${x0} ${y + d} ${x0 + 26} ${y + d} ${x0 + 26} ${y - 2}`} fill="none" stroke="oklch(0.36 0.01 255)" strokeWidth="2.2" />;
      })}
    </g>
  );
}

// hot is undefined when nothing is highlighted; otherwise the hot cable thickens and the rest fade.
function Wire({ d, color, hot }: { d: string; color: string; hot?: boolean }) {
  return (
    <g opacity={hot === false ? 0.3 : 1}>
      <path d={d} fill="none" stroke="oklch(0.12 0.004 255)" strokeWidth={hot ? 5 : 3.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={hot ? 3 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
