import type { ReactNode } from "react";
import type { Fixture, Tile } from "../../sim/20-world/layout";
import { RackFront, type RackItem } from "../art/RackFront";
import { center, iso, type Pt } from "./grid";

export const WALL = 96;
const DOOR_H = 64, FENCE = 72, DESK_Z = 25;
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

// The two far walls with a lit top edge and skirting; rented rooms add the cage fence and a cable tray along it.
export function Walls({ w, h, fenced }: { w: number; h: number; fenced: boolean }) {
  const O = iso(0, 0), X = iso(w, 0), Y = iso(0, h), top = up(O, WALL), OUT_L = iso(-0.25, 0), OUT_R = iso(0, -0.25);
  return (
    <g className="w-walls" pointerEvents="none">
      <defs>
        <pattern id="w-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><path className="w-mesh-line" d="M0,0 L5,5 M5,0 L0,5" /></pattern>
      </defs>
      <polygon className="w-wall-l" points={pts(O, Y, up(Y, WALL), top)} />
      <polygon className="w-wall-r" points={pts(O, X, up(X, WALL), top)} />
      <polygon className="w-skirt" points={pts(O, Y, up(Y, 3), up(O, 3))} />
      <polygon className="w-skirt" points={pts(O, X, up(X, 3), up(O, 3))} />
      <polygon className="w-wall-end" points={pts(Y, add(Y, OUT_L), up(add(Y, OUT_L), WALL), up(Y, WALL))} />
      <polygon className="w-wall-end" points={pts(X, add(X, OUT_R), up(add(X, OUT_R), WALL), up(X, WALL))} />
      <polygon className="w-wall-top" points={pts(top, up(Y, WALL), add(up(Y, WALL), OUT_L), add(top, OUT_L), up(top, -2 * OUT_L.y), add(top, OUT_R), add(up(X, WALL), OUT_R), up(X, WALL))} />
      {fenced && <>
        <g transform={onX(0, h, 0)}><Fence len={h * 32} /></g>
        <g transform={onY(0, 0, 0)}><Fence len={w * 32} /></g>
      </>}
    </g>
  );
}

function Fence({ len }: { len: number }) {
  return (
    <>
      <rect className="w-tray" x="0" y={-WALL + 8} width={len} height="4" />
      {Array.from({ length: Math.floor(len / 64) }, (_, i) => <rect key={i} className="w-tray" x={i * 64 + 30} y={-WALL + 12} width="2" height="6" />)}
      <rect fill="url(#w-mesh)" x="0" y={-FENCE} width={len} height={FENCE} />
      <rect className="w-post" x="0" y={-FENCE} width={len} height="2" />
      {Array.from({ length: len / 32 + 1 }, (_, i) => <rect key={i} className="w-post" x={Math.min(i * 32, len - 2)} y={-FENCE} width="2" height={FENCE} />)}
    </>
  );
}

// The raised floor's grated panels along a cold aisle, a lighter tone with a fine grid.
export function Grate({ y, x0, x1 }: { y: number; x0: number; x1: number }) {
  const lines: string[] = [];
  for (let k = 1; k < 4; k++) lines.push(`M${pts(iso(x0, y + k / 4))} L${pts(iso(x1 + 1, y + k / 4))}`);
  for (let x = x0; x <= x1 + 1; x += 0.25) lines.push(`M${pts(iso(x, y))} L${pts(iso(x, y + 1))}`);
  return (
    <g pointerEvents="none">
      <polygon className="w-grate" points={pts(iso(x0, y), iso(x1 + 1, y), iso(x1 + 1, y + 1), iso(x0, y + 1))} />
      <path className="w-grate-line" d={lines.join(" ")} />
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
export function LightSwitch({ f }: { f: Fixture }) {
  return (
    <g transform={wallT(f, 37)}>
      <rect className="w-socket" x="35" y="0" width="5" height="5" />
      <rect className="w-socket-in" x="36" y="1" width="3" height="3" />
      <rect className="w-rocker" x="36.5" y="1.5" width="2" height="1" />
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

// Drying rack beside the washer with a towel, a shirt and socks on its rails.
export function DryingRack({ f }: { f: Fixture }) {
  const x0 = f.x + 0.12, len = 24, H = 34;
  return (
    <>
      <Prism x0={x0} y0={0.18} x1={x0 + 0.04} y1={0.74} z1={2} tone="w-tone-pipe" />
      <Prism x0={x0 + 0.71} y0={0.18} x1={x0 + 0.75} y1={0.74} z1={2} tone="w-tone-pipe" />
      <g transform={onY(x0, 0.46, H)}>
        <rect className="w-rail-post" x="0" y="0" width="1.2" height={H} />
        <rect className="w-rail-post" x={len - 1.2} y="0" width="1.2" height={H} />
        {[0, 4, 8, 12].map((y) => <rect key={y} className="w-rail-bar" x="0" y={y} width={len} height="0.8" />)}
        <rect className="w-towel" x="2.5" y="0.4" width="8" height="16" />
        <rect className="w-towel-band" x="2.5" y="13" width="8" height="1.2" />
        <path className="w-shirt" d="M12.5,4.4 h8 l2,3 -1.8,1 -0.8,-1 v9 h-6.8 v-9 l-0.8,1 -1.8,-1 Z" />
        <rect className="w-sock" x="14" y="12.4" width="2" height="6" />
        <rect className="w-sock" x="17.5" y="12.4" width="2" height="5" />
      </g>
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
  const b = { x: x + 0.02, y: 0.16 }, foot = at3(b.x + 0.05, b.y + 0.05, DESK_Z + 2), elbow = at3(b.x + 0.04, b.y + 0.02, DESK_Z + 24), head = at3(b.x + 0.22, b.y + 0.16, DESK_Z + 26);
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
// Share of daylight at hour of day hd: none at night, full from mid-morning to early evening.
export const daylight = (hd: number) => clamp01((hd - 6) / 1.5) * clamp01((20.5 - hd) / 1.5);

// At night the whole room, walls and floor, is one flat step darker.
export function Night({ w, h }: { w: number; h: number }) {
  return <polygon className="w-dark" pointerEvents="none" points={pts(iso(0, h), up(iso(0, h), WALL), up(iso(0, 0), WALL), up(iso(w, 0), WALL), iso(w, 0), iso(w, h))} />;
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
// The basement has a wooden door, rented rooms a cage door of mesh in a metal frame.
export function Door({ f, open, cage }: { f: Fixture; open: number; cage: boolean }) {
  const hinge = at3(0, f.y + 0.875, 0), pw = 24, k = [-0.5, 0, 0.5][open];
  return (
    <>
      <g transform={wallT(f, DOOR_H + 6)}>
        <rect className={cage ? "w-cage-jamb" : "w-jamb"} x="0" y="0" width="32" height={DOOR_H + 6} />
        <rect className="w-doorway" x="4" y="6" width="24" height={DOOR_H} />
      </g>
      <g transform={plane(hinge, k)}>
        {cage ? (
          <>
            <rect fill="url(#w-mesh)" x="0" y={-DOOR_H} width={pw} height={DOOR_H} />
            <rect className="w-cage-frame" x="1" y={1 - DOOR_H} width={pw - 2} height={DOOR_H - 2} />
            <rect className="w-cage-lock" x={pw - 5} y={-DOOR_H / 2 - 3} width="3" height="6" rx="0.5" />
          </>
        ) : (
          <>
            <rect className="w-panel" x="0" y={-DOOR_H} width={pw} height={DOOR_H} />
            <rect className="w-panel-in" x="4" y={6 - DOOR_H} width={pw - 8} height={DOOR_H / 2 - 9} />
            <rect className="w-panel-in" x="4" y={-DOOR_H / 2 + 3} width={pw - 8} height={DOOR_H / 2 - 9} />
            <rect className="w-hinge" x="0" y={8 - DOOR_H} width="1.2" height="5" />
            <rect className="w-hinge" x="0" y="-13" width="1.2" height="5" />
            <circle className="w-knob" cx={pw - 4} cy={-DOOR_H / 2} r="1.8" />
          </>
        )}
      </g>
    </>
  );
}

// Patch panel on the far wall with a few cables, and the carriers on site on a plate beside it.
export function CrossConnect({ f, carriers }: { f: Fixture; carriers: string[] }) {
  const len = (f.w ?? 1) * 32;
  return (
    <g transform={wallT(f, 84)}>
      <rect className="w-xc" x="4" y="0" width={len - 8} height="30" rx="1.5" />
      {[0, 1, 2].map((r) => Array.from({ length: Math.floor((len - 16) / 5) }, (_, i) => (
        <rect key={`${r}-${i}`} className="w-port" x={8 + i * 5} y={4 + r * 8} width="3" height="3" />
      )))}
      <path className="w-cable w-cable-a" d={`M10,8 C12,20 22,22 24,16`} />
      <path className="w-cable w-cable-b" d={`M30,8 C30,26 44,26 44,24`} />
      {carriers.length > 0 && (
        <g transform={`translate(${len + 2} 0)`}>
          <rect className="w-plate" width="42" height={carriers.length * 7 + 3} rx="1.5" />
          {carriers.map((c, i) => <text key={c} className="w-carrier" x="3" y={7 + i * 7}>{c}</text>)}
        </g>
      )}
    </g>
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

// A rack is a dark box; a front facing the camera shows one LED per device, or from zoom 2 the rack front art scaled onto it.
export function RackBox({ tile, units, items, leds, zoomed }: { tile: Tile; units: number; items: RackItem[]; leds: { id: string; on: boolean; top: number }[]; zoomed: boolean }) {
  const H = rackHeight(units), c = center(tile.x, tile.y), dx = 28, m = 1 / 16;
  const L = { x: c.x - dx, y: c.y }, B = { x: c.x, y: c.y + dx / 2 }, R = { x: c.x + dx, y: c.y };
  // Only a front facing the camera shows: the south face is the lower left, the east face the lower right.
  const face = tile.facing === "s" ? { o: up(L, H), u: B.x - L.x, v: B.y - L.y } : tile.facing === "e" ? { o: up(B, H), u: R.x - B.x, v: R.y - B.y } : null;
  // RackFront's front view: unit numbers, rails and devices span RACK_W, the cable channel beyond it is cut off.
  const artW = RACK_W + 36, artH = units * ART_U + 8;
  return (
    <>
      <Prism x0={tile.x + m} y0={tile.y + m} x1={tile.x + 1 - m} y1={tile.y + 1 - m} z1={H} tone="w-tone-rack" />
      {face && (
        <g transform={`matrix(${face.u / artW} ${face.v / artW} 0 ${H / artH} ${face.o.x} ${face.o.y})`}>
          {zoomed ? (
            <svg width={artW} height={artH} viewBox={`0 0 ${artW} ${artH}`} preserveAspectRatio="none" overflow="hidden" pointerEvents="none">
              <RackFront units={units} items={items} w={RACK_W} u={ART_U} onDevice={() => {}} onFree={() => {}} />
            </svg>
          ) : (
            <>
              <rect x="6" y="4" width={artW - 12} height={artH - 8} rx="3" fill="var(--rack)" />
              {leds.map((d) => <rect key={d.id} className={d.on ? "w-led w-led-on" : "w-led"} x="12" y={4 + (units - d.top) * ART_U} width="10" height="5" rx="2" />)}
            </>
          )}
        </g>
      )}
    </>
  );
}
