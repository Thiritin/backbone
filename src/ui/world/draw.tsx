import type { ReactNode } from "react";
import type { Cage, Fixture, Tile } from "../../sim/20-world/layout";
import { RackFront, type RackItem } from "../art/RackFront";
import { center, iso, type Pt } from "./grid";

export const WALL = 96;
const DOOR_H = 64, FENCE = 84, DESK_Z = 25;
// Rack art is drawn 110 wide with 10 per unit, about a 19-inch front.
const RACK_W = 110, ART_U = 10;
export const PARCEL_H = 12;

export const pts = (...p: Pt[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
export const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });
export const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
// Screen point of grid position (x, y) at height z.
export const at3 = (x: number, y: number, z: number): Pt => up(iso(x, y), z);
// Flat drawing on a vertical plane, half a tile width per 32 local units and local y down from height z.
// A plane of constant y starts at x and runs along x; a plane of constant x starts at y and runs toward smaller y.
const plane = (p: Pt, k: number) => `matrix(1 ${k} 0 1 ${p.x} ${p.y})`;
export const onY = (x: number, y: number, z: number) => plane(at3(x, y, z), 0.5);
export const onX = (x: number, y: number, z: number) => plane(at3(x, y, z), -0.5);
// The far wall behind fixture f: the left wall for column 0, else the right one; local x spans the fixture's width.
const wallT = (f: Fixture, z: number) => (f.x === 0 && f.y > 0 ? onX(0, f.y + 1, z) : onY(f.x, 0, z));

// A box over the grid rectangle x0..x1, y0..y1 from height z0 to z1, in the face tones of its tone class.
export function Prism({ x0, y0, x1, y1, z0 = 0, z1, tone }: { x0: number; y0: number; x1: number; y1: number; z0?: number; z1: number; tone: string }) {
  return (
    <g className={`w-box ${tone}`}>
      <polygon className="w-face-l" points={pts(at3(x0, y1, z0), at3(x1, y1, z0), at3(x1, y1, z1), at3(x0, y1, z1))} />
      <polygon className="w-face-r" points={pts(at3(x1, y1, z0), at3(x1, y0, z0), at3(x1, y0, z1), at3(x1, y1, z1))} />
      <polygon className="w-face-t" points={pts(at3(x0, y0, z1), at3(x1, y0, z1), at3(x1, y1, z1), at3(x0, y1, z1))} />
    </g>
  );
}

// The two far walls with a lit top edge and skirting; a datacenter hangs a cable tray with cables along both.
export function Walls({ w, h, dc }: { w: number; h: number; dc: boolean }) {
  const O = iso(0, 0), X = iso(w, 0), Y = iso(0, h), top = up(O, WALL), OUT_L = iso(-0.25, 0), OUT_R = iso(0, -0.25);
  return (
    <g className="w-walls" pointerEvents="none">
      <defs>
        <pattern id="w-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><path className="w-mesh-line" d="M0,0 L5,5 M5,0 L0,5" /></pattern>
        <pattern id="w-rack-mesh" width="7" height="7" patternUnits="userSpaceOnUse"><path className="w-rack-mesh-line" d="M0,0 L7,7 M7,0 L0,7" /></pattern>
      </defs>
      <polygon className="w-wall-l" points={pts(O, Y, up(Y, WALL), top)} />
      <polygon className="w-wall-r" points={pts(O, X, up(X, WALL), top)} />
      <polygon className="w-skirt" points={pts(O, Y, up(Y, 3), up(O, 3))} />
      <polygon className="w-skirt" points={pts(O, X, up(X, 3), up(O, 3))} />
      <polygon className="w-wall-end" points={pts(Y, add(Y, OUT_L), up(add(Y, OUT_L), WALL), up(Y, WALL))} />
      <polygon className="w-wall-end" points={pts(X, add(X, OUT_R), up(add(X, OUT_R), WALL), up(X, WALL))} />
      <polygon className="w-wall-top" points={pts(top, up(Y, WALL), add(up(Y, WALL), OUT_L), add(top, OUT_L), up(top, -2 * OUT_L.y), add(top, OUT_R), add(up(X, WALL), OUT_R), up(X, WALL))} />
      {dc && <>
        <g transform={onX(0, h, 0)}><Tray len={h * 32} /></g>
        <g transform={onY(0, 0, 0)}><Tray len={w * 32} /></g>
      </>}
    </g>
  );
}

// A cable tray under the ceiling on its hangers, with a bundle of cables lying in it.
function Tray({ len }: { len: number }) {
  return (
    <>
      {["w-strand-a", "w-strand-b", "w-strand-c"].map((c, i) => <rect key={c} className={c} x="0" y={-WALL + 6.2 + i * 0.6} width={len} height="0.9" />)}
      <rect className="w-tray" x="0" y={-WALL + 8} width={len} height="4" />
      {Array.from({ length: Math.floor(len / 64) }, (_, i) => <rect key={i} className="w-tray" x={i * 64 + 30} y={-WALL + 2} width="1.5" height="6" />)}
    </>
  );
}

// The mesh fence around a cage between square posts, split into one panel per tile edge so each sorts with the racks beside it; the door in the near side carries a lock and a badge reader on its post.
export function cageFence(c: Cage): { depth: number; node: ReactNode }[] {
  const panel = (k: string, t: string, depth: number, door = false) => ({ depth, node: (
    <g key={k} transform={t} pointerEvents="none">
      <rect fill="url(#w-mesh)" x="0" y={-FENCE} width="32" height={FENCE} />
      <rect className="w-post" x="0" y={-FENCE} width="32" height="2" />
      <rect className="w-post" x="0" y="-3" width="32" height="1.5" />
      <rect className="w-post" x="0" y={-FENCE} width="2" height={FENCE} />
      <rect className="w-post" x="30" y={-FENCE} width="2" height={FENCE} />
      {door && <>
        <rect className="w-cage-frame" x="4" y={2 - DOOR_H - 6} width="24" height={DOOR_H + 2} />
        <rect className="w-cage-lock" x="23" y={-DOOR_H / 2 - 3} width="3" height="6" rx="0.5" />
        <rect className="w-reader" x="-6" y={-DOOR_H / 2 - 5} width="5" height="8" />
        <rect className="w-led w-led-on" x="-4.6" y={-DOOR_H / 2 - 3.5} width="2" height="1.2" />
      </>}
    </g>
  ) });
  const out = [];
  for (let x = c.x0; x <= c.x1; x++) {
    out.push(panel(`f${x}`, onY(x, c.y0, 0), x + c.y0 - 0.5));
    out.push(panel(`n${x}`, onY(x, c.y1 + 1, 0), x + c.y1 + 0.95, x === c.door));
  }
  for (let y = c.y0; y <= c.y1; y++) {
    out.push(panel(`l${y}`, onX(c.x0, y + 1, 0), c.x0 + y - 0.5));
    out.push(panel(`r${y}`, onX(c.x1 + 1, y + 1, 0), c.x1 + y + 0.95));
  }
  return out;
}

// The raised floor of a datacenter: one tone with the fine grid of its panels.
export function RaisedFloor({ w, h }: { w: number; h: number }) {
  const lines: string[] = [];
  for (let x = 0; x <= w; x += 0.5) lines.push(`M${pts(iso(x, 0))} L${pts(iso(x, h))}`);
  for (let y = 0; y <= h; y += 0.5) lines.push(`M${pts(iso(0, y))} L${pts(iso(w, y))}`);
  return (
    <g pointerEvents="none">
      <polygon className="w-raised" points={pts(iso(0, 0), iso(w, 0), iso(w, h), iso(0, h))} />
      <path className="w-raised-line" d={lines.join(" ")} />
    </g>
  );
}

// One desk along row y from column `from` to `to`, its top at DESK_Z; `under` stands between its legs.
export function Desk({ from, to, y = 0, under }: { from: number; to: number; y?: number; under?: ReactNode }) {
  const y0 = y + 0.08, y1 = y + 0.78;
  return (
    <>
      <Prism x0={from + 0.1} y0={y0 + 0.04} x1={from + 0.2} y1={y1 - 0.04} z1={DESK_Z - 3} tone="w-tone-wood-dark" />
      <Prism x0={to - 0.2} y0={y0 + 0.04} x1={to - 0.1} y1={y1 - 0.04} z1={DESK_Z - 3} tone="w-tone-wood-dark" />
      {under}
      <Prism x0={from + 0.05} y0={y0} x1={to - 0.05} y1={y1} z0={DESK_Z - 3} z1={DESK_Z} tone="w-tone-wood" />
    </>
  );
}

// Flat screen on its stand, keyboard with key rows and a mouse on desk column x, the screen facing the room.
export function Monitor({ x, y = 0 }: { x: number; y?: number }) {
  const z = DESK_Z, sy = y + 0.36, ky = y + 0.5;
  const rows = [0.04, 0.08, 0.12].map((k) => `M${pts(at3(x + 0.24, ky + k, z + 1.6))} L${pts(at3(x + 0.72, ky + k, z + 1.6))}`).join(" ");
  return (
    <>
      <Prism x0={x + 0.36} y0={y + 0.22} x1={x + 0.64} y1={y + 0.38} z0={z} z1={z + 1} tone="w-tone-pc" />
      <Prism x0={x + 0.46} y0={y + 0.28} x1={x + 0.54} y1={y + 0.32} z0={z + 1} z1={z + 7} tone="w-tone-pc" />
      <Prism x0={x + 0.12} y0={y + 0.3} x1={x + 0.88} y1={sy} z0={z + 6} z1={z + 27} tone="w-tone-pc" />
      <polygon className="w-screen" points={pts(at3(x + 0.16, sy, z + 9), at3(x + 0.84, sy, z + 9), at3(x + 0.84, sy, z + 25), at3(x + 0.16, sy, z + 25))} />
      <path className="w-glint" d={`M${pts(at3(x + 0.2, sy, z + 13))} L${pts(at3(x + 0.3, sy, z + 23))}`} />
      <rect className="w-pled" x={at3(x + 0.8, sy, z + 7.5).x} y={at3(x + 0.8, sy, z + 7.5).y} width="1.2" height="0.8" />
      <Prism x0={x + 0.2} y0={ky} x1={x + 0.76} y1={ky + 0.16} z0={z} z1={z + 1.5} tone="w-tone-paper" />
      <path className="w-keys" d={rows} />
      <Prism x0={x + 0.82} y0={ky + 0.04} x1={x + 0.9} y1={ky + 0.14} z0={z} z1={z + 1.5} tone="w-tone-paper" />
    </>
  );
}

export function Scanner({ x }: { x: number }) {
  const z = DESK_Z + 7;
  return (
    <>
      <Prism x0={x + 0.18} y0={0.14} x1={x + 0.82} y1={0.64} z0={DESK_Z} z1={z} tone="w-tone-pc" />
      <polygon className="w-lid" points={pts(at3(x + 0.27, 0.22, z), at3(x + 0.73, 0.22, z), at3(x + 0.73, 0.56, z), at3(x + 0.27, 0.56, z))} />
      <circle className="w-pled" cx={at3(x + 0.74, 0.64, z - 3).x} cy={at3(x + 0.74, 0.64, z - 3).y} r="0.7" />
    </>
  );
}

// Shelf against the left wall, open toward the room, one taped box per stored device up to four.
const SHELF_Z = [0, 21, 42, 63], BOARD = 2.5;
export function Shelf({ at, count }: { at: Pt; count: number }) {
  const x0 = 0.04, x1 = 0.48, y0 = at.y + 0.06, y1 = at.y + 0.94, tone = "w-tone-shelf";
  const crates = [0, 1, 2, 3].slice(0, Math.min(count, 4)).map((i) => ({ y: y0 + 0.08 + (i % 2) * 0.4, z: SHELF_Z[i >> 1] + BOARD }));
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x0 + 0.04} y1={y1} z1={SHELF_Z[3] + BOARD} tone={tone} />
      <Prism x0={x0} y0={y0} x1={x1} y1={y0 + 0.05} z1={SHELF_Z[3] + BOARD} tone={tone} />
      {SHELF_Z.map((z, level) => (
        <g key={z}>
          <Prism x0={x0 + 0.04} y0={y0 + 0.05} x1={x1} y1={y1 - 0.05} z0={z} z1={z + BOARD} tone={tone} />
          {crates.filter((c) => c.z === z + BOARD).map((c) => (
            <g key={`${level}-${c.y}`}>
              <Prism x0={x0 + 0.1} y0={c.y} x1={x1 - 0.04} y1={c.y + 0.32} z0={c.z} z1={c.z + 13} tone="w-tone-card" />
              <polygon className="w-tape" points={pts(at3(x0 + 0.1, c.y + 0.14, c.z + 13), at3(x1 - 0.04, c.y + 0.14, c.z + 13), at3(x1 - 0.04, c.y + 0.18, c.z + 13), at3(x0 + 0.1, c.y + 0.18, c.z + 13))} />
            </g>
          ))}
        </g>
      ))}
      <Prism x0={x0} y0={y1 - 0.05} x1={x1} y1={y1} z1={SHELF_Z[3] + BOARD} tone={tone} />
    </>
  );
}

// A cellar window high in the far wall; the fan window carries a fan in its pane. Glass dims at night.
const WIN_Z = 84, WIN_H = 20;
export function CellarWindow({ f, fan, night }: { f: Fixture; fan?: boolean; night: boolean }) {
  const glass = night ? "w-glass w-glass-night" : "w-glass";
  return (
    <g transform={wallT(f, WIN_Z)}>
      <rect className="w-reveal" x="3" y="-1" width="26" height={WIN_H + 1} />
      <rect className="w-frame" x="4" y="0" width="24" height={WIN_H} />
      <rect className={glass} x="6" y="3" width="20" height={WIN_H - 6} />
      {fan ? <Fan cx={16} cy={WIN_H / 2} r={6.2} /> : (
        <>
          <rect className="w-frame" x="15.2" y="3" width="1.6" height={WIN_H - 6} />
          <path className="w-glint" d={`M8,${WIN_H - 5} L12,5 M18,${WIN_H - 5} L21.5,6`} />
        </>
      )}
      <rect className="w-sill" x="2" y={WIN_H} width="28" height="2.5" />
    </g>
  );
}

// Window fan: square housing, grille rings and struts over four blades on a hub.
function Fan({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <rect className="w-fan-box" x={cx - r - 1.2} y={cy - r - 1.2} width={2 * r + 2.4} height={2 * r + 2.4} />
      <circle className="w-fan-hole" cx={cx} cy={cy} r={r} />
      <g className="w-fan-rotor">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} className="w-fan-blade" transform={`translate(${cx} ${cy}) rotate(${a}) scale(${r / 6})`} d="M0,0 C1.2,-2.6 4.6,-5.2 5.6,-2.4 C5.2,-0.8 2.4,0.4 0,0 Z" />
        ))}
      </g>
      <circle className="w-fan-hub" cx={cx} cy={cy} r={r * 0.22} />
      <circle className="w-fan-ring" cx={cx} cy={cy} r={r * 0.6} />
      <circle className="w-fan-ring" cx={cx} cy={cy} r={r} />
      <path className="w-fan-ring" d={`M${cx - r},${cy} H${cx + r} M${cx},${cy - r} V${cy + r}`} />
    </g>
  );
}

// Thermometer and hygrometer on the wall: a small white case with the room temperature over the outside one.
export function Hygrometer({ f, inside, outside }: { f: Fixture; inside: string; outside: string }) {
  return (
    <g transform={wallT(f, 64)}>
      <rect className="w-hygro" x="6" y="0" width="20" height="17" />
      <rect className="w-hygro-lcd" x="8" y="2" width="16" height="13" />
      <text className="w-num w-num-lcd" x="23" y="8">{inside}</text>
      <text className="w-num w-num-lcd w-num-sm" x="23" y="13.4">{outside}</text>
      <rect className="w-screw" x="15.4" y="15.6" width="1.2" height="0.8" />
    </g>
  );
}

// Breaker cabinet: grey box with screws, a meter with its counter and turning disc, three rows of breakers, the door swung open on its far hinge, and the conduit up to the ceiling and along the far wall to the racks.
const FUSE_Z = 78, FUSE_H = 46, FUSE_X = 4, FUSE_W = 24;
export function FuseBox({ f, reading, turn, w }: { f: Fixture; reading: string; turn: number; w: number }) {
  const x0 = FUSE_X, W = FUSE_W, cx = x0 + W - 5, run = WALL - 6, corner = (f.y + 1) * 32;
  return (
    <>
      <g transform={onX(0, f.y + 1, run)}>
        <rect className="w-conduit" x={cx - 1.5} y="-1.5" width="3" height={run - FUSE_Z + 1.5} />
        <rect className="w-conduit" x={cx - 1.5} y="-1.5" width={corner - cx + 1.5} height="3" />
        {Array.from({ length: Math.floor((corner - cx) / 22) }, (_, i) => <rect key={i} className="w-clip" x={cx + 8 + i * 22} y="-2" width="2" height="4" />)}
      </g>
      <g transform={onY(0, 0, run)}>
        <rect className="w-conduit" x="0" y="-1.5" width={w * 32 - 6} height="3" />
        {Array.from({ length: Math.floor(w * 32 / 24) }, (_, i) => <rect key={i} className="w-clip" x={14 + i * 24} y="-2" width="2" height="4" />)}
      </g>
      <g transform={wallT(f, FUSE_Z)}>
        <rect className="w-fuse" x={x0} y="0" width={W} height={FUSE_H} />
        <rect className="w-fuse-in" x={x0 + 2} y="2" width={W - 4} height={FUSE_H - 4} />
        <rect className="w-meter" x={x0 + 4} y="3.5" width={W - 8} height="15" />
        <rect className="w-lcd" x={x0 + 5} y="5" width={W - 10} height="6" />
        <text className="w-num w-num-xs" x={x0 + W - 5.6} y="9.3">{reading}</text>
        <rect className="w-disc-win" x={x0 + 6} y="12.5" width={W - 12} height="3.5" />
        <rect className="w-disc" x={x0 + 6.5} y="13.7" width={W - 13} height="1.1" />
        {turn > 0 && <rect className="w-disc-mark" x={x0 + 6.5} y="13.5" width="1.4" height="1.5" style={{ animationDuration: `${turn}s` }} />}
        {[22, 30.5, 39].map((y, row) => (
          <g key={y}>
            <rect className="w-rail" x={x0 + 3} y={y + 2.6} width={W - 6} height="1.2" />
            {Array.from({ length: 6 }, (_, i) => (
              <g key={i}>
                <rect className="w-breaker" x={x0 + 3.4 + i * 2.95} y={y} width="2.5" height="6.5" />
                <rect className="w-toggle" x={x0 + 4.1 + i * 2.95} y={y + (row === 2 && i > 3 ? 3.6 : 1.1)} width="1.1" height="1.8" />
              </g>
            ))}
          </g>
        ))}
        {[[x0 + 1, 1], [x0 + W - 1, 1], [x0 + 1, FUSE_H - 1], [x0 + W - 1, FUSE_H - 1]].map(([x, y]) => <circle key={`${x}-${y}`} className="w-screw" cx={x} cy={y} r="0.6" />)}
      </g>
      <g transform={plane(at3(0, f.y + 1 - (x0 + W) / 32, FUSE_Z), 0.5)}>
        <rect className="w-fuse-door" x="0" y="0" width={W * 0.6} height={FUSE_H} />
        <rect className="w-fuse-door-in" x="1.5" y="1.5" width={W * 0.6 - 3} height={FUSE_H - 3} />
        <rect className="w-plate-label" x="4" y="5" width="7" height="4" />
        <rect className="w-handle" x={W * 0.6 - 3.5} y={FUSE_H / 2 - 4} width="1.6" height="8" />
        <rect className="w-hinge" x="-0.6" y="5" width="1.2" height="4" />
        <rect className="w-hinge" x="-0.6" y={FUSE_H - 9} width="1.2" height="4" />
      </g>
    </>
  );
}

// The basement's wall socket below the fuse box: a power outlet and the phone line jack in one double plate.
export const JACK_Z = 26;
export function WallJack({ f }: { f: Fixture }) {
  return (
    <g transform={wallT(f, JACK_Z)}>
      <rect className="w-socket" x="7" y="0" width="18" height="9" />
      <rect className="w-socket-in" x="8.5" y="1.5" width="6.5" height="6" />
      <circle className="w-socket-hole" cx="10.6" cy="4.5" r="0.7" />
      <circle className="w-socket-hole" cx="12.9" cy="4.5" r="0.7" />
      <rect className="w-socket-in" x="17" y="1.5" width="6.5" height="6" />
      <rect className="w-socket-hole" x="18.6" y="3" width="3.3" height="2.6" />
    </g>
  );
}

// Flat cable ducts along the base of both far walls, broken by the doorway, with a riser up through the socket to the fuse box.
const DUCT_Z = 4, DUCT_H = 4, RISER = 16;
export function CableDuct({ w, h, door, socket }: { w: number; h: number; door?: Fixture; socket?: Fixture }) {
  const run = (x0: number, x1: number) => (
    <g key={x0}>
      <rect className="w-duct" x={x0} y="0" width={x1 - x0} height={DUCT_H} />
      <path className="w-duct-seam" d={`M${x0},1.2 L${x1},1.2`} />
    </g>
  );
  const rise = (z0: number, z1: number) => <rect key={z0} className="w-duct" x={RISER - DUCT_H / 2} y={-z1} width={DUCT_H} height={z1 - z0} />;
  // The left wall runs from the near corner (local 0) to the far one (h * 32); the door's jamb spans one tile.
  const gap = door && [(h - door.y - 1) * 32, (h - door.y) * 32];
  return (
    <>
      <g transform={onX(0, h, DUCT_Z + DUCT_H)}>{gap ? [run(0, gap[0]), run(gap[1], h * 32)] : run(0, h * 32)}</g>
      <g transform={onY(0, 0, DUCT_Z + DUCT_H)}>{run(0, w * 32)}</g>
      {socket && (
        <g transform={wallT(socket, 0)}>
          {rise(DUCT_Z + DUCT_H, JACK_Z - 9)}
          {rise(JACK_Z, FUSE_Z - FUSE_H)}
        </g>
      )}
    </>
  );
}

// Light switch at hand height just past the latch side of the door on tile f, so it takes no rack tile of its own.
export function LightSwitch({ f, on }: { f: Fixture; on: boolean }) {
  return (
    <g transform={wallT(f, 37)}>
      <rect className="w-socket" x="35" y="0" width="5" height="5" />
      <rect className="w-socket-in" x="36" y="1" width="3" height="3" />
      <rect className="w-rocker" data-on={on} x="36.5" y={on ? 1.5 : 2.5} width="2" height="1" />
    </g>
  );
}

// Gas boiler in the corner: an enamel cabinet with its control strip, flame window and label plate, pipes up to the ceiling.
export function Boiler({ f }: { f: Fixture }) {
  const x0 = f.x + 0.12, x1 = f.x + 0.8, y1 = 0.62, H = 62, len = (x1 - x0) * 32;
  return (
    <>
      <Prism x0={x0} y0={0.08} x1={x1} y1={y1} z1={H} tone="w-tone-enamel" />
      <g transform={onY(x0, y1, H)}>
        <rect className="w-plate-label" x="3" y="5" width="7" height="3" />
        <rect className="w-flame-win" x={len - 8} y="22" width="4" height="4" />
        <rect className="w-strip" x="1.5" y={H - 16} width={len - 3} height="7" />
        <circle className="w-dial" cx="5.5" cy={H - 12.5} r="1.8" />
        <circle className="w-dial" cx="11" cy={H - 12.5} r="1.8" />
        <rect className="w-pled" x={len - 6} y={H - 13.5} width="2" height="2" />
      </g>
      {[0.26, 0.44, 0.62].map((px) => (
        <Prism key={px} x0={f.x + px} y0={0.14} x1={f.x + px + 0.06} y1={0.2} z0={H} z1={WALL - 3} tone="w-tone-copper" />
      ))}
      <Prism x0={f.x + 0.22} y0={0.12} x1={f.x + 0.7} y1={0.22} z0={H + 18} z1={H + 21} tone="w-tone-pipe" />
    </>
  );
}

// Front-loading washing machine: control strip with the soap drawer and a dial, the round door with its glass.
export function Washer({ f }: { f: Fixture }) {
  const x0 = f.x + 0.1, x1 = f.x + 0.86, y1 = 0.78, H = 30, len = (x1 - x0) * 32;
  return (
    <>
      <Prism x0={x0} y0={0.08} x1={x1} y1={y1} z1={H} tone="w-tone-enamel" />
      <g transform={onY(x0, y1, H)}>
        <rect className="w-strip" x="0.8" y="0.8" width={len - 1.6} height="5" />
        <rect className="w-drawer" x="2" y="1.8" width="6" height="3" />
        <circle className="w-dial" cx={len - 4} cy="3.3" r="1.6" />
        <circle className="w-porthole" cx={len / 2} cy="17" r="8" />
        <circle className="w-port-glass" cx={len / 2} cy="17" r="5.6" />
        <path className="w-glint" d={`M${len / 2 - 3},${15} A4,4 0 0 1 ${len / 2},${12.6}`} />
      </g>
    </>
  );
}

// Folding drying rack beside the washer: a flat middle of wire rungs on crossed legs, a wing hinged down on each long side, a towel over the front wing.
const DRY_Z = 30, WING_Z = 20;
export function DryingRack({ f }: { f: Fixture }) {
  const x0 = f.x + 0.1, x1 = f.x + 0.9, mid = [0.38, 0.62], out = [0.18, 0.82];
  const line = (a: Pt, b: Pt, cls: string, key?: string | number) => <path key={key} className={cls} d={`M${pts(a)} L${pts(b)}`} />;
  // Point t of the way along a wing, from its hinge at the middle out to its free edge.
  const wing = (side: 0 | 1, t: number, x: number) => at3(x, mid[side] + (out[side] - mid[side]) * t, DRY_Z - (DRY_Z - WING_Z) * t);
  const end = (x: number) => (
    <g key={x}>
      {line(at3(x, out[0] + 0.02, 0), at3(x, mid[1], DRY_Z), "w-dry-tube")}
      {line(at3(x, out[1] - 0.02, 0), at3(x, mid[0], DRY_Z), "w-dry-tube")}
      <path className="w-dry-tube" d={`M${pts(wing(0, 1, x))} L${pts(at3(x, mid[0], DRY_Z))} L${pts(at3(x, mid[1], DRY_Z))} L${pts(wing(1, 1, x))}`} />
    </g>
  );
  const rungs = (side: 0 | 1) => [0.25, 0.5, 0.75, 1].map((t) => line(wing(side, t, x0), wing(side, t, x1), t === 1 ? "w-dry-tube" : "w-dry-wire", `${side}-${t}`));
  const tx0 = x0 + 0.14, tx1 = x0 + 0.42, drop = WING_Z - 9;
  return (
    <>
      {end(x0)}
      {rungs(0)}
      {[0, 0.06, 0.12, 0.18, 0.24].map((d) => line(at3(x0, mid[0] + d, DRY_Z), at3(x1, mid[0] + d, DRY_Z), d === 0 || d === 0.24 ? "w-dry-tube" : "w-dry-wire", d))}
      {rungs(1)}
      {end(x1)}
      <polygon className="w-towel" points={pts(wing(1, 0.1, tx0), wing(1, 0.1, tx1), wing(1, 1, tx1), at3(tx1, out[1], drop), at3(tx0, out[1], drop), wing(1, 1, tx0))} />
      <polygon className="w-towel-fold" points={pts(wing(1, 1, tx0), wing(1, 1, tx1), at3(tx1, out[1], drop), at3(tx0, out[1], drop))} />
      <polygon className="w-towel-band" points={pts(at3(tx0, out[1], drop + 3), at3(tx1, out[1], drop + 3), at3(tx1, out[1], drop + 1.8), at3(tx0, out[1], drop + 1.8))} />
    </>
  );
}

// 2005 beige tower under the desk: two drive bays, a floppy slot, the power button and its LED.
export function Tower({ x }: { x: number }) {
  const x0 = x + 0.56, x1 = x + 0.82, y1 = 0.66, H = 19;
  return (
    <>
      <Prism x0={x0} y0={0.14} x1={x1} y1={y1} z1={H} tone="w-tone-beige" />
      <g transform={onY(x0, y1, H)}>
        <rect className="w-bay" x="1" y="2" width="6.3" height="2.2" />
        <rect className="w-bay" x="1" y="5" width="6.3" height="2.2" />
        <rect className="w-bay" x="2.2" y="9" width="3.8" height="1" />
        <circle className="w-dial" cx="4.2" cy="13.5" r="1" />
        <rect className="w-pled" x="5.6" y="15.4" width="1.2" height="0.8" />
      </g>
    </>
  );
}

// A wooden crate of beer under the desk, bottle necks in two rows.
export function BeerCrate({ x }: { x: number }) {
  const x0 = x + 0.12, y0 = 0.3, H = 11;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x0 + 0.44} y1={y0 + 0.32} z1={H} tone="w-tone-wood-dark" />
      {[0.08, 0.2, 0.32].flatMap((dx) => [0.09, 0.22].map((dy) => (
        <Prism key={`${dx}-${dy}`} x0={x0 + dx} y0={y0 + dy - 0.03} x1={x0 + dx + 0.05} y1={y0 + dy + 0.02} z0={H} z1={H + 3} tone="w-tone-bottle" />
      )))}
    </>
  );
}

// Desk lamp between the scanner and the screen, its shade turned toward the keyboard; it is on at night.
export function DeskLamp({ x, on }: { x: number; on: boolean }) {
  const b = { x: x + 0.02, y: 0.16 }, foot = at3(b.x + 0.05, b.y + 0.05, DESK_Z + 2), elbow = at3(b.x + 0.04, b.y + 0.02, DESK_Z + 13), head = at3(b.x + 0.22, b.y + 0.16, DESK_Z + 15);
  return (
    <>
      <Prism x0={b.x} y0={b.y} x1={b.x + 0.1} y1={b.y + 0.1} z0={DESK_Z} z1={DESK_Z + 2} tone="w-tone-dark" />
      <path className="w-lamp-arm" d={`M${pts(foot)} L${pts(elbow)} L${pts(head)}`} />
      <path className="w-lamp-shade" d={`M${head.x - 1.5},${head.y - 2} L${head.x + 1.5},${head.y - 2} L${head.x + 4.5},${head.y + 3.5} A4.5,1.6 0 0 1 ${head.x - 4.5},${head.y + 3.5} Z`} />
      {on && <ellipse className="w-bulb" cx={head.x} cy={head.y + 4.3} rx="2.2" ry="0.6" />}
    </>
  );
}

// Office chair pushed back from the desk: five-star base on casters, gas column, seat and backrest.
export function Chair({ f }: { f: Fixture }) {
  const cx = f.x + 0.45, cy = f.y + 0.38, hub = at3(cx, cy, 3);
  const feet = [0, 1, 2, 3, 4].map((i) => at3(cx + 0.3 * Math.cos(i * 1.2566 + 0.4), cy + 0.3 * Math.sin(i * 1.2566 + 0.4), 1.2));
  return (
    <>
      {feet.map((p, i) => <path key={i} className="w-chair-leg" d={`M${pts(hub)} L${pts(p)}`} />)}
      {feet.map((p, i) => <circle key={i} className="w-caster" cx={p.x} cy={p.y + 0.8} r="1.1" />)}
      <Prism x0={cx - 0.03} y0={cy - 0.03} x1={cx + 0.03} y1={cy + 0.03} z0={3} z1={14} tone="w-tone-dark" />
      <Prism x0={cx - 0.24} y0={cy - 0.24} x1={cx + 0.24} y1={cy + 0.22} z0={14} z1={18} tone="w-tone-fabric" />
      <Prism x0={cx - 0.03} y0={cy + 0.22} x1={cx + 0.03} y1={cy + 0.27} z0={15} z1={22} tone="w-tone-dark" />
      <Prism x0={cx - 0.21} y0={cy + 0.24} x1={cx + 0.21} y1={cy + 0.31} z0={22} z1={42} tone="w-tone-fabric" />
    </>
  );
}

// Coir door mat on the floor inside the door.
export function Mat({ f }: { f: Fixture }) {
  const q = (x0: number, y0: number, x1: number, y1: number) => pts(iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1));
  return (
    <>
      <polygon className="w-mat" points={q(f.x + 0.06, f.y + 0.12, f.x + 0.62, f.y + 0.88)} />
      <polygon className="w-mat-in" points={q(f.x + 0.12, f.y + 0.2, f.x + 0.56, f.y + 0.8)} />
    </>
  );
}

// Floor drain with its slotted cover and a damp ring.
export function Drain({ f }: { f: Fixture }) {
  const c = iso(f.x + 0.5, f.y + 0.5), d = (r: number) => pts(iso(f.x + 0.5 - r, f.y + 0.5 - r), iso(f.x + 0.5 + r, f.y + 0.5 - r), iso(f.x + 0.5 + r, f.y + 0.5 + r), iso(f.x + 0.5 - r, f.y + 0.5 + r));
  return (
    <>
      <ellipse className="w-damp" cx={c.x} cy={c.y} rx="22" ry="10" />
      <polygon className="w-drain" points={d(0.16)} />
      <path className="w-drain-slot" d={[-0.08, 0, 0.08].map((k) => `M${pts(iso(f.x + 0.4, f.y + 0.5 + k))} L${pts(iso(f.x + 0.6, f.y + 0.5 + k))}`).join(" ")} />
    </>
  );
}

// Enamel ceiling lamp on its cord over the middle of the room; the bulb glows at night.
export function CeilingLamp({ f, on }: { f: Fixture; on: boolean }) {
  const top = at3(f.x + 0.5, f.y + 0.5, WALL + 80), T = at3(f.x + 0.5, f.y + 0.5, WALL - 4), B = at3(f.x + 0.5, f.y + 0.5, WALL - 12);
  return (
    <>
      <path className="w-cord" d={`M${pts(top)} L${pts(T)}`} />
      <path className="w-shade" d={`M${T.x - 2.5},${T.y} L${T.x + 2.5},${T.y} L${B.x + 11},${B.y} A11,4 0 0 1 ${B.x - 11},${B.y} Z`} />
      <ellipse className="w-shade-in" cx={B.x} cy={B.y} rx="11" ry="3" />
      <circle className={on ? "w-bulb" : "w-bulb-off"} cx={B.x} cy={B.y + 0.8} r="1.6" />
    </>
  );
}

// Faint lighter patches in the basement's raw concrete floor.
export function Concrete({ w, h }: { w: number; h: number }) {
  const spots = [[0.22, 0.3, 30], [0.6, 0.2, 20], [0.45, 0.62, 38], [0.8, 0.7, 24], [0.3, 0.85, 18]];
  return (
    <g pointerEvents="none">
      {spots.map(([x, y, r]) => { const c = iso(x * w, y * h); return <ellipse key={`${x}-${y}`} className="w-blotch" cx={c.x} cy={c.y} rx={r} ry={r / 2} />; })}
    </g>
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Hours the evening runs later and the morning earlier than in March, by month from January.
const SEASON = [-1, -0.5, 0, 0.5, 0.5, 1, 1, 0.5, 0, 0, -0.5, -1];
const ease = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
// Share of daylight at hour of day hd in month m (0 is January): full from 08:00 to 17:00 in March, fading out to 19:30 and in from 05:30.
export const daylight = (hd: number, m: number) => { const s = SEASON[m] ?? 0; return ease((hd - 5.5 + s) / 2.5) * ease((19.5 + s - hd) / 2.5); };
export const NIGHT = 0.32;
// How dark the room is drawn; lit lamps leave a quarter of the night.
export const darkness = (hd: number, m: number, lit = false) => (1 - daylight(hd, m)) * NIGHT * (lit ? 0.25 : 1);

// The whole room, walls and floor, darkens as one flat step.
export function Night({ w, h, opacity }: { w: number; h: number; opacity: number }) {
  return <polygon className="w-dark" pointerEvents="none" style={{ opacity }} points={pts(iso(0, h), up(iso(0, h), WALL), up(iso(0, 0), WALL), up(iso(w, 0), WALL), iso(w, 0), iso(w, h))} />;
}

// Waiting letters stick out of the slot, up to three, with their count beside the box.
export function Letterbox({ f, count, shown }: { f: Fixture; count: number; shown: string }) {
  return (
    <g transform={wallT(f, 52)}>
      {Array.from({ length: Math.min(count, 3) }, (_, i) => <rect key={i} className="w-letter" x={11 + i * 3} y={-5 + i} width="9" height="8" rx="0.5" />)}
      <rect className="w-brass" x="8" y="0" width="16" height="20" rx="1.5" />
      <rect className="w-slot" x="11" y="4" width="10" height="2" rx="1" />
      {count > 0 && <text className="w-num w-num-tag" data-letterbox-count x="3" y="13">{shown}</text>}
    </g>
  );
}

// A doorway in the left wall; the panel hinges at the near jamb and is skewed shut, halfway, then into the room.
// The basement has a wooden door, a datacenter a steel door with a push bar and a badge reader beside it.
export function Door({ f, open, steel }: { f: Fixture; open: number; steel: boolean }) {
  const hinge = at3(0, f.y + 0.875, 0), pw = 24, k = [-0.5, 0, 0.5][open];
  return (
    <>
      <g transform={wallT(f, DOOR_H + 6)}>
        <rect className={steel ? "w-steel-jamb" : "w-jamb"} x="0" y="0" width="32" height={DOOR_H + 6} />
        <rect className="w-doorway" x="4" y="6" width="24" height={DOOR_H} />
        {steel && <><rect className="w-reader" x="29" y={DOOR_H / 2} width="2.5" height="6" /><rect className="w-led w-led-on" x="29.5" y={DOOR_H / 2 + 1} width="1.5" height="1" /></>}
      </g>
      <g transform={plane(hinge, k)}>
        <g className={steel ? "w-steel" : undefined}>
          <rect className="w-panel" x="0" y={-DOOR_H} width={pw} height={DOOR_H} />
          {steel ? <rect className="w-panel-in" x="3" y={-DOOR_H / 2 - 2} width={pw - 6} height="2.5" /> : <>
            <rect className="w-panel-in" x="4" y={6 - DOOR_H} width={pw - 8} height={DOOR_H / 2 - 9} />
            <rect className="w-panel-in" x="4" y={-DOOR_H / 2 + 3} width={pw - 8} height={DOOR_H / 2 - 9} />
          </>}
          <rect className="w-hinge" x="0" y={8 - DOOR_H} width="1.2" height="5" />
          <rect className="w-hinge" x="0" y="-13" width="1.2" height="5" />
          <circle className="w-knob" cx={pw - 4} cy={-DOOR_H / 2} r="1.8" />
        </g>
      </g>
    </>
  );
}

// Roll-up loading-dock door in the far wall with bumpers at its foot.
export function Dock({ f }: { f: Fixture }) {
  const len = (f.w ?? 1) * 32, H = 78;
  return (
    <g transform={wallT(f, H)}>
      <rect className="w-dock-frame" x="2" y="0" width={len - 4} height={H} />
      <rect className="w-dock" x="6" y="4" width={len - 12} height={H - 4} />
      {Array.from({ length: Math.floor((H - 4) / 6) }, (_, i) => <rect key={i} className="w-dock-slat" x="6" y={9 + i * 6} width={len - 12} height="1" />)}
      <rect className="w-bumper" x="2" y={H - 12} width="5" height="12" />
      <rect className="w-bumper" x={len - 7} y={H - 12} width="5" height="12" />
    </g>
  );
}

// Floor-standing cooling unit along the far wall, a grille on its front.
export function Cooling({ f }: { f: Fixture }) {
  const x0 = f.x + 0.06, x1 = f.x + (f.w ?? 1) - 0.06, y1 = 0.7, H = 84, len = (x1 - x0) * 32;
  return (
    <>
      <Prism x0={x0} y0={0.04} x1={x1} y1={y1} z1={H} tone="w-tone-cool" />
      <g transform={onY(x0, y1, H - 8)}>
        <rect className="w-lcd" x={len - 16} y="0" width="11" height="6" rx="1" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} className="w-grille" x="4" y={10 + i * 6} width={len - 8} height="3" rx="1" />)}
      </g>
    </>
  );
}

// Floor-standing power distribution cabinet with its meter on the front.
export function Pdu({ f, reading }: { f: Fixture; reading: string }) {
  const x0 = f.x + 0.15, x1 = f.x + 0.85, y1 = f.y + 0.75, H = 58;
  return (
    <>
      <Prism x0={x0} y0={f.y + 0.25} x1={x1} y1={y1} z1={H} tone="w-tone-rack" />
      <g transform={onY(x0, y1, H - 6)}>
        <rect className="w-lcd" x="2" y="0" width="18.4" height="8" rx="1" />
        <text className="w-num w-num-sm" x="19" y="5.6">{reading}</text>
        {[0, 1, 2, 3].map((i) => <rect key={i} className="w-switch" x={3 + i * 4.4} y="14" width="2.4" height="5" rx="0.5" />)}
      </g>
    </>
  );
}

// Fire extinguisher on the floor by the wall with its sign above.
export function Extinguisher({ f }: { f: Fixture }) {
  const x0 = f.x + 0.12, y0 = f.y + 0.4;
  return (
    <>
      <g transform={wallT(f, 46)}><rect className="w-sign" x="12" y="0" width="8" height="8" rx="1" /></g>
      <Prism x0={x0} y0={y0} x1={x0 + 0.2} y1={y0 + 0.2} z1={20} tone="w-tone-red" />
      <Prism x0={x0 + 0.06} y0={y0 + 0.06} x1={x0 + 0.14} y1={y0 + 0.14} z0={20} z1={24} tone="w-tone-dark" />
    </>
  );
}

// A parcel centred on grid point (cx, cy) with its base at z, the maker's name on its label.
export function Parcel({ cx, cy, z, brand }: { cx: number; cy: number; z: number; brand: string }) {
  const x0 = cx - 0.26, x1 = cx + 0.26, y0 = cy - 0.2, y1 = cy + 0.2, z1 = z + PARCEL_H - 1;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z0={z} z1={z1} tone="w-tone-card" />
      <polygon className="w-tape" points={pts(at3(cx - 0.04, y0, z1), at3(cx + 0.04, y0, z1), at3(cx + 0.04, y1, z1), at3(cx - 0.04, y1, z1))} />
      {brand && (
        <g transform={onY(x0, y1, z1)}>
          <rect className="w-parcel-label" x="2" y="2" width="12.6" height="6" rx="0.5" />
          <text className="w-parcel-brand" x="8.3" y="6.2">{brand}</text>
        </g>
      )}
    </>
  );
}

export const rackHeight = (units: number) => Math.round(24 + units * 1.6);

// A rack is a dark box; a front facing the camera shows one LED per device, or from zoom 2 the rack front art scaled onto it. In a datacenter the face in view, front or rear, is a closed mesh door over that; a neighbour's rack is muted, its door shut on a few LEDs and a blank label plate. A share is the bottom section of a provider's cabinet of `cabinet` units.
export function RackBox({ tile, units, items, leds, zoomed, mesh, neighbour, cabinet = units }: { tile: Tile; units: number; items: RackItem[]; leds: { id: string; on: boolean; top: number }[]; zoomed: boolean; mesh?: boolean; neighbour?: boolean; cabinet?: number }) {
  const H = rackHeight(units), CH = rackHeight(cabinet), c = center(tile.x, tile.y), dx = 28, m = 1 / 16;
  const L = { x: c.x - dx, y: c.y }, B = { x: c.x, y: c.y + dx / 2 }, R = { x: c.x + dx, y: c.y };
  // The south face is the lower left, the east face the lower right; a north-facing rack shows its rear door on the south face.
  const south = { o: L, u: B.x - L.x, v: B.y - L.y }, east = { o: B, u: R.x - B.x, v: R.y - B.y };
  const front = tile.facing === "s" ? south : tile.facing === "e" ? east : null;
  const face = front ?? (mesh ? south : null);
  // Local art units onto the face, from height h down to the floor.
  const onFace = (f: typeof south, h: number, ah: number) => `matrix(${f.u / artW} ${f.v / artW} 0 ${h / ah} ${f.o.x} ${f.o.y - h})`;
  const doorH = cabinet * ART_U + 8;
  // RackFront's front view: unit numbers, rails and devices span RACK_W, the cable channel beyond it is cut off.
  const artW = RACK_W + 36, artH = units * ART_U + 8;
  const art = front && !neighbour && (zoomed ? (
    <svg width={artW} height={artH} viewBox={`0 0 ${artW} ${artH}`} preserveAspectRatio="none" overflow="hidden" pointerEvents="none">
      <RackFront units={units} items={items} w={RACK_W} u={ART_U} onDevice={() => {}} onFree={() => {}} />
    </svg>
  ) : (
    <>
      <rect x="6" y="4" width={artW - 12} height={artH - 8} rx="3" fill="var(--rack)" />
      {leds.map((d) => <rect key={d.id} className={d.on ? "w-led w-led-on" : "w-led"} x="12" y={4 + (units - d.top) * ART_U} width="10" height="5" rx="2" />)}
    </>
  ));
  const blink = (tile.x * 7 + tile.y * 3) % 5;
  return (
    <g className={neighbour ? "w-neighbour" : undefined}>
      <Prism x0={tile.x + m} y0={tile.y + m} x1={tile.x + 1 - m} y1={tile.y + 1 - m} z1={CH} tone="w-tone-rack" />
      {face && <>
        <g transform={onFace(face, CH, doorH)}>
          <rect x="6" y="4" width={artW - 12} height={doorH - 8} fill="var(--rack)" />
          {!art && mesh && front && [0, 1, 2].map((i) => <rect key={i} className={i === blink % 3 ? "w-led" : "w-led w-led-on"} x="16" y={24 + i * 34 + blink * 6} width="8" height="4" rx="2" />)}
          {/* A rear door shows the two power strips and the cable bundle behind it. */}
          {!front && [14, artW - 26].map((x) => <g key={x}>
            <rect className="w-strip" x={x} y="10" width="12" height={doorH - 20} />
            {Array.from({ length: Math.floor((doorH - 30) / 24) }, (_, i) => <rect key={i} className="w-strip-led" x={x + 4} y={18 + i * 24} width="4" height="3" />)}
          </g>)}
          {!front && <rect className="w-bundle" x={artW / 2 - 10} y="10" width="20" height={doorH - 20} />}
        </g>
        {art && <g transform={onFace(face, H, artH)}>{art}</g>}
        {mesh && (
          <g transform={onFace(face, CH, doorH)}>
            <rect className="w-rack-mesh" x="5" y="3" width={artW - 10} height={doorH - 6} fill="url(#w-rack-mesh)" />
            <rect className="w-rack-door" x="5" y="3" width={artW - 10} height={doorH - 6} />
            <rect className="w-rack-handle" x={artW - 18} y={doorH / 2 - 16} width="6" height="32" rx="1" />
            {neighbour && <rect className="w-plate-label" x={artW / 2 - 18} y="8" width="36" height="10" />}
          </g>
        )}
      </>}
    </g>
  );
}

// A two-shelf parts cart with a handle, four castors and a box on its top shelf.
export function Cart({ f }: { f: Fixture }) {
  const x0 = f.x + 0.2, x1 = f.x + 0.8, y0 = f.y + 0.3, y1 = f.y + 0.7;
  return (
    <>
      {[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => <Prism key={`${x}-${y}`} x0={x - 0.02} y0={y - 0.02} x1={x + 0.02} y1={y + 0.02} z0={3} z1={30} tone="w-tone-shelf" />)}
      {[[x0, y1], [x1, y1]].map(([x, y]) => <ellipse key={x} className="w-castor" cx={at3(x, y, 1.5).x} cy={at3(x, y, 1.5).y} rx="1.6" ry="1" />)}
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z0={8} z1={10} tone="w-tone-shelf" />
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z0={28} z1={30} tone="w-tone-shelf" />
      <Prism x0={x0 + 0.08} y0={y0 + 0.06} x1={x0 + 0.38} y1={y1 - 0.06} z0={30} z1={38} tone="w-tone-card" />
      <Prism x0={x1 - 0.02} y0={y0} x1={x1 + 0.02} y1={y1} z0={40} z1={42} tone="w-tone-shelf" />
    </>
  );
}

// Fluorescent tubes under the ceiling, one fitting over every second rack; above everything standing, so drawn last.
export function Tubes({ tiles }: { tiles: { x: number; y: number }[] }) {
  return (
    <g pointerEvents="none">
      {tiles.filter((t) => t.x % 2 === 0).map((t) => (
        <Prism key={`${t.x},${t.y}`} x0={t.x + 0.3} y0={t.y + 0.45} x1={t.x + 1.7} y1={t.y + 0.55} z0={WALL + 2} z1={WALL + 4} tone="w-tone-tube" />
      ))}
    </g>
  );
}

// The tubes' faint cool wash: a band of light along each walkway fading to the rack rows, and a cool tint over the whole room.
export function TubeLight({ w, h, ways }: { w: number; h: number; ways: { y: number; x0: number; x1: number }[] }) {
  const room = pts(iso(0, h), up(iso(0, h), WALL), up(iso(0, 0), WALL), up(iso(w, 0), WALL), iso(w, 0), iso(w, h));
  return (
    <g pointerEvents="none" className="w-light">
      <polygon className="w-cool" points={room} />
      {ways.map((a) => {
        const id = `w-wash-${a.y}`, p0 = iso(a.x0, a.y - 0.5), p1 = iso(a.x0, a.y + 1.5), y0 = Math.max(0, a.y - 0.5), y1 = Math.min(h, a.y + 1.5);
        return (
          <g key={a.y}>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}>
              <stop offset="0" stopColor="oklch(0.97 0.03 220)" stopOpacity="0" />
              <stop offset="0.5" stopColor="oklch(0.97 0.03 220)" stopOpacity="0.09" />
              <stop offset="1" stopColor="oklch(0.97 0.03 220)" stopOpacity="0" />
            </linearGradient>
            <polygon fill={`url(#${id})`} points={pts(iso(0, y0), iso(w, y0), iso(w, y1), iso(0, y1))} />
          </g>
        );
      })}
    </g>
  );
}

// The basement's metal shelf: four uprights, a board per unit from the floor up, each device lying on its board with an LED
// on its front, and the loose cables hanging behind the boards.
const SHELF_BOARDS_Z = 18, SHELF_U = 4.5;
export function ShelfUnit({ tile, units, devices }: { tile: Tile; units: number; devices: { id: string; slot: number; height: number; on: boolean }[] }) {
  const x0 = tile.x + 0.1, x1 = tile.x + 0.9, y0 = tile.y + 0.12, y1 = tile.y + 0.88, post = 0.05, tone = "w-tone-shelf";
  const zOf = (slot: number) => 3 + (slot - 1) * SHELF_BOARDS_Z, top = zOf(units) + BOARD;
  const posts = (y: number) => [x0, x1 - post].map((x) => <Prism key={`${x}-${y}`} x0={x} y0={y} x1={x + post} y1={y + post} z1={top + 2} tone={tone} />);
  const tones = ["oklch(0.7 0.15 230)", "oklch(0.8 0.15 85)", "oklch(0.3 0.01 255)", "oklch(0.6 0.02 255)"];
  const cables = tones.map((c, i) => {
    const x = x0 + 0.15 + i * 0.17, a = at3(x, y0 + 0.08, top - 4), b = at3(x + 0.05, y0 + 0.08, 2), mid = at3(x - 0.1 + (i % 2) * 0.2, y0 + 0.08, top / 2);
    return <path key={c} className="w-cable" stroke={c} d={`M${a.x} ${a.y}Q${mid.x} ${mid.y} ${b.x} ${b.y}`} />;
  });
  return (
    <>
      {posts(y0)}
      <g pointerEvents="none">{cables}</g>
      {Array.from({ length: units }, (_, k) => {
        const z = zOf(k + 1), d = devices.find((x) => x.slot === k + 1);
        const dz = d ? Math.max(1, d.height) * SHELF_U : 0, led = d && at3(x1 - 0.16, y1 - 0.06, z + BOARD + dz / 2);
        return (
          <g key={k}>
            <Prism x0={x0} y0={y0} x1={x1} y1={y1} z0={z} z1={z + BOARD} tone={tone} />
            {d && <Prism x0={x0 + 0.08} y0={y0 + 0.1} x1={x1 - 0.08} y1={y1 - 0.06} z0={z + BOARD} z1={z + BOARD + dz} tone="w-tone-rack" />}
            {led && <rect className={d.on ? "w-led w-led-on" : "w-led"} x={led.x - 2} y={led.y - 1} width="4" height="2" rx="1" />}
          </g>
        );
      })}
      {posts(y1 - post)}
    </>
  );
}
