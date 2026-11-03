import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import type { Facing, Fixture, Tile } from "../../sim/20-world/layout";
import type { Sky } from "../../sim/20-world/weather";
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

// One desk along the far wall from column `from` to `to`, its top at DESK_Z.
export function Desk({ from, to }: { from: number; to: number }) {
  const y0 = 0.08, y1 = 0.78;
  return (
    <>
      <Prism x0={from + 0.1} y0={y0 + 0.04} x1={from + 0.2} y1={y1 - 0.04} z1={DESK_Z - 3} tone="w-tone-wood-dark" />
      <Prism x0={to - 0.2} y0={y0 + 0.04} x1={to - 0.1} y1={y1 - 0.04} z1={DESK_Z - 3} tone="w-tone-wood-dark" />
      <Prism x0={from + 0.05} y0={y0} x1={to - 0.05} y1={y1} z0={DESK_Z - 3} z1={DESK_Z} tone="w-tone-wood" />
    </>
  );
}

// Monitor and keyboard on desk column x, the screen facing the room.
export function Monitor({ x }: { x: number }) {
  const z = DESK_Z, sy = 0.4;
  return (
    <>
      <Prism x0={x + 0.42} y0={0.28} x1={x + 0.58} y1={0.36} z0={z} z1={z + 6} tone="w-tone-pc" />
      <Prism x0={x + 0.12} y0={0.32} x1={x + 0.88} y1={sy} z0={z + 5} z1={z + 27} tone="w-tone-pc" />
      <polygon className="w-screen" points={pts(at3(x + 0.17, sy, z + 8), at3(x + 0.83, sy, z + 8), at3(x + 0.83, sy, z + 24), at3(x + 0.17, sy, z + 24))} />
      <Prism x0={x + 0.2} y0={0.5} x1={x + 0.8} y1={0.68} z0={z} z1={z + 1.5} tone="w-tone-paper" />
    </>
  );
}

export function Scanner({ x }: { x: number }) {
  const z = DESK_Z + 7;
  return (
    <>
      <Prism x0={x + 0.18} y0={0.14} x1={x + 0.82} y1={0.64} z0={DESK_Z} z1={z} tone="w-tone-pc" />
      <polygon className="w-lid" points={pts(at3(x + 0.27, 0.22, z), at3(x + 0.73, 0.22, z), at3(x + 0.73, 0.56, z), at3(x + 0.27, 0.56, z))} />
    </>
  );
}

// Shelf against the left wall, open toward the room, one crate per stored device up to four.
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
            <Prism key={`${level}-${c.y}`} x0={x0 + 0.1} y0={c.y} x1={x1 - 0.04} y1={c.y + 0.32} z0={c.z} z1={c.z + 13} tone="w-tone-wood" />
          ))}
        </g>
      ))}
      <Prism x0={x0} y0={y1 - 0.05} x1={x1} y1={y1} z1={SHELF_Z[3] + BOARD} tone={tone} />
    </>
  );
}

// Weather icons in an 8 by 9 box.
const Cloud = () => (
  <g className="w-cloud">
    <circle cx="3" cy="4.5" r="2" /><circle cx="5.2" cy="3.6" r="2.5" /><rect x="1" y="4.5" width="6.8" height="2.5" rx="1.25" />
  </g>
);
const Drops = ({ cls }: { cls: string }) => <>{[1.6, 4, 6.4].map((x) => <circle key={x} className={cls} cx={x} cy="8.6" r="0.7" />)}</>;
const SKY: Record<Sky, ReactNode> = {
  sun: <circle className="w-sun" cx="4" cy="4.5" r="3" />,
  partly: <><circle className="w-sun" cx="3" cy="3" r="2.4" /><g transform="translate(1 1.8)"><Cloud /></g></>,
  cloud: <g transform="translate(0 0.8)"><Cloud /></g>,
  rain: <><Cloud /><Drops cls="w-rain" /></>,
  snow: <><Cloud /><Drops cls="w-snow" /></>,
};

// The window with its fan, and below it a weather display with the outside sky and temperature over the room temperature.
export function Window({ f, sky, outside, inside }: { f: Fixture; sky: Sky; outside: string; inside: string }) {
  return (
    <>
      <g transform={wallT(f, 86)}>
        <rect className="w-frame" x="2" y="0" width="28" height="26" rx="1.5" />
        <rect className="w-glass" x="4.5" y="2.5" width="23" height="21" rx="1" />
        <circle className="w-fan" cx="16" cy="13" r="8" />
        <rect className="w-blade" x="15" y="6" width="2" height="14" rx="1" />
        <rect className="w-blade" x="9" y="12" width="14" height="2" rx="1" />
      </g>
      <g transform={wallT(f, 54)}>
        <rect className="w-lcd" x="0" y="0" width="32" height="21" rx="2" />
        <g transform="translate(2.5 2)">{SKY[sky]}</g>
        <text className="w-num" x="29.5" y="9">{outside}</text>
        <text className="w-num w-num-dim" x="29.5" y="18">{inside}</text>
      </g>
    </>
  );
}

// Breaker cabinet with its meter showing the draw.
export function FuseBox({ f, reading }: { f: Fixture; reading: string }) {
  const wid = Math.max(26, Math.round(reading.length * 4 + 8));
  return (
    <g transform={wallT(f, 68)}>
      <rect className="w-fuse" x={16 - wid / 2} y="0" width={wid} height="30" rx="2" />
      <rect className="w-lcd" x={19 - wid / 2} y="3" width={wid - 6} height="10" rx="1.5" />
      <text className="w-num" x={11 + wid / 2} y="10.5">{reading}</text>
      {[0, 1, 2].map((i) => <rect key={i} className="w-switch" x={20 - wid / 2 + i * 7} y="17" width="4" height="8" rx="1" />)}
    </g>
  );
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

// A rack is a dark box; a front facing the camera shows one LED per device, or from zoom 2 the rack front art scaled onto it.
export function RackBox({ tile, units, items, leds, zoomed }: { tile: Tile; units: number; items: RackItem[]; leds: { id: string; on: boolean; top: number }[]; zoomed: boolean }) {
  const H = Math.round(24 + units * 1.6), c = center(tile.x, tile.y), dx = 28, m = 1 / 16;
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

// Feet at 0,0, facing the lower left; legs per stride frame as left and right [x, height].
const LEGS: [number, number][][] = [[[-5, 12], [1, 12]], [[-6, 12], [2, 10]], [[-6, 10], [2, 12]]];

// Front view for the two downward facings, back view for the two upward ones, mirrored for the right-hand side; a carried parcel rides above the head.
export function Player({ at, facing, stride, carry }: { at: Pt; facing: Facing; stride: number; carry?: ReactNode }) {
  const c = center(at.x, at.y), flip = facing === "e" || facing === "n", front = facing === "s" || facing === "e";
  return (
    <g pointerEvents="none" aria-label={t("world.you")}>
      <g className="w-player" transform={`translate(${c.x} ${c.y})`}>
        <ellipse className="w-shadow" cx="0" cy="0" rx="11" ry="5.5" />
        <g transform={flip ? "scale(-1 1)" : undefined}>
          {LEGS[stride].map(([x, h], i) => <rect key={i} className="w-pants" x={x} y={-12} width="4" height={h} rx="2" />)}
          <rect className="w-skin" x="-9.5" y={carry ? -38 : -25} width="3.5" height="12" rx="1.75" />
          <rect className="w-skin" x="6" y={carry ? -38 : -25} width="3.5" height="12" rx="1.75" />
          <rect className="w-shirt" x="-7" y="-27" width="14" height="17" rx="5" />
          <circle className="w-skin" cx="0" cy="-35" r="9" />
          {front ? (
            <>
              <path className="w-hair" d="M-9.2,-35 A9.2,9.2 0 0 1 9.2,-35 Q3,-40 -9.2,-35 Z" />
              <circle className="w-eye" cx="-3.4" cy="-33" r="1" />
              <circle className="w-eye" cx="1.6" cy="-33" r="1" />
            </>
          ) : (
            <path className="w-hair" d="M-9.2,-33 A9.2,9.2 0 1 1 9.2,-33 Q0,-29 -9.2,-33 Z" />
          )}
        </g>
      </g>
      {carry}
    </g>
  );
}
