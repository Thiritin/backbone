import { useId, type CSSProperties, type ReactNode } from "react";
import type { Facing } from "../../sim/20-world/layout";
import type { Company } from "../../sim/50-state";
import { ICONS } from "../apps/company";
import { at3, onX, onY, pts, Prism, WallBand } from "./draw";
import { iso, type Pt } from "./grid";
import "./hall-art.css";

// Flat isometric art for the hall's placeable items and rooms. Every item takes the scene tile (x, y)
// of the top corner of its footprint after turning, so a 2 by 1 item facing e or w covers 1 by 2 tiles
// from (x, y). `facing` is the side the front points to; a front on a hidden side (n, w) is marked on the top face.

export type { Facing };
interface Base { x: number; y: number; facing?: Facing; ghost?: boolean }

interface Box { x0: number; y0: number; x1: number; y1: number }
const horizontal = (f: Facing) => f === "n" || f === "s";
// Footprint of a w wide, d deep item: w runs along the front.
export const dims = (w: number, d: number, f: Facing = "s") => (horizontal(f) ? { w, d } : { w: d, d: w });
const boxOf = (x: number, y: number, w: number, d: number, f: Facing): Box => {
  const s = dims(w, d, f);
  return { x0: x, y0: y, x1: x + s.w, y1: y + s.d };
};
const ghosted = (ghost: boolean | undefined, node: ReactNode) => (ghost ? <g className="ha-ghost">{node}</g> : node);

// Point on a visible side face: u from the left of the screen to the right, at height z.
const sideAt = (b: Box, side: "s" | "e", u: number, z: number): Pt =>
  side === "s" ? at3(b.x0 + u * (b.x1 - b.x0), b.y1, z) : at3(b.x1, b.y1 - u * (b.y1 - b.y0), z);
const frontSide = (f: Facing): "s" | "e" | null => (f === "s" ? "s" : f === "e" ? "e" : null);
// Point on the top face: u along the front edge, v from the front edge inward.
function topAt(b: Box, f: Facing, u: number, v: number, z: number): Pt {
  const W = b.x1 - b.x0, D = b.y1 - b.y0;
  if (f === "s") return at3(b.x0 + u * W, b.y1 - v * D, z);
  if (f === "n") return at3(b.x0 + u * W, b.y0 + v * D, z);
  if (f === "e") return at3(b.x1 - v * W, b.y1 - u * D, z);
  return at3(b.x0 + v * W, b.y0 + u * D, z);
}
// A band on the top face along the front edge: the facing mark of every body.
const FrontBand = ({ b, f, z, v = 0.16, cls = "ha-c ha-mark" }: { b: Box; f: Facing; z: number; v?: number; cls?: string }) => (
  <polygon className={cls} points={pts(topAt(b, f, 0, 0, z), topAt(b, f, 1, 0, z), topAt(b, f, 1, v, z), topAt(b, f, 0, v, z))} />
);
// A rectangle on a visible side face, in u and height.
const SidePanel = ({ b, side, u0, u1, z0, z1, cls }: { b: Box; side: "s" | "e"; u0: number; u1: number; z0: number; z1: number; cls: string }) => (
  <polygon className={cls} points={pts(sideAt(b, side, u0, z0), sideAt(b, side, u1, z0), sideAt(b, side, u1, z1), sideAt(b, side, u0, z1))} />
);
const SideLine = ({ b, side, u, z0, z1, cls }: { b: Box; side: "s" | "e"; u: number; z0: number; z1: number; cls: string }) => {
  const a = sideAt(b, side, u, z0), c = sideAt(b, side, u, z1);
  return <line className={cls} x1={a.x} y1={a.y} x2={c.x} y2={c.y} />;
};
const sides = ["s", "e"] as const;

export function Crac({ x, y, facing = "s", ghost }: Base) {
  const b = boxOf(x, y, 2, 1, facing), H = 56, f = frontSide(facing);
  return ghosted(ghost, (
    <g>
      <Prism {...b} z1={H} tone="ha-t ha-crac" />
      <polygon className="ha-c ha-dark" points={pts(topAt(b, facing, 0.1, 0.3, H), topAt(b, facing, 0.9, 0.3, H), topAt(b, facing, 0.9, 0.9, H), topAt(b, facing, 0.1, 0.9, H))} />
      {[0.25, 0.4, 0.55, 0.7].map((v) => {
        const p = topAt(b, facing, 0.1, v, H), q = topAt(b, facing, 0.9, v, H);
        return <line key={v} className="ha-s ha-slat" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
      })}
      <FrontBand b={b} f={facing} z={H} />
      {f && (
        <g>
          <SidePanel b={b} side={f} u0={0.08} u1={0.92} z0={8} z1={H - 8} cls="ha-c ha-dark" />
          {Array.from({ length: 9 }, (_, i) => <SideLine key={i} b={b} side={f} u={0.12 + i * 0.095} z0={10} z1={H - 10} cls="ha-s ha-slat" />)}
        </g>
      )}
    </g>
  ));
}

// A perforated floor tile; the dots take the plain floor tone when no CRAC is within reach.
export function Vent({ x, y, reach, ghost }: { x: number; y: number; reach: boolean; ghost?: boolean }) {
  const corner = [iso(x + 0.06, y + 0.06), iso(x + 0.94, y + 0.06), iso(x + 0.94, y + 0.94), iso(x + 0.06, y + 0.94)];
  const dots: Pt[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) dots.push(iso(x + 0.22 + i * 0.185, y + 0.22 + j * 0.185));
  return ghosted(ghost, (
    <g>
      <polygon className="ha-c ha-ventbase" points={pts(...corner)} />
      {dots.map((p, i) => <ellipse key={i} className={`ha-c ${reach ? "ha-ventdot" : "ha-ventdot-off"}`} cx={p.x} cy={p.y} rx={3} ry={1.5} />)}
    </g>
  ));
}

const CT = 70, POST = 0.05;
// A frame over one tile; end flags draw a door panel on that edge.
export function Containment({ x, y, endN, endE, endS, endW, ghost }: { x: number; y: number; endN?: boolean; endE?: boolean; endS?: boolean; endW?: boolean; ghost?: boolean }) {
  const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  const top = c.map(([a, b]) => at3(a, b, CT)), foot = c.map(([a, b]) => at3(a, b, 0));
  const edge = (i: number, on?: boolean) => {
    const j = (i + 1) % 4;
    return (
      <g key={i}>
        <line className="ha-s ha-rail" x1={top[i].x} y1={top[i].y} x2={top[j].x} y2={top[j].y} />
        {on && <polygon className="ha-door" points={pts(foot[i], foot[j], top[j], top[i])} />}
      </g>
    );
  };
  return ghosted(ghost, (
    <g>
      {[endN, endE, endS, endW].map((on, i) => edge(i, on))}
      {c.map((_, i) => <line key={i} className="ha-s ha-post" x1={foot[i].x} y1={foot[i].y} x2={top[i].x} y2={top[i].y} strokeWidth={POST * 40} />)}
    </g>
  ));
}

export function Transformer({ x, y, facing = "s", size, ghost }: Base & { size: "office" | "halle" }) {
  const b = boxOf(x, y, size === "halle" ? 2 : 1, 2, facing), H = 50, f = frontSide(facing);
  const W = b.x1 - b.x0, D = b.y1 - b.y0;
  const n = size === "halle" ? 4 : 2;
  return ghosted(ghost, (
    <g>
      {Array.from({ length: n + 1 }, (_, i) => sides.map((s) => <SideLine key={s + i} b={b} side={s} u={0.1 + (0.8 * i) / n} z0={4} z1={H - 4} cls="ha-s ha-fin" />))}
      <Prism {...b} z1={H} tone="ha-t ha-xfmr" />
      {sides.map((s) => Array.from({ length: n * 2 + 1 }, (_, i) => <SideLine key={s + i} b={b} side={s} u={0.08 + (0.84 * i) / (n * 2)} z0={4} z1={H - 4} cls="ha-s ha-fin" />))}
      {[0.2, 0.5, 0.8].map((u) => {
        const p = topAt(b, facing, u, 0.5, H), q = topAt(b, facing, u, 0.5, H + 20);
        return (
          <g key={u}>
            <line className="ha-s ha-bushing" x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeWidth={Math.min(W, D) * 7} />
            <ellipse className="ha-c ha-cap" cx={q.x} cy={q.y} rx={Math.min(W, D) * 5} ry={Math.min(W, D) * 2.5} />
          </g>
        );
      })}
      <FrontBand b={b} f={facing} z={H} />
      {f && <SidePanel b={b} side={f} u0={0.4} u1={0.6} z0={H * 0.35} z1={H * 0.6} cls="ha-c ha-plate" />}
    </g>
  ));
}

export function Switchgear({ x, y, facing = "s", ghost }: Base) {
  const b = boxOf(x, y, 1, 2, facing), H = 80, f = frontSide(facing);
  return ghosted(ghost, (
    <g>
      <Prism {...b} z1={H} tone="ha-t ha-gear" />
      <FrontBand b={b} f={facing} z={H} />
      {f && [0, 1, 2].map((i) => {
        const u0 = 0.06 + i * 0.31, u1 = u0 + 0.27;
        return (
          <g key={i}>
            <SidePanel b={b} side={f} u0={u0} u1={u1} z0={6} z1={H - 6} cls="ha-c ha-gearpanel" />
            <SidePanel b={b} side={f} u0={u0 + 0.03} u1={u1 - 0.03} z0={H * 0.62} z1={H * 0.7} cls={`ha-c ${["ha-mimic-a", "ha-mimic-b", "ha-mimic-c"][i]}`} />
          </g>
        );
      })}
    </g>
  ));
}

export function Generator({ x, y, facing = "s", ghost }: Base) {
  const b = boxOf(x, y, 2, 2, facing), H = 44, f = frontSide(facing);
  const p = topAt(b, facing, 0.85, 0.8, H), q = topAt(b, facing, 0.85, 0.8, H + 56);
  return ghosted(ghost, (
    <g>
      <Prism {...b} z1={H} tone="ha-t ha-gen" />
      <polygon className="ha-c ha-genhood" points={pts(topAt(b, facing, 0.1, 0.2, H), topAt(b, facing, 0.7, 0.2, H), topAt(b, facing, 0.7, 0.9, H), topAt(b, facing, 0.1, 0.9, H))} />
      <line className="ha-s ha-pipe" x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeWidth={6} />
      <ellipse className="ha-c ha-pipecap" cx={q.x} cy={q.y} rx={4} ry={2} />
      <FrontBand b={b} f={facing} z={H} />
      {f && (
        <g>
          <SidePanel b={b} side={f} u0={0.08} u1={0.92} z0={7} z1={H - 7} cls="ha-c ha-dark" />
          {Array.from({ length: 11 }, (_, i) => <SideLine key={i} b={b} side={f} u={0.12 + i * 0.076} z0={9} z1={H - 9} cls="ha-s ha-slat" />)}
        </g>
      )}
    </g>
  ));
}

export function Ups({ x, y, facing = "s", running, ghost }: Base & { running: boolean }) {
  const b = boxOf(x, y, 1, 2, facing), H = 70, f = frontSide(facing);
  return ghosted(ghost, (
    <g>
      <Prism {...b} z1={H} tone="ha-t ha-ups" />
      <FrontBand b={b} f={facing} z={H} />
      {f && (
        <g>
          <SidePanel b={b} side={f} u0={0.1} u1={0.9} z0={H * 0.55} z1={H - 8} cls="ha-c ha-upswin" />
          {[0.2, 0.4, 0.6, 0.8].map((u) => {
            const p = sideAt(b, f, u, H * 0.76);
            return <ellipse key={u} className={`ha-c ${running ? "ha-led-on" : "ha-led-off"}`} cx={p.x} cy={p.y} rx={2.6} ry={2} />;
          })}
          <SidePanel b={b} side={f} u0={0.1} u1={0.9} z0={8} z1={H * 0.4} cls="ha-c ha-dark" />
        </g>
      )}
    </g>
  ));
}

export function Battery({ x, y, facing = "s", ghost }: Base) {
  const b = boxOf(x, y, 1, 2, facing), H = 50, f = frontSide(facing);
  return ghosted(ghost, (
    <g>
      <Prism {...b} z1={H} tone="ha-t ha-batt" />
      <FrontBand b={b} f={facing} z={H} />
      {sides.map((s) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <SidePanel key={`${s}${r}${c}`} b={b} side={s} u0={0.07 + c * 0.31} u1={0.07 + c * 0.31 + 0.26} z0={5 + r * 14.5} z1={5 + r * 14.5 + 11} cls="ha-c ha-cell" />
      ))))}
      {f && <SidePanel b={b} side={f} u0={0.38} u1={0.62} z0={H - 4} z1={H - 1} cls="ha-c ha-plate" />}
    </g>
  ));
}

const DESK_H = 24;
// A desk with `seats` monitors along its back edge; seats in `occupied` have a lit screen.
function DeskBody({ b, facing, seats, occupied }: { b: Box; facing: Facing; seats: number; occupied: number[] }) {
  const W = b.x1 - b.x0, D = b.y1 - b.y0, along = horizontal(facing);
  return (
    <g>
      <Prism {...b} z1={DESK_H} tone="ha-t ha-desk" />
      <FrontBand b={b} f={facing} z={DESK_H} v={0.12} />
      {Array.from({ length: seats }, (_, i) => {
        const u = (i + 0.5) / seats;
        const cx = along ? b.x0 + u * W : facing === "e" ? b.x1 - 0.78 * W : b.x0 + 0.78 * W;
        const cy = along ? (facing === "s" ? b.y1 - 0.78 * D : b.y0 + 0.78 * D) : facing === "e" ? b.y1 - u * D : b.y0 + u * D;
        const hw = Math.min(0.32, 0.4 / Math.max(1, seats / 2)), th = 0.05;
        const m = along ? { x0: cx - hw, x1: cx + hw, y0: cy - th, y1: cy + th } : { x0: cx - th, x1: cx + th, y0: cy - hw, y1: cy + hw };
        return <Prism key={i} {...m} z0={DESK_H} z1={DESK_H + 17} tone={`ha-t ${occupied.includes(i) ? "ha-screen-on" : "ha-screen"}`} />;
      })}
    </g>
  );
}

export function NocDesk({ x, y, facing = "s", seats, occupied, ghost }: Base & { seats: number; occupied: number[] }) {
  return ghosted(ghost, <DeskBody b={boxOf(x, y, 2, 1, facing)} facing={facing} seats={seats} occupied={occupied} />);
}

// The one-seat desk of a rented room.
export function Terminal({ x, y, facing = "s", occupied = false, ghost }: Base & { occupied?: boolean }) {
  return ghosted(ghost, <DeskBody b={boxOf(x, y, 1, 1, facing)} facing={facing} seats={1} occupied={occupied ? [0] : []} />);
}

// A wall screen two tiles wide: on the left wall from tile row y, or on the top wall from tile column x.
export function WallScreen({ x, y = 0, state, ghost }: { x?: number; y?: number; state: "ok" | "alarm" | "trip"; ghost?: boolean }) {
  const t = x === undefined ? onX(0, y + 2, 0) : onY(x, 0, 0), z = 28, w = 64, h = 36;
  const block = state === "ok" ? "ha-ok" : state === "alarm" ? "ha-alarm" : "ha-trip";
  return ghosted(ghost, (
    <g transform={`${t} translate(0 ${-z - h})`}>
      <rect className="ha-c ha-screenframe" x={0} y={0} width={w} height={h} />
      <rect className="ha-c ha-screenface" x={2.5} y={2.5} width={w - 5} height={h - 5} />
      {[0, 1, 2, 3].map((i) => <rect key={i} className={`ha-c ${i === 1 && state !== "ok" ? block : "ha-ok"}`} x={6 + i * 14} y={7} width={11} height={7} />)}
      {[0, 1, 2, 3].map((i) => <rect key={i} className={`ha-c ${state === "trip" ? block : i === 3 && state === "alarm" ? block : "ha-okdim"}`} x={6 + i * 14} y={19} width={11} height={11} />)}
    </g>
  ));
}

// A delivered rack waiting in its crate, 1 by 1.
export function CratedRack({ x, y, facing = "s", ghost }: Base) {
  const b = boxOf(x, y, 1, 1, facing), H = 72, f = frontSide(facing);
  return ghosted(ghost, (
    <g>
      <Prism x0={b.x0 + 0.08} y0={b.y0 + 0.08} x1={b.x1 - 0.08} y1={b.y1 - 0.08} z1={H} tone="ha-t ha-crate" />
      {sides.map((s) => [0.28, 0.72].map((u) => (
        <SidePanel key={s + u} b={{ x0: b.x0 + 0.08, y0: b.y0 + 0.08, x1: b.x1 - 0.08, y1: b.y1 - 0.08 }} side={s} u0={u - 0.04} u1={u + 0.04} z0={0} z1={H} cls="ha-c ha-strap" />
      )))}
      {f && <SidePanel b={{ x0: b.x0 + 0.08, y0: b.y0 + 0.08, x1: b.x1 - 0.08, y1: b.y1 - 0.08 }} side={f} u0={0.4} u1={0.6} z0={H * 0.6} z1={H * 0.8} cls="ha-c ha-plate" />}
      <FrontBand b={b} f={facing} z={H} v={0.1} />
    </g>
  ));
}

// The main distribution board on a wall: `axis` "y" hangs it on the far (top) wall at tile x, "x" on the left wall at tile row y.
export function MainBoard({ x, y, axis = "y", ghost }: { x: number; y: number; axis?: "x" | "y"; ghost?: boolean }) {
  const t = axis === "y" ? onY(x, y, 0) : onX(x, y + 2, 0), w = 64, h = 52, z = 20;
  return ghosted(ghost, (
    <g transform={`${t} translate(0 ${-z - h})`}>
      <rect className="ha-c ha-gearpanel" x={0} y={0} width={w} height={h} />
      <rect className="ha-c ha-gearframe" x={0} y={0} width={w} height={3} />
      {[0, 1].map((i) => <rect key={i} className="ha-c ha-screenface" x={5 + i * 29} y={8} width={25} height={12} />)}
      {[0, 1].map((i) => <rect key={i} className="ha-c ha-ok" x={8 + i * 29} y={11} width={12 + i * 4} height={6} />)}
      {Array.from({ length: 8 }, (_, i) => <rect key={i} className="ha-c ha-dark" x={5 + i * 7.3} y={26} width={5.2} height={12} />)}
      {Array.from({ length: 8 }, (_, i) => <rect key={i} className={`ha-c ${i % 3 === 0 ? "ha-alarm" : "ha-ok"}`} x={6.2 + i * 7.3} y={29} width={2.8} height={4} />)}
      <rect className="ha-c ha-trip" x={28} y={42} width={8} height={5} />
    </g>
  ));
}

// The letters N, O and C on the left wall over `len` tiles from tile row y.
const LETTERS = ["M0 0H6L14 16V0H20V28H14L6 12V28H0Z", "M0 0H20V28H0ZM6 6V22H14V6Z", "M0 0H20V6H6V22H20V28H0Z"];
export function NocLettering({ y, len = 3, ghost, company }: { y: number; len?: number; ghost?: boolean; company?: Company }) {
  const t = onX(0, y + len, 0), z = 69, k = company ? 0.8 : 1, LOGO = 22, GAP = 6;
  const span = 20 * 3 + 2 * 8, total = span * k + (company ? LOGO + GAP : 0), x0 = (len * 32 - total) / 2;
  const Icon = company ? ICONS[company.logo] ?? ICONS.server : null;
  const lx = x0 + (company ? LOGO + GAP : 0);
  return ghosted(ghost, (
    <g transform={t}>
      {company && Icon && (
        <g transform={`translate(${x0} ${-z - 25})`} style={{ "--c": company.color } as CSSProperties}>
          <rect className="ha-c ha-letter-shade" x={2} y={2} width={LOGO} height={LOGO} rx={4} />
          <rect className="ha-c" x={0} y={0} width={LOGO} height={LOGO} rx={4} />
          <Icon className="ha-logo-glyph" x={3.5} y={3.5} size={15} strokeWidth={2.2} />
        </g>
      )}
      <g transform={`translate(${lx} ${-z - 28 * k}) scale(${k})`}>
        {LETTERS.map((d, i) => (
          <g key={i} transform={`translate(${i * 28} 0)`}>
            <path className="ha-c ha-letter-shade" d={d} transform="translate(2.4 2.4)" fillRule="evenodd" />
            <path className="ha-c ha-letter" d={d} fillRule="evenodd" />
          </g>
        ))}
      </g>
    </g>
  ));
}

// A rectangle of floor in tiles; the helper Hatch marks the clear ground around equipment.
export function AreaFloor({ x, y, w, h, kind }: { x: number; y: number; w: number; h: number; kind: "concrete" | "epoxy" | "carpet" }) {
  const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + h), d = iso(x, y + h);
  const lines: ReactNode[] = [];
  for (let i = 1; i < w; i++) lines.push(<line key={`x${i}`} className="ha-s ha-joint" x1={iso(x + i, y).x} y1={iso(x + i, y).y} x2={iso(x + i, y + h).x} y2={iso(x + i, y + h).y} />);
  for (let j = 1; j < h; j++) lines.push(<line key={`y${j}`} className="ha-s ha-joint" x1={iso(x, y + j).x} y1={iso(x, y + j).y} x2={iso(x + w, y + j).x} y2={iso(x + w, y + j).y} />);
  return (
    <g>
      <polygon className={`ha-c ha-floor-${kind}`} points={pts(a, b, c, d)} />
      {kind !== "carpet" && lines}
    </g>
  );
}

// Yellow and dark stripes in a ring `m` tiles wide around the tile rectangle.
export function Hatch({ x, y, w, h, m = 0.3 }: { x: number; y: number; w: number; h: number; m?: number }) {
  const id = useId().replace(/:/g, "");
  const ring = (g: number) => [iso(x - g, y - g), iso(x + w + g, y - g), iso(x + w + g, y + h + g), iso(x - g, y + h + g)];
  const path = (g: number) => `M${ring(g).map((p) => `${p.x} ${p.y}`).join("L")}Z`;
  const stripes: ReactNode[] = [];
  for (let s = x - m; s < x + w + m + h + m; s += 0.5) {
    const p = iso(s, y - m), q = iso(s - (h + 2 * m), y + h + m);
    stripes.push(<line key={s} className="ha-s ha-hatch" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />);
  }
  return (
    <g>
      <clipPath id={id}><path d={`${path(m)}${path(0)}`} clipRule="evenodd" /></clipPath>
      <path className="ha-c ha-hatchbase" d={`${path(m)}${path(0)}`} fillRule="evenodd" />
      <g clipPath={`url(#${id})`}>{stripes}</g>
    </g>
  );
}

// A cut-away wall along an axis-aligned edge from grid point (x0, y0) to (x1, y1); about 10 px high.
export function StubWall({ x0, y0, x1, y1, color }: { x0: number; y0: number; x1: number; y1: number; color?: string }) {
  const t = 0.07, b = { x0: Math.min(x0, x1) - t, x1: Math.max(x0, x1) + t, y0: Math.min(y0, y1) - t, y1: Math.max(y0, y1) + t };
  return (
    <g style={color ? ({ "--band": color } as CSSProperties) : undefined}>
      <Prism {...b} z1={10} tone="ha-t ha-stub" />
      {color && <Prism {...b} x0={b.x0 - 0.005} y0={b.y0 - 0.005} x1={b.x1 + 0.005} y1={b.y1 + 0.005} z0={6} z1={10} tone="ha-t ha-band-tone" />}
    </g>
  );
}

// The company band along a full wall from grid point (x0, y0) to (x1, y1), for room walls built from prisms.
export function RoomBand({ x0, y0, x1, y1, color }: { x0: number; y0: number; x1: number; y1: number; color: string }) {
  return <g style={{ "--band": color } as CSSProperties}><WallBand a={iso(x0, y0)} b={iso(x1, y1)} /></g>;
}

// A gap in a wall at the tile (x, y) with the door panel standing open. axis "x" is a wall along x at the top of the
// tile, axis "y" a wall along y at its left; the panel swings toward positive grid values.
export function Doorway({ x, y, axis }: { x: number; y: number; axis: "x" | "y" }) {
  const H = 64;
  const [a, b, c, d] = axis === "x" ? [[x, y - 0.1], [x + 1, y - 0.1], [x + 1, y + 0.1], [x, y + 0.1]] : [[x - 0.1, y], [x + 0.1, y], [x + 0.1, y + 1], [x - 0.1, y + 1]];
  // Panel hinged at the lower-left grid corner of the gap, opened into the room.
  const hinge: [number, number] = axis === "x" ? [x + 0.92, y] : [x, y + 0.92];
  const free: [number, number] = axis === "x" ? [x + 0.92, y + 0.85] : [x + 0.85, y + 0.92];
  return (
    <g>
      <polygon className="ha-c ha-threshold" points={pts(iso(a[0], a[1]), iso(b[0], b[1]), iso(c[0], c[1]), iso(d[0], d[1]))} />
      <polygon className="ha-door-panel" points={pts(at3(hinge[0], hinge[1], 0), at3(free[0], free[1], 0), at3(free[0], free[1], H), at3(hinge[0], hinge[1], H))} />
    </g>
  );
}
