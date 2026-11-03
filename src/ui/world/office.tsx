// The office room's fixtures and the staff at their desks, drawn to docs/design/world-art.md.
import { useState, type ReactNode } from "react";
import { dateOf } from "../../sim/00-core/time";
import { officeSeats, officeWalk, SECTION_W, type Fixture, type OfficePlan } from "../../sim/20-world/layout";
import type { GameState, Location } from "../../sim/50-state";
import { whoIsIn } from "../../sim/60-infra/properties";
import { at3, Desk, DeskLamp, Monitor, onX, onY, Prism, pts, Tower, WALL } from "./draw";
import { iso, type Pt } from "./grid";
import "./office.css";

const DESK_Z = 25;

// A desk of two tiles in an island: the "s" desk's occupant sits north of it facing the room, the "n" desk's sits south facing the wall.
export function OfficeDesk({ f, facing }: { f: Fixture; facing: "s" | "n" }) {
  const x0 = f.x + 0.06, x1 = f.x + 1.94, y0 = f.y + (facing === "s" ? 0.18 : 0.02), y1 = y0 + 0.8, cx = f.x + 1;
  const leg = (x: number, y: number) => <Prism key={`${x}-${y}`} x0={x} y0={y} x1={x + 0.06} y1={y + 0.06} z1={DESK_Z - 3} tone="w-tone-frame" />;
  const phone = { x: f.x + 0.2, y: y0 + 0.3 }, tray = { x: f.x + 1.55, y: y0 + 0.12 };
  return (
    <>
      {leg(x0 + 0.04, y0 + 0.04)}{leg(x1 - 0.1, y0 + 0.04)}{leg(x0 + 0.04, y1 - 0.1)}{leg(x1 - 0.1, y1 - 0.1)}
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z0={DESK_Z - 3} z1={DESK_Z} tone="w-tone-laminate" />
      <Prism x0={tray.x} y0={tray.y} x1={tray.x + 0.3} y1={tray.y + 0.22} z0={DESK_Z} z1={DESK_Z + 2} tone="w-tone-dark" />
      <Prism x0={tray.x + 0.03} y0={tray.y + 0.03} x1={tray.x + 0.27} y1={tray.y + 0.19} z0={DESK_Z + 2} z1={DESK_Z + 3} tone="w-tone-paper" />
      <Prism x0={tray.x} y0={tray.y} x1={tray.x + 0.3} y1={tray.y + 0.22} z0={DESK_Z + 4} z1={DESK_Z + 5} tone="w-tone-dark" />
      <Prism x0={phone.x} y0={phone.y} x1={phone.x + 0.2} y1={phone.y + 0.18} z0={DESK_Z} z1={DESK_Z + 2.5} tone="w-tone-dark" />
      <Prism x0={phone.x + 0.02} y0={phone.y + 0.02} x1={phone.x + 0.07} y1={phone.y + 0.16} z0={DESK_Z + 2.5} z1={DESK_Z + 4} tone="w-tone-dark" />
      <rect className="w-phone-lcd" x={at3(phone.x + 0.1, phone.y + 0.18, DESK_Z + 2).x} y={at3(phone.x + 0.1, phone.y + 0.18, DESK_Z + 2).y} width="2.4" height="1" />
      {facing === "n" ? <Monitor x={cx - 0.5} y={f.y - 0.05} /> : <ScreenBack cx={cx} y={y0} />}
    </>
  );
}

// A flat screen seen from behind, its keyboard toward the occupant on the far side.
function ScreenBack({ cx, y }: { cx: number; y: number }) {
  const ky = y + 0.14, rows = [0.04, 0.08, 0.12].map((k) => `M${pts(at3(cx - 0.24, ky + k, DESK_Z + 1.6))} L${pts(at3(cx + 0.24, ky + k, DESK_Z + 1.6))}`).join(" ");
  return (
    <>
      <Prism x0={cx - 0.28} y0={ky} x1={cx + 0.28} y1={ky + 0.16} z0={DESK_Z} z1={DESK_Z + 1.5} tone="w-tone-paper" />
      <path className="w-keys" d={rows} />
      <Prism x0={cx + 0.36} y0={ky + 0.04} x1={cx + 0.44} y1={ky + 0.14} z0={DESK_Z} z1={DESK_Z + 1.5} tone="w-tone-paper" />
      <Prism x0={cx - 0.14} y0={y + 0.48} x1={cx + 0.14} y1={y + 0.64} z0={DESK_Z} z1={DESK_Z + 1} tone="w-tone-pc" />
      <Prism x0={cx - 0.04} y0={y + 0.5} x1={cx + 0.04} y1={y + 0.56} z0={DESK_Z + 1} z1={DESK_Z + 8} tone="w-tone-pc" />
      <Prism x0={cx - 0.38} y0={y + 0.42} x1={cx + 0.38} y1={y + 0.5} z0={DESK_Z + 6} z1={DESK_Z + 27} tone="w-tone-pc" />
      <rect className="w-vent" x={at3(cx - 0.1, y + 0.5, DESK_Z + 20).x} y={at3(cx - 0.1, y + 0.5, DESK_Z + 20).y} width="7" height="1" />
    </>
  );
}

// A swivel chair centred on (cx, cy); the backrest is on the side away from the desk.
export function OfficeChair({ cx, cy, facing }: { cx: number; cy: number; facing: "s" | "n" }) {
  const hub = at3(cx, cy, 3), k = facing === "s" ? -1 : 1;
  const feet = [0, 1, 2, 3, 4].map((i) => at3(cx + 0.28 * Math.cos(i * 1.2566 + 0.4), cy + 0.28 * Math.sin(i * 1.2566 + 0.4), 1.2));
  const back = <Prism x0={cx - 0.21} y0={k > 0 ? cy + 0.24 : cy - 0.31} x1={cx + 0.21} y1={k > 0 ? cy + 0.31 : cy - 0.24} z0={22} z1={42} tone="w-tone-fabric" />;
  const post = <Prism x0={cx - 0.03} y0={k > 0 ? cy + 0.22 : cy - 0.27} x1={cx + 0.03} y1={k > 0 ? cy + 0.27 : cy - 0.22} z0={15} z1={22} tone="w-tone-dark" />;
  return (
    <>
      {feet.map((p, i) => <path key={i} className="w-chair-leg" d={`M${pts(hub)} L${pts(p)}`} />)}
      {feet.map((p, i) => <circle key={i} className="w-caster" cx={p.x} cy={p.y + 0.8} r="1.1" />)}
      {k < 0 && <>{post}{back}</>}
      <Prism x0={cx - 0.03} y0={cy - 0.03} x1={cx + 0.03} y1={cy + 0.03} z0={3} z1={14} tone="w-tone-dark" />
      <Prism x0={cx - 0.24} y0={cy - 0.22} x1={cx + 0.24} y1={cy + 0.22} z0={14} z1={18} tone="w-tone-fabric" />
      {k > 0 && <>{post}{back}</>}
    </>
  );
}

export const chairAt = (f: Fixture, facing: "s" | "n") => ({ cx: f.x + 1, cy: f.y + (facing === "s" ? 0.55 : 0.45) });

// An office window of two tiles in the far wall: frame, mullion, sill and the city outside, dark after sunset.
export function OfficeWindow({ f, night }: { f: Fixture; night: boolean }) {
  const len = (f.w ?? 2) * 32, top = 72, H = 44;
  const towers = [[6, 18], [13, 30], [21, 12], [28, 24], [36, 34], [44, 16], [51, 26]];
  return (
    <g transform={onY(f.x, 0, top)}>
      <rect className="w-reveal" x="3" y="-1" width={len - 6} height={H + 1} />
      <rect className={night ? "w-sky-night" : "w-sky"} x="6" y="2" width={len - 12} height={H - 4} />
      {towers.filter(([x]) => x < len - 12).map(([x, h], i) => (
        <g key={x}>
          <rect className={night ? "w-city-night" : "w-city"} x={6 + x} y={H - 2 - h} width="6" height={h} />
          {[0, 1, 2].map((r) => r * 6 + 4 < h && <rect key={r} className={night && (i + r) % 2 ? "w-city-lit" : "w-city-win"} x={7.5 + x} y={H - h + r * 6} width="1.5" height="2" />)}
        </g>
      ))}
      <rect className="w-frame-in" x="4" y="0" width={len - 8} height="2" />
      <rect className="w-frame-in" x="4" y={H - 2} width={len - 8} height="2" />
      <rect className="w-frame-in" x="4" y="0" width="2" height={H} />
      <rect className="w-frame-in" x={len - 6} y="0" width="2" height={H} />
      <rect className="w-frame-in" x={len / 2 - 1} y="0" width="2" height={H} />
      <path className="w-glint" d={`M10,${H - 6} L16,6 M${len / 2 + 5},${H - 6} L${len / 2 + 10},8`} />
      <rect className="w-sill" x="2" y={H} width={len - 4} height="2.5" />
    </g>
  );
}

// Whiteboard with marker scribbles, a box diagram and its pen tray.
export function Whiteboard({ f }: { f: Fixture }) {
  const len = (f.w ?? 2) * 32;
  return (
    <g transform={onY(f.x, 0, 74)}>
      <rect className="w-board-frame" x="4" y="0" width={len - 8} height="34" />
      <rect className="w-board" x="5.5" y="1.5" width={len - 11} height="31" />
      <path className="w-ink-blue" d="M10,7 L20,7 L20,13 L10,13 Z M20,10 L30,10 M30,7 L40,7 L40,13 L30,13 Z M35,13 L35,20 M30,20 L40,20 L40,26 L30,26 Z" />
      <path className="w-ink-red" d="M44,8 Q48,5 52,9 T58,8 M44,14 L56,14 M44,18 L52,18 M12,22 Q16,19 20,24 T26,23" />
      <rect className="w-tray-pen" x="8" y="34" width={len - 16} height="2" />
      <rect className="w-pen-blue" x="14" y="33" width="6" height="1.4" />
      <rect className="w-pen-red" x="22" y="33" width="6" height="1.4" />
    </g>
  );
}

// Potted plant: a square pot and round leaves.
export function Plant({ f }: { f: Fixture }) {
  const cx = f.x + 0.5, cy = f.y + 0.5, c = (dx: number, dy: number, z: number) => at3(cx + dx, cy + dy, z);
  const leaves: [number, number, number, number][] = [[-0.12, 0, 30, 7], [0.1, -0.06, 34, 6], [0, 0.1, 40, 6.5], [-0.06, -0.1, 44, 5.5], [0.08, 0.06, 26, 6]];
  return (
    <>
      <Prism x0={cx - 0.16} y0={cy - 0.16} x1={cx + 0.16} y1={cy + 0.16} z1={16} tone="w-tone-pot" />
      <path className="w-stem" d={`M${pts(c(0, 0, 16))} L${pts(c(0, 0, 40))}`} />
      {leaves.map(([dx, dy, z, r], i) => { const p = c(dx, dy, z); return <ellipse key={i} className={i % 2 ? "w-leaf-dark" : "w-leaf"} cx={p.x} cy={p.y} rx={r} ry={r * 0.7} />; })}
    </>
  );
}

// Waste bin with a crumpled sheet on top.
export function Bin({ f }: { f: Fixture }) {
  const cx = f.x + 0.5, cy = f.y + 0.5, p = at3(cx, cy, 12);
  return (
    <>
      <Prism x0={cx - 0.12} y0={cy - 0.12} x1={cx + 0.12} y1={cy + 0.12} z1={11} tone="w-tone-frame" />
      <circle className="w-crumple" cx={p.x} cy={p.y} r="2.2" />
    </>
  );
}

// A pair of fluorescent tubes in their housing under the ceiling, lit while the office is open.
export function Tube({ f, on }: { f: Fixture; on: boolean }) {
  const x0 = f.x + 0.2, x1 = f.x + (f.w ?? 1) - 0.2, y = f.y + 0.4, z = WALL + 8;
  return (
    <>
      {[x0 + 0.1, x1 - 0.1].map((x) => <path key={x} className="w-cord" d={`M${pts(at3(x, y + 0.1, z + 60))} L${pts(at3(x, y + 0.1, z + 3))}`} />)}
      <Prism x0={x0} y0={y} x1={x1} y1={y + 0.2} z0={z} z1={z + 3} tone="w-tone-enamel" />
      {[0.05, 0.13].map((k) => <path key={k} className={on ? "w-tube-on" : "w-tube-off"} d={`M${pts(at3(x0 + 0.04, y + k, z - 0.6))} L${pts(at3(x1 - 0.04, y + k, z - 0.6))}`} />)}
    </>
  );
}

// Kitchenette in the corner: base cabinets with a sink and the coffee machine, wall cabinets and a kettle.
export function Kitchen({ f }: { f: Fixture }) {
  const x1 = f.x + (f.w ?? 2) - 0.04, len = (x1 - f.x) * 32, y1 = 0.62, cm = { x: f.x + 1.3, y: 0.12 };
  return (
    <>
      <g transform={onY(f.x, 0, 84)}>
        <rect className="w-cab" x="2" y="0" width={len - 4} height="22" />
        <path className="w-cab-line" d={`M${len / 2},0 L${len / 2},22`} />
        <rect className="w-handle" x={len / 2 - 4} y="16" width="2" height="4" />
        <rect className="w-handle" x={len / 2 + 2} y="16" width="2" height="4" />
      </g>
      <Prism x0={f.x + 0.04} y0={0.04} x1={x1} y1={y1} z1={27} tone="w-tone-cab" />
      <g transform={onY(f.x + 0.04, y1, 25)}>
        {[0, 1, 2].map((i) => <rect key={i} className="w-cab-door" x={2 + i * (len / 3)} y="3" width={len / 3 - 4} height="20" />)}
        {[0, 1, 2].map((i) => <rect key={i} className="w-handle" x={len / 3 - 6 + i * (len / 3)} y="6" width="1.5" height="4" />)}
      </g>
      <Prism x0={f.x} y0={0.02} x1={x1 + 0.02} y1={y1 + 0.04} z0={27} z1={29} tone="w-tone-worktop" />
      <polygon className="w-sink" points={pts(at3(f.x + 0.2, 0.18, 29.2), at3(f.x + 0.7, 0.18, 29.2), at3(f.x + 0.7, 0.5, 29.2), at3(f.x + 0.2, 0.5, 29.2))} />
      <path className="w-tap" d={`M${pts(at3(f.x + 0.45, 0.1, 29))} L${pts(at3(f.x + 0.45, 0.1, 37))} L${pts(at3(f.x + 0.45, 0.22, 37))}`} />
      <Prism x0={cm.x} y0={cm.y} x1={cm.x + 0.32} y1={cm.y + 0.36} z0={29} z1={45} tone="w-tone-dark" />
      <Prism x0={cm.x + 0.08} y0={cm.y + 0.36} x1={cm.x + 0.24} y1={cm.y + 0.42} z0={33} z1={36} tone="w-tone-dark" />
      <Prism x0={cm.x + 0.1} y0={cm.y + 0.3} x1={cm.x + 0.22} y1={cm.y + 0.42} z0={29} z1={32} tone="w-tone-enamel" />
      <rect className="w-pled" x={at3(cm.x + 0.26, cm.y + 0.36, 42).x} y={at3(cm.x + 0.26, cm.y + 0.36, 42).y} width="1.2" height="0.8" />
      <Prism x0={f.x + 0.85} y0={0.2} x1={f.x + 1.02} y1={0.37} z0={29} z1={36} tone="w-tone-enamel" />
    </>
  );
}

// The player's own desk along the far wall: the PC that opens the desktop, the tower under it and a lamp.
export function BossDesk({ f, night }: { f: Fixture; night: boolean }) {
  const w = f.w ?? 2;
  return (
    <>
      <Desk from={f.x} to={f.x + w} under={<Tower x={f.x + w - 1} />} />
      <Monitor x={f.x + w - 1} />
      <DeskLamp x={f.x} on={night} />
    </>
  );
}

// Floor-standing office printer with its paper drawers, output tray and panel.
export function Printer({ f }: { f: Fixture }) {
  const x0 = f.x + 0.12, x1 = f.x + 0.82, y0 = f.y + 0.1, y1 = f.y + 0.8, H = 34;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z1={H} tone="w-tone-pc" />
      <g transform={onX(x1, y1, 22)}>
        {[0, 1].map((i) => <rect key={i} className="w-drawer" x="3" y={4 + i * 9} width="16" height="7" />)}
      </g>
      <Prism x0={x0 + 0.1} y0={y0 + 0.1} x1={x1 - 0.2} y1={y1 - 0.1} z0={H} z1={H + 1.5} tone="w-tone-paper" />
      <Prism x0={x1 - 0.18} y0={y0 + 0.1} x1={x1 - 0.04} y1={y1 - 0.3} z0={H} z1={H + 3} tone="w-tone-dark" />
      <rect className="w-pled" x={at3(x1 - 0.1, y1 - 0.32, H + 2.5).x} y={at3(x1 - 0.1, y1 - 0.32, H + 2.5).y} width="1.2" height="0.8" />
    </>
  );
}

// Reception counter facing the door, its front panel carrying the company's name plate.
export function Reception({ f, name }: { f: Fixture; name: string }) {
  const x0 = f.x + 0.06, x1 = f.x + (f.w ?? 2) - 0.06, y0 = f.y + 0.2, y1 = f.y + 0.75, len = (x1 - x0) * 32;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z1={36} tone="w-tone-laminate" />
      <Prism x0={x0 - 0.04} y0={y0 - 0.04} x1={x1 + 0.04} y1={y1 + 0.06} z0={36} z1={38} tone="w-tone-wood" />
      <g transform={onY(x0, y1, 28)}>
        <rect className="w-nameplate" x="4" y="0" width={len - 8} height="7" />
        <text className="w-num w-num-xs w-plate-text" x={len / 2} y="4.9" textLength={Math.min(len - 12, name.length * 2.2)} lengthAdjust="spacingAndGlyphs">{name}</text>
      </g>
      <Prism x0={x0 + 0.2} y0={y0 + 0.1} x1={x0 + 0.5} y1={y0 + 0.3} z0={38} z1={39.5} tone="w-tone-paper" />
    </>
  );
}

// One segment of the glass partition in front of a server room: a floor-to-ceiling pane between slim posts, a rail on top.
export function Partition({ f }: { f: Fixture }) {
  return (
    <>
      <Prism x0={f.x - 0.03} y0={f.y} x1={f.x + 0.03} y1={f.y + 0.05} z1={WALL} tone="w-tone-frame" />
      <polygon className="w-pane" points={pts(at3(f.x, f.y, 2), at3(f.x, f.y + 1, 2), at3(f.x, f.y + 1, WALL - 4), at3(f.x, f.y, WALL - 4))} />
      <path className="w-glint" d={`M${pts(at3(f.x, f.y + 0.3, 30))} L${pts(at3(f.x, f.y + 0.55, 60))}`} />
      <Prism x0={f.x - 0.03} y0={f.y} x1={f.x + 0.03} y1={f.y + 1} z0={0} z1={2} tone="w-tone-frame" />
      <Prism x0={f.x - 0.03} y0={f.y} x1={f.x + 0.03} y1={f.y + 1} z0={WALL - 4} z1={WALL} tone="w-tone-frame" />
    </>
  );
}

// The server room's glass door in the partition, in a metal frame, with the code lock on its post.
export function CodeDoor({ f }: { f: Fixture }) {
  const lock = at3(f.x, f.y + 0.08, 40), sign = at3(f.x, f.y + 0.75, 60);
  return (
    <>
      <Prism x0={f.x - 0.04} y0={f.y} x1={f.x + 0.04} y1={f.y + 0.08} z1={WALL} tone="w-tone-frame" />
      <Prism x0={f.x - 0.04} y0={f.y + 0.92} x1={f.x + 0.04} y1={f.y + 1} z1={WALL} tone="w-tone-frame" />
      <polygon className="w-pane w-pane-door" points={pts(at3(f.x, f.y + 0.1, 2), at3(f.x, f.y + 0.9, 2), at3(f.x, f.y + 0.9, 68), at3(f.x, f.y + 0.1, 68))} />
      <Prism x0={f.x - 0.04} y0={f.y} x1={f.x + 0.04} y1={f.y + 1} z0={68} z1={72} tone="w-tone-frame" />
      <polygon className="w-pane" points={pts(at3(f.x, f.y, 72), at3(f.x, f.y + 1, 72), at3(f.x, f.y + 1, WALL - 4), at3(f.x, f.y, WALL - 4))} />
      <Prism x0={f.x - 0.04} y0={f.y} x1={f.x + 0.04} y1={f.y + 1} z0={WALL - 4} z1={WALL} tone="w-tone-frame" />
      <Prism x0={f.x - 0.02} y0={f.y + 0.14} x1={f.x + 0.02} y1={f.y + 0.2} z0={28} z1={40} tone="w-tone-dark" />
      <rect className="w-keypad" x={lock.x - 1.6} y={lock.y} width="3.2" height="5" />
      <rect className="w-led-on" x={lock.x - 0.6} y={lock.y + 0.8} width="1.2" height="0.8" />
      <rect className="w-sign-server" x={sign.x - 3} y={sign.y} width="6" height="4" />
    </>
  );
}

// A cable tray along the far wall of a server room with the bundles in it.
export function WallTray({ f }: { f: Fixture }) {
  const len = (f.w ?? 1) * 32;
  return (
    <g transform={onY(f.x, 0, 86)}>
      <rect className="w-tray" x="0" y="0" width={len} height="5" />
      {[0, 1, 2].map((i) => <rect key={i} className={["w-cable-blue", "w-cable-yellow", "w-cable-grey"][i]} x="0" y={-1.5 - i * 1.2} width={len} height="1.2" />)}
      {Array.from({ length: Math.floor(len / 24) }, (_, i) => <rect key={i} className="w-tray" x={i * 24 + 10} y="5" width="2" height="6" />)}
    </g>
  );
}

// The stairwell door in the left wall with a floor sign beside it.
export function StairsSign({ f, floor }: { f: Fixture; floor: string }) {
  return (
    <g transform={onX(0, f.y + 1, 78)}>
      <rect className="w-nameplate" x="6" y="0" width="20" height="9" />
      <path className="w-stairs-icon" d="M8,7 L11,7 L11,5 L14,5 L14,3 L17,3" />
      <text className="w-num w-num-sm w-plate-text" x="24" y="6.4">{floor}</text>
    </g>
  );
}

// Paint buckets, a ladder and a toolbox in a section under refit.
export function Buckets({ f }: { f: Fixture }) {
  return (
    <>
      {[[0.2, 0.3], [0.5, 0.45], [0.3, 0.62]].map(([dx, dy], i) => (
        <g key={i}>
          <Prism x0={f.x + dx} y0={f.y + dy} x1={f.x + dx + 0.2} y1={f.y + dy + 0.2} z1={12} tone="w-tone-enamel" />
          <polygon className={["w-paint-a", "w-paint-b", "w-paint-a"][i]} points={pts(at3(f.x + dx + 0.03, f.y + dy + 0.03, 12.1), at3(f.x + dx + 0.17, f.y + dy + 0.03, 12.1), at3(f.x + dx + 0.17, f.y + dy + 0.17, 12.1), at3(f.x + dx + 0.03, f.y + dy + 0.17, 12.1))} />
        </g>
      ))}
    </>
  );
}

export function Ladder({ f }: { f: Fixture }) {
  const a = (y: number, z: number) => at3(f.x + 0.3, f.y + y, z), b = (y: number, z: number) => at3(f.x + 0.7, f.y + y, z);
  return (
    <>
      <path className="w-ladder" d={`M${pts(a(0.15, 0))} L${pts(a(0.5, 70))} M${pts(b(0.15, 0))} L${pts(b(0.5, 70))} M${pts(a(0.85, 0))} L${pts(a(0.5, 70))} M${pts(b(0.85, 0))} L${pts(b(0.5, 70))}`} />
      {[14, 28, 42, 56].map((z) => { const y = 0.15 + (z / 70) * 0.35; return <path key={z} className="w-ladder" d={`M${pts(a(y, z))} L${pts(b(y, z))}`} />; })}
      <Prism x0={f.x + 0.28} y0={f.y + 0.42} x1={f.x + 0.72} y1={f.y + 0.58} z0={70} z1={72} tone="w-tone-cool" />
    </>
  );
}

export function Toolbox({ f }: { f: Fixture }) {
  const x0 = f.x + 0.2, y0 = f.y + 0.3;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x0 + 0.5} y1={y0 + 0.24} z1={10} tone="w-tone-red" />
      <path className="w-cord" d={`M${pts(at3(x0 + 0.12, y0 + 0.12, 10))} L${pts(at3(x0 + 0.12, y0 + 0.12, 14))} L${pts(at3(x0 + 0.38, y0 + 0.12, 14))} L${pts(at3(x0 + 0.38, y0 + 0.12, 10))}`} />
      <polygon className="w-dropcloth" points={pts(iso(f.x - 0.4, f.y - 0.6), iso(f.x + 1.2, f.y - 0.8), iso(f.x + 1.4, f.y + 0.2), iso(f.x - 0.2, f.y + 0.4))} />
    </>
  );
}

// The office floor: carpet in desk blocks and the reception, raised tiles in the server rooms.
export function OfficeFloor({ w, h, servers }: { w: number; h: number; servers: number[] }) {
  const lines: string[] = [];
  for (const ox of servers) {
    for (let x = ox + 1; x < ox + SECTION_W; x++) lines.push(`M${pts(iso(x, 0))} L${pts(iso(x, h))}`);
    for (let y = 1; y < h; y++) lines.push(`M${pts(iso(ox, y))} L${pts(iso(ox + SECTION_W, y))}`);
  }
  return (
    <g pointerEvents="none">
      <polygon className="w-carpet" points={pts(iso(0, 0), iso(w, 0), iso(w, h), iso(0, h))} />
      {servers.map((ox) => <polygon key={ox} className="w-raised" points={pts(iso(ox, 0), iso(ox + SECTION_W, 0), iso(ox + SECTION_W, h), iso(ox, h))} />)}
      <path className="w-tile" d={lines.join(" ")} />
    </g>
  );
}

// People: a rounded figure in flat colours, head a little large, seated facing the screen or walking the grid.
const SKIN = ["oklch(0.82 0.06 60)", "oklch(0.72 0.08 55)", "oklch(0.58 0.08 50)", "oklch(0.45 0.06 45)"];
const HAIR = ["oklch(0.3 0.03 50)", "oklch(0.5 0.08 60)", "oklch(0.75 0.1 85)", "oklch(0.25 0.01 260)", "oklch(0.55 0.12 40)"];
const SHIRT = ["oklch(0.55 0.12 250)", "oklch(0.62 0.12 150)", "oklch(0.7 0.13 70)", "oklch(0.55 0.15 20)", "oklch(0.8 0.02 250)", "oklch(0.5 0.08 300)"];
const PANTS = ["oklch(0.35 0.04 255)", "oklch(0.3 0.01 60)", "oklch(0.5 0.03 80)"];
// String hash with a final mix, so ids that differ in one digit still spread.
const hash = (s: string) => { let h = [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 0x5bd1e995) >>> 0, 7); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); return (h ^ (h >>> 13)) >>> 0; };
const look = (id: string) => { const h = hash(id); return { skin: SKIN[h % 4], hair: HAIR[(h >>> 3) % 5], shirt: SHIRT[(h >>> 6) % 6], pants: PANTS[(h >>> 9) % 3], delay: (h % 50) / 10 }; };
type Look = ReturnType<typeof look>;
// Screen offset of a step of dx, dy tiles at height z.
const rel = (dx: number, dy: number, z: number): Pt => ({ x: (dx - dy) * 32, y: (dx + dy) * 16 - z });

function Seated({ l, facing }: { l: Look; facing: "s" | "n" }) {
  const k = facing === "s" ? 1 : -1, knee = rel(0, 0.3 * k, 18), head = rel(0, 0, 41);
  return (
    <>
      {facing === "s" && <path className="w-fig" style={{ stroke: l.pants }} strokeWidth="6" strokeLinecap="round" d={`M-3,-18 L${knee.x - 3},${knee.y} M3,-18 L${knee.x + 3},${knee.y}`} />}
      <rect x="-7" y="-35" width="14" height="19" rx="6" fill={l.shirt} />
      {facing === "s" && (
        <g className="w-fig-hands" style={{ animationDelay: `${l.delay}s` }}>
          <path stroke={l.shirt} strokeWidth="3.4" strokeLinecap="round" fill="none" d={`M-6,-31 L${rel(-0.1, 0.32, 24).x},${rel(-0.1, 0.32, 24).y} M6,-31 L${rel(0.1, 0.32, 24).x},${rel(0.1, 0.32, 24).y}`} />
          <circle cx={rel(-0.1, 0.32, 24).x} cy={rel(-0.1, 0.32, 24).y} r="1.8" fill={l.skin} />
          <circle cx={rel(0.1, 0.32, 24).x} cy={rel(0.1, 0.32, 24).y} r="1.8" fill={l.skin} />
        </g>
      )}
      <g className="w-fig-head" style={{ animationDelay: `${l.delay}s`, transformOrigin: `0px ${head.y + 6}px` }}>
        <circle cx="0" cy={head.y} r="7" fill={l.skin} />
        {facing === "s"
          ? <path fill={l.hair} d={`M-7,${head.y - 0.5} A7,7 0 0 1 7,${head.y - 0.5} L5,${head.y - 3} L-5,${head.y - 3} Z`} />
          : <path fill={l.hair} d={`M-7,${head.y + 1.5} A7,7 0 1 1 7,${head.y + 1.5} Z`} />}
      </g>
    </>
  );
}

function Walking({ l, step }: { l: Look; step: number }) {
  const s = step ? 2 : -2;
  return (
    <>
      <path stroke={l.pants} strokeWidth="5" strokeLinecap="round" d={`M-3,-24 L${-3 + s},-2 M3,-24 L${3 - s},-2`} />
      <rect x="-7" y="-44" width="14" height="22" rx="6" fill={l.shirt} />
      <circle cx="0" cy="-51" r="7" fill={l.skin} />
      <path fill={l.hair} d="M-7,-51.5 A7,7 0 0 1 7,-51.5 L5,-54 L-5,-54 Z" />
    </>
  );
}

// Minutes of the day each person arrives and leaves, spread over the first and last half hour, and how long the walk takes.
const WALK_MIN = 6, ARRIVE = 9 * 60, LEAVE = 17 * 60 + 30, SPREAD = 30 - WALK_MIN;

function along(path: Pt[], t: number): Pt {
  const seg = path.slice(1).map((p, i) => Math.abs(p.x - path[i].x) + Math.abs(p.y - path[i].y)), total = seg.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const k = seg[i] ? d / seg[i] : 0; return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k }; }
    d -= seg[i];
  }
  return path[path.length - 1];
}

// The staff on this floor as depth-sorted things, and the name card on the desk of the one under the pointer.
export function useOfficeStaff(game: GameState, loc: Location, plan: OfficePlan | undefined): { depth: number; node: ReactNode }[] {
  const [hover, setHover] = useState<string | null>(null);
  const p = plan && game.properties.find((x) => x.locationId === loc.id);
  if (!p || !plan) return [];
  const seats = new Map(officeSeats(plan).map((x) => [`${x.sectionId}/${x.index}`, x]));
  const m = dateOf(game.hour).getUTCHours() * 60 + game.minute, out: { depth: number; node: ReactNode }[] = [];
  for (const e of whoIsIn(game, p.id, game.hour)) {
    const seat = e.desk && seats.get(`${e.desk.sectionId}/${e.desk.index}`);
    if (!seat || seat.floor !== plan.floor) continue;
    const h = hash(e.id), arrive = ARRIVE + (h % SPREAD), leave = LEAVE + ((h >>> 4) % SPREAD);
    if (m < arrive || m >= leave + WALK_MIN) continue;
    const t = m < arrive + WALK_MIN ? (m - arrive) / WALK_MIN : m >= leave ? 1 - (m - leave) / WALK_MIN : 1, l = look(e.id);
    const facing = seat.facing === "s" ? "s" : "n", chair = { cx: seat.x + 1, cy: seat.y + (facing === "s" ? 0.55 : 0.45) };
    const pos = t >= 1 ? { x: chair.cx, y: chair.cy } : along(officeWalk(plan, seat), t), s = iso(pos.x, pos.y);
    const enter = () => setHover(e.id), exit = () => setHover((v) => (v === e.id ? null : v));
    out.push({
      // Seated facing the wall, the chair's backrest is drawn over the person; facing the room, the person over the chair.
      depth: t >= 1 ? seat.x + seat.y + (facing === "s" ? 0.001 : -0.001) : Math.floor(pos.x) + Math.floor(pos.y) + 0.5,
      node: (
        <g key={e.id} className="w-person" data-person={e.id} aria-label={e.name} style={{ transform: `translate(${s.x}px, ${s.y}px)` }} onPointerEnter={enter} onPointerLeave={exit}>
          {t >= 1 ? <Seated l={l} facing={facing} /> : <Walking l={l} step={m % 2} />}
        </g>
      ),
    });
    if (hover === e.id && t >= 1) {
      // A tent card at the desk's left corner, toward the person.
      const dy = facing === "s" ? 1.3 : -0.3, c = at3(seat.x + 0.18, seat.y + dy, DESK_Z);
      out.push({
        depth: seat.x + seat.y + 3,
        node: (
          <g key={`tag-${e.id}`} pointerEvents="none" transform={`translate(${c.x} ${c.y})`}>
            <rect className="w-tent" x="-1" y="-7" width={e.name.length * 2.6 + 4} height="7" />
            <text className="w-num w-num-sm w-tent-text" x="1" y="-2">{e.name}</text>
          </g>
        ),
      });
    }
  }
  return out;
}
