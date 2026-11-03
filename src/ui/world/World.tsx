import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { FIXTURES, rackTiles, roomSize, type Facing, type Tile } from "../../sim/20-world/layout";
import { rackUnits } from "../../sim/20-world/datacenters";
import { sky, temperature, type Sky } from "../../sim/20-world/weather";
import { modelById } from "../../sim/10-catalog/hardware";
import { inbox } from "../../sim/40-support/letters";
import { powerByLocation } from "../../sim/88-tick/tick";
import { roomTemperature } from "../../sim/60-infra/sensors";
import type { GameState, Location, Rack } from "../../sim/50-state";
import { Defs } from "../art/fronts";
import { RackFront } from "../art/RackFront";
import { rackItems } from "../apps/locations/RackView";
import { useStore } from "../store";
import { center, facingOf, iso, key, pathTo, useTiles, type Pt } from "./iso";
import "./world.css";

const WALL = 96, DOOR_H = 64, STEP_MS = 400, BLINK_MS = 500, FLASH_MS = 120, ZOOM_MAX = 4;
// Rack art is drawn 110 wide with 10 per unit, about a 19-inch front.
const RACK_W = 110, ART_U = 10;
const SOLID = ["desk", "pc", "scanner", "shelf"];
// A quarter tile of wall thickness, outward from the far-left and the far-right wall.
const OUT_L: Pt = iso(-0.25, 0), OUT_R: Pt = iso(0, -0.25);
const ART = `${import.meta.env.BASE_URL}world/`;
// Arrow keys and WASD step along the grid: up is away from the camera to the upper right.
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
// Where the player stood per location, so the room resumes there.
const stood: Record<string, Pt> = {};

const pts = (...p: Pt[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });
const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const dpr = () => (typeof window !== "undefined" && window.devicePixelRatio) || 1;
// Rounds to whole device pixels at zoom z.
const snap = (v: number, z: number) => Math.round(v * z * dpr()) / (z * dpr());

export const roomOf = (game: GameState): Location =>
  game.locations.find((l) => l.id === game.player.at) ?? game.locations.find((l) => l.space === "basement") ?? game.locations[0];

export function World() {
  const game = useStore((s) => s.game), setSurface = useStore((s) => s.setSurface), openApp = useStore((s) => s.openApp);
  const loc = roomOf(game), home = loc.space === "basement";
  const { w, h } = roomSize(loc);
  const tiles = useMemo(() => rackTiles(loc, game.racks), [loc, game.racks]);
  const racks = game.racks.filter((r) => tiles[r.id]);
  const blocked = useMemo(() => new Set([
    ...(home ? SOLID.map((id) => key(FIXTURES[id].x, FIXTURES[id].y)) : []),
    ...Object.values(tiles).map((p) => key(p.x, p.y)),
  ]), [tiles, home]);
  const grid = useRef({ w, h, blocked });
  grid.current = { w, h, blocked };

  const start = stood[loc.id] ?? (home ? { x: FIXTURES.pc.x, y: FIXTURES.pc.y + 1 } : { x: Math.floor(w / 2), y: h - 2 });
  const [pos, setPos] = useState<Pt>(start);
  const [facing, setFacing] = useState<Facing>("s");
  const [stride, setStride] = useState(0);
  const [door, setDoor] = useState(0);
  const [hover, setHover] = useState<Pt | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const at = useRef<Pt>(start), path = useRef<Pt[]>([]), then = useRef<(() => void) | null>(null), held = useRef<string[]>([]), tap = useRef<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // The default view fits the room; zoom steps are whole device pixels, so pixels stay square.
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [zoomSet, setZoom] = useState<number | null>(null);
  const [org, setOrg] = useState<Pt | null>(null);
  const box = { x: iso(0, h).x + OUT_L.x, y: -WALL + OUT_L.y - 8, w: (w + h) * 32 - 2 * OUT_L.x, h: (w + h) * 16 + WALL - OUT_L.y + 8 };
  const fit = Math.max(1 / dpr(), Math.floor(Math.min(size.w * 0.94 / box.w, size.h * 0.94 / box.h) * dpr()) / dpr());
  const zoom = zoomSet ?? fit;
  const o = org ?? { x: snap(box.x + box.w / 2 - size.w / 2 / zoom, zoom), y: snap(box.y + box.h / 2 - size.h / 2 / zoom, zoom) };
  const view = useRef({ zoom, o, fit });
  view.current = { zoom, o, fit };
  const zoomed = zoom >= 1.5;

  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; if (r.width) setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Walking, held keys, the leg frames and LED blink share one frame loop.
  useEffect(() => {
    let raf = 0, blinkAt = 0, t0 = 0, from = at.current;
    const frame = (now: number) => {
      if (now - blinkAt > BLINK_MS) { blinkAt = now; svg.current?.classList.toggle("w-blink"); }
      // A tap shorter than a frame still makes one step.
      const pressed = held.current[held.current.length - 1] ?? tap.current, dir = pressed ? KEYS[pressed] : null;
      if (!path.current.length && dir) {
        tap.current = null;
        const { w, h, blocked } = grid.current, n = { x: at.current.x + dir[0], y: at.current.y + dir[1] };
        if (n.x >= 0 && n.y >= 0 && n.x < w && n.y < h && !blocked.has(key(n.x, n.y))) path.current = [n];
        else setFacing(facingOf(dir[0], dir[1]));
      }
      const next = path.current[0];
      if (next) {
        if (!t0) { t0 = now; from = at.current; setFacing(facingOf(next.x - from.x, next.y - from.y)); }
        const k = Math.min(1, (now - t0) / STEP_MS);
        setPos(lerp(from, next, k));
        setStride(k < 0.5 ? 1 : 2);
        if (k === 1) {
          at.current = next; path.current.shift(); t0 = 0;
          if (!path.current.length) {
            if (!held.current.length) setStride(0);
            const run = then.current; then.current = null; run?.();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); stood[loc.id] = at.current; };
  }, [loc.id]);

  useEffect(() => {
    const busy = (e: KeyboardEvent) =>
      e.metaKey || e.ctrlKey || e.altKey || !!(e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || !!document.querySelector("[role=dialog], [role=alertdialog], [role=menu]");
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy(e)) { setSurface("desktop"); return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!KEYS[k] || busy(e)) return;
      e.preventDefault();
      then.current = null;
      if (!held.current.includes(k)) held.current.push(k);
      tap.current = k;
    };
    const release = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      held.current = held.current.filter((x) => x !== k);
    };
    const clear = () => { held.current = []; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", release); window.removeEventListener("blur", clear); };
  }, [setSurface]);

  // Wheel steps the zoom by one device pixel per art pixel around the pointer; small trackpad deltas add up to a step.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let acc = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      const { zoom: z0, o, fit } = view.current, step = 1 / dpr();
      const z1 = Math.min(ZOOM_MAX, Math.max(Math.min(fit, 1), Math.round((z0 + (acc < 0 ? step : -step)) / step) * step));
      acc = 0;
      if (z1 === z0) return;
      const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      setZoom(z1);
      setOrg({ x: snap(o.x + sx / z0 - sx / z1, z1), y: snap(o.y + sy / z0 - sy / z1, z1) });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // Drag pans; a press that moved is no click.
  const drag = useRef<{ x: number; y: number; o: Pt } | null>(null), dragged = useRef(false);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, o }; dragged.current = false; };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) return;
    dragged.current = true;
    setOrg({ x: snap(d.o.x - dx / zoom, zoom), y: snap(d.o.y - dy / zoom, zoom) });
  };

  const walk = (targets: Pt[], run?: () => void) => {
    const cur = path.current[0], from = cur ?? at.current;
    const p = pathTo(from, targets, w, h, blocked);
    if (!p) return;
    path.current = cur ? [cur, ...p] : p;
    then.current = run ?? null;
    if (!path.current.length) { then.current = null; run?.(); }
  };
  const click = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); if (!dragged.current) fn(); };
  const use = (id: string, tile: Pt, run: () => void) => click(() => {
    setLit(id);
    setTimeout(() => setLit((v) => (v === id ? null : v)), FLASH_MS);
    walk(useTiles(tile, blocked), () => {
      const dx = tile.x - at.current.x, dy = tile.y - at.current.y;
      if (dx || dy) setFacing(facingOf(dx, dy));
      run();
    });
  });

  const power = useMemo(() => (powerByLocation(game)[loc.id]?.kwh ?? 0) * 1000, [game, loc.id]);
  const unread = inbox(game).filter((l) => !l.read).length;
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId).length;
  const n = (v: number, digits = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  // Depth-sorted things standing on the floor.
  const things: { depth: number; node: ReactNode }[] = racks.map((r) => ({
    depth: tiles[r.id].x + tiles[r.id].y,
    node: <RackBox key={r.id} rack={r} tile={tiles[r.id]} game={game} zoomed={zoomed} lit={lit === r.id} onClick={use(r.id, tiles[r.id], () => openApp("Locations", { kind: "rack", id: r.id }))} />,
  }));
  if (home) {
    const f = FIXTURES, desk = (id: string, label: string, run: () => void, art: ReactNode) => ({
      depth: f[id].x + f[id].y,
      node: <Desk key={id} at={f[id]} label={label} lit={lit === id} onClick={use(id, f[id], run)}>{art}</Desk>,
    });
    things.push(
      desk("scanner", t("world.obj.scanner"), () => openApp("DocuWhere"), <Scanner />),
      desk("desk", t("world.obj.desk"), () => {}, <Keyboard />),
      desk("pc", t("world.obj.pc"), () => setSurface("desktop"), <Pc />),
      { depth: f.shelf.x + f.shelf.y, node: <Shelf key="shelf" at={f.shelf} count={stored} label={t("world.obj.shelf")} lit={lit === "shelf"} onClick={use("shelf", f.shelf, () => openApp("Locations", { kind: "storage", id: loc.id }))} /> },
    );
  }
  things.push({ depth: pos.x + pos.y + 0.01, node: <Player key="player" at={pos} facing={facing} stride={stride} /> });
  things.sort((a, b) => a.depth - b.depth);

  const O = iso(0, 0), X = iso(w, 0), Y = iso(0, h), top = up(O, WALL);
  const openDoor = () => {
    setDoor(1);
    setTimeout(() => setDoor(2), 150);
    setTimeout(() => openApp("Weather"), 700);
  };

  return (
    <div className="world" aria-label={loc.name}>
      <svg ref={svg} className="world-svg" viewBox={`${o.x} ${o.y} ${size.w / zoom} ${size.h / zoom}`} preserveAspectRatio="xMinYMin meet" shapeRendering="crispEdges"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; setHover(null); }}>
        <Defs />
        <g className="w-walls">
          <polygon className="w-wall-l" points={pts(O, Y, up(Y, WALL), top)} />
          <polygon className="w-wall-r" points={pts(O, X, up(X, WALL), top)} />
          <polygon className="w-skirt" points={pts(O, Y, up(Y, 4), up(O, 4))} />
          <polygon className="w-skirt" points={pts(O, X, up(X, 4), up(O, 4))} />
          <polygon className="w-wall-end-l" points={pts(Y, add(Y, OUT_L), up(add(Y, OUT_L), WALL), up(Y, WALL))} />
          <polygon className="w-wall-end-r" points={pts(X, add(X, OUT_R), up(add(X, OUT_R), WALL), up(X, WALL))} />
          <polygon className="w-wall-top" points={pts(top, up(Y, WALL), add(up(Y, WALL), OUT_L), add(top, OUT_L), up(top, -2 * OUT_L.y), add(top, OUT_R), add(up(X, WALL), OUT_R), up(X, WALL))} />
        </g>
        {home && <Window at={FIXTURES.fan} sky={sky(loc.city, game.hour)} outside={`${n(temperature(loc.city, game.hour))}°C`} inside={`${n(roomTemperature(game, loc), 1)}°C`} />}
        {home && <FuseBox at={FIXTURES.fusebox} reading={`${n(power)}W`} />}
        {home && <Letterbox at={FIXTURES.letterbox} count={unread} label={t("world.obj.letterbox")} lit={lit === "letterbox"} onClick={use("letterbox", FIXTURES.letterbox, () => openApp("Post"))} />}
        {Array.from({ length: w * h }, (_, i) => {
          const x = i % w, y = Math.floor(i / w), p = iso(x, y);
          return <image key={`f${i}`} className="w-sprite" href={`${ART}floor.png`} x={p.x - 32} y={p.y} width="64" height="32" />;
        })}
        {Array.from({ length: w * h }, (_, i) => {
          const x = i % w, y = Math.floor(i / w);
          return <polygon key={i} className={`w-tile${(x + y) % 2 ? " w-tile-b" : ""}`} points={pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1))}
            onPointerEnter={() => setHover({ x, y })} onClick={click(() => walk([{ x, y }]))} />;
        })}
        {hover && <polygon className="w-cursor" points={pts(iso(hover.x, hover.y), iso(hover.x + 1, hover.y), iso(hover.x + 1, hover.y + 1), iso(hover.x, hover.y + 1))} />}
        {home && <Door at={FIXTURES.door} open={door} label={t("world.obj.door")} lit={lit === "door"} onClick={use("door", FIXTURES.door, openDoor)} />}
        {things.map((x) => x.node)}
      </svg>
    </div>
  );
}

type Click = (e: MouseEvent) => void;

// Footprint corners of a tile around its centre; dx is the even half-width in pixels.
function corners(tile: Pt, dx = 28) {
  const c = center(tile.x, tile.y);
  return { c, L: { x: c.x - dx, y: c.y }, B: { x: c.x, y: c.y + dx / 2 }, R: { x: c.x + dx, y: c.y }, T: { x: c.x, y: c.y - dx / 2 } };
}

// Three flat faces in the tones of its class, then the silhouette outline on top.
function Box({ tile, height, dx, tone }: { tile: Pt; height: number; dx?: number; tone: string }) {
  const { L, B, R, T } = corners(tile, dx);
  return (
    <g className={`w-box ${tone}`}>
      <polygon className="w-face-l" points={pts(L, B, up(B, height), up(L, height))} />
      <polygon className="w-face-r" points={pts(B, R, up(R, height), up(B, height))} />
      <polygon className="w-face-t" points={pts(up(T, height), up(R, height), up(B, height), up(L, height))} />
      <polygon className="w-edge" points={pts(L, B, R, up(R, height), up(T, height), up(L, height))} />
    </g>
  );
}

function RackBox({ rack, tile, game, zoomed, lit, onClick }: { rack: Rack; tile: Tile; game: GameState; zoomed: boolean; lit: boolean; onClick: Click }) {
  const units = rackUnits(rack.model), H = Math.round(24 + units * 1.6), { L, B, R } = corners(tile);
  // Only a front facing the camera shows: the south face is the lower left, the east face the lower right.
  const face = tile.facing === "s" ? { o: up(L, H), u: B.x - L.x, v: B.y - L.y } : tile.facing === "e" ? { o: up(B, H), u: R.x - B.x, v: R.y - B.y } : null;
  // RackFront's front view: unit numbers, rails and devices span RACK_W, the cable channel beyond it is cut off.
  const artW = RACK_W + 36, artH = units * ART_U + 8;
  return (
    <g className={`w-obj w-rack${lit ? " w-lit" : ""}`} data-rack={rack.id} role="button" aria-label={rack.name} onClick={onClick}>
      <Box tile={tile} height={H} tone="w-tone-rack" />
      {face && (
        <g transform={`matrix(${face.u / artW} ${face.v / artW} 0 ${H / artH} ${face.o.x} ${face.o.y})`}>
          {zoomed ? (
            <svg width={artW} height={artH} viewBox={`0 0 ${artW} ${artH}`} preserveAspectRatio="none" overflow="hidden" pointerEvents="none" shapeRendering="auto">
              <RackFront units={units} items={rackItems(game, rack.id)} w={RACK_W} u={ART_U} onDevice={() => {}} onFree={() => {}} />
            </svg>
          ) : (
            <>
              <rect x="4" y="2" width={artW - 8} height={artH - 4} fill="var(--rack)" />
              {game.devices.filter((d) => d.rackId === rack.id && !d.chassisId).map((d) => (
                <rect key={d.id} className={d.on ? "w-led w-led-on" : "w-led"} x="10" y={4 + (units - d.slot - modelById(d.model).height + 1) * ART_U} width="10" height="5" />
              ))}
            </>
          )}
        </g>
      )}
    </g>
  );
}

// One table sprite per desk tile, its items around the table top's centre.
function Desk({ at, label, lit, onClick, children }: { at: Pt; label: string; lit: boolean; onClick: Click; children: ReactNode }) {
  const { c } = corners(at);
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <image className="w-sprite" href={`${ART}table.png`} x={c.x - 28} y={c.y - 28} width="56" height="42" />
      <g transform={`translate(${c.x} ${c.y - 18})`}>{children}</g>
    </g>
  );
}

// Faces as [points, class] pairs with one outline around them, drawn at twice the coordinates given.
const dbl = (p: string) => p.replace(/-?\d+/g, (v) => String(Number(v) * 2));
const Solid = ({ faces, edge }: { faces: [string, string][]; edge: string }) => (
  <>
    {faces.map(([p, cls]) => <polygon key={p} className={cls} points={dbl(p)} />)}
    <polygon className="w-edge" points={dbl(edge)} />
  </>
);

// The screen faces the room's lower left.
const Pc = () => (
  <g className="w-box w-tone-pc">
    <Solid edge="-6,-3 4,2 8,0 8,-12 -2,-17 -6,-15" faces={[
      ["-6,-3 4,2 4,-10 -6,-15", "w-face-l"],
      ["4,2 8,0 8,-12 4,-10", "w-face-r"],
      ["-6,-15 4,-10 8,-12 -2,-17", "w-face-t"],
      ["-5,-5 3,-1 3,-9 -5,-13", "w-screen"],
    ]} />
  </g>
);
const Scanner = () => (
  <g className="w-box w-tone-paper">
    <Solid edge="-8,0 0,-4 8,0 8,3 0,7 -8,3" faces={[
      ["-8,0 0,4 0,7 -8,3", "w-face-l"],
      ["0,4 8,0 8,3 0,7", "w-face-r"],
      ["-8,0 0,-4 8,0 0,4", "w-face-t"],
    ]} />
  </g>
);
const Keyboard = () => (
  <g className="w-box w-tone-paper">
    <Solid edge="-6,1 4,6 0,8 -10,3" faces={[["-6,1 4,6 0,8 -10,3", "w-face-t"]]} />
  </g>
);

// The shelf sprite against the wall, turned to face the room, with one crate per stored device in front, up to four.
const CRATES: Pt[] = [{ x: 14, y: 2 }, { x: 0, y: 9 }, { x: 14, y: -16 }, { x: 0, y: -9 }];
function Shelf({ at, count, label, lit, onClick }: { at: Pt; count: number; label: string; lit: boolean; onClick: Click }) {
  const { c } = corners(at);
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <image className="w-sprite" href={`${ART}shelf.png`} x={-(c.x - 20 + 32)} y={c.y - 58} width="32" height="57" transform="scale(-1 1)" />
      {CRATES.slice(0, Math.min(count, CRATES.length)).map((p, i) => (
        <image key={i} className="w-sprite" href={`${ART}crate.png`} x={c.x + p.x - 16} y={c.y + p.y - 24} width="32" height="32" />
      ))}
    </g>
  );
}

// A point on the far wall behind fixture tile f, u along the tile toward the near end and z above the floor.
const wallAt = (f: Pt, u: number, z: number): Pt => up(f.x === 0 ? iso(0, f.y + u) : iso(f.x + u, 0), z);

// Flat drawing on the wall plane: local x runs left to right across u0..u1, local y down from height z.
function OnWall({ f, u0, u1, z, children }: { f: Pt; u0: number; u1: number; z: number; children: ReactNode }) {
  const left = f.x === 0 ? wallAt(f, u1, z) : wallAt(f, u0, z), k = f.x === 0 ? -0.5 : 0.5;
  return <g transform={`matrix(1 ${k} 0 1 ${left.x} ${left.y})`}>{children}</g>;
}

// 3 by 5 pixel glyphs, read row by row.
const GLYPHS: Record<string, string> = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  "-": "000000111000000", ".": "000000000000010", ",": "000000000010100", "°": "010101010000000", C: "111100100100111", W: "101101111111101",
};
const textWidth = (s: string) => [...s].filter((ch) => GLYPHS[ch]).length * 4 - 1;
function PixelText({ x, y, text, className }: { x: number; y: number; text: string; className: string }) {
  const rects: ReactNode[] = [];
  [...text].filter((ch) => GLYPHS[ch]).forEach((ch, i) => {
    [...GLYPHS[ch]].forEach((bit, j) => {
      if (bit === "1") rects.push(<rect key={`${i}-${j}`} x={x + i * 4 + (j % 3)} y={y + Math.floor(j / 3)} width="1" height="1" />);
    });
  });
  return <g className={className}>{rects}</g>;
}

// 7 by 7 pixel weather icons as x, y, width, height and class.
const SKY: Record<Sky, [number, number, number, number, string][]> = {
  sun: [[2, 0, 3, 1, "w-sun"], [1, 1, 5, 5, "w-sun"], [0, 2, 7, 3, "w-sun"], [2, 6, 3, 1, "w-sun"]],
  partly: [[0, 0, 4, 4, "w-sun"], [3, 3, 3, 1, "w-cloud"], [1, 4, 6, 2, "w-cloud"]],
  cloud: [[2, 1, 3, 1, "w-cloud"], [0, 2, 7, 3, "w-cloud"]],
  rain: [[2, 0, 3, 1, "w-cloud"], [0, 1, 7, 3, "w-cloud"], [1, 5, 1, 1, "w-rain"], [3, 6, 1, 1, "w-rain"], [5, 5, 1, 1, "w-rain"]],
  snow: [[2, 0, 3, 1, "w-cloud"], [0, 1, 7, 3, "w-cloud"], [1, 5, 1, 1, "w-snow"], [3, 6, 1, 1, "w-snow"], [5, 5, 1, 1, "w-snow"]],
};

// The window with its fan, and below it a weather display with the outside sky and temperature over the room temperature.
function Window({ at, sky, outside, inside }: { at: Pt; sky: Sky; outside: string; inside: string }) {
  return (
    <g aria-label={t("world.obj.fan")}>
      <OnWall f={at} u0={0.0625} u1={0.9375} z={86}>
        <rect className="w-frame" x="0" y="0" width="28" height="26" />
        <rect className="w-glass" x="3" y="3" width="22" height="20" />
        <rect className="w-blade" x="13" y="5" width="2" height="16" />
        <rect className="w-blade" x="6" y="12" width="16" height="2" />
      </OnWall>
      <OnWall f={at} u0={0.0625} u1={0.9375} z={52}>
        <rect className="w-lcd" x="0" y="0" width="28" height="20" />
        <g transform="translate(2 2)">{SKY[sky].map(([x, y, w, h, c], i) => <rect key={i} className={c} x={x} y={y} width={w} height={h} />)}</g>
        <PixelText className="w-digits" x={26 - textWidth(outside)} y={3} text={outside} />
        <PixelText className="w-digits w-digits-dim" x={26 - textWidth(inside)} y={12} text={inside} />
      </OnWall>
    </g>
  );
}

function FuseBox({ at, reading }: { at: Pt; reading: string }) {
  const wid = Math.max(26, textWidth(reading) + 6);
  return (
    <g aria-label={t("world.obj.fusebox")}>
      <OnWall f={at} u0={0.5 - wid / 64} u1={0.5 + wid / 64} z={68}>
        <rect className="w-fuse" x="0" y="0" width={wid} height="30" />
        <rect className="w-lcd" x="3" y="3" width={wid - 6} height="9" />
        <PixelText className="w-digits" x={wid - 5 - textWidth(reading)} y={5} text={reading} />
        {[0, 1, 2].map((i) => <rect key={i} className="w-switch" x={4 + i * 7} y="17" width="4" height="8" />)}
      </OnWall>
    </g>
  );
}

// Unread letters stick out of the slot, up to three.
function Letterbox({ at, count, label, lit, onClick }: { at: Pt; count: number; label: string; lit: boolean; onClick: Click }) {
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <OnWall f={at} u0={0.25} u1={0.75} z={52}>
        {Array.from({ length: Math.min(count, 3) }, (_, i) => <rect key={i} className="w-letter" x={3 + i * 3} y={-5 + i} width="9" height="8" />)}
        <rect className="w-brass w-edge-fill" x="0" y="0" width="16" height="20" />
        <rect className="w-slot" x="3" y="4" width="10" height="2" />
      </OnWall>
    </g>
  );
}

// A doorway in the far wall; the panel hinges at the near jamb and is skewed shut, halfway, then into the room.
function Door({ at, open, label, lit, onClick }: { at: Pt; open: number; label: string; lit: boolean; onClick: Click }) {
  const hinge = wallAt(at, 0.875, 0), pw = wallAt(at, 0.125, 0).x - hinge.x, k = [-0.5, 0, 0.5][open];
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <OnWall f={at} u0={0} u1={1} z={DOOR_H + 6}>
        <rect className="w-jamb w-edge-fill" x="0" y="0" width="32" height={DOOR_H + 6} />
        <rect className="w-doorway" x="4" y="6" width="24" height={DOOR_H} />
      </OnWall>
      <g transform={`matrix(1 ${k} 0 1 ${hinge.x} ${hinge.y})`}>
        <rect className="w-panel" x="0" y={-DOOR_H} width={pw} height={DOOR_H} />
        <rect className="w-knob" x={pw - 5} y={-DOOR_H / 2} width="3" height="3" />
      </g>
    </g>
  );
}

// Pixel parts as x, y, width, height and fill, feet at 0,0, facing the lower left; drawn at two screen pixels per part pixel.
type Part = [number, number, number, number, string];
const SKIN = "var(--w-skin)", HAIR = "var(--w-hair)", SHIRT = "var(--accent)", PANTS = "var(--w-pants)", INK = "var(--w-line)";
const LEGS: Part[][] = [
  [[-3, -5, 2, 5, PANTS], [1, -5, 2, 5, PANTS]],
  [[-4, -5, 2, 5, PANTS], [2, -5, 2, 4, PANTS]],
  [[-4, -5, 2, 4, PANTS], [2, -5, 2, 5, PANTS]],
];
const BODY: Part[] = [[-5, -12, 1, 6, SKIN], [4, -12, 1, 6, SKIN], [-4, -13, 8, 8, SHIRT]];
const FRONT: Part[] = [[-5, -24, 10, 11, SKIN], [-5, -24, 10, 3, HAIR], [4, -21, 1, 4, HAIR], [-3, -19, 1, 2, INK], [0, -19, 1, 2, INK]];
const BACK: Part[] = [[-5, -24, 10, 11, SKIN], [-5, -24, 10, 9, HAIR], [-5, -19, 1, 3, SKIN]];

// Front view for the two downward facings, back view for the two upward ones, mirrored for the right-hand side.
function Player({ at, facing, stride }: { at: Pt; facing: Facing; stride: number }) {
  const c = center(at.x, at.y), flip = facing === "e" || facing === "n";
  const parts = [...LEGS[stride], ...BODY, ...(facing === "s" || facing === "e" ? FRONT : BACK)];
  return (
    <g className="w-player" transform={`translate(${Math.round(c.x)} ${Math.round(c.y)})`} aria-label={t("world.you")} pointerEvents="none">
      <polygon className="w-shadow" points="-16,0 0,-8 16,0 0,8" />
      <g transform={flip ? "scale(-1 1)" : undefined}>
        {parts.map(([px, py, pw, ph], i) => <rect key={`o${i}`} x={px * 2 - 1} y={py * 2 - 1} width={pw * 2 + 2} height={ph * 2 + 2} fill={INK} />)}
        {parts.map(([px, py, pw, ph, fill], i) => <rect key={i} x={px * 2} y={py * 2} width={pw * 2} height={ph * 2} fill={fill} />)}
      </g>
    </g>
  );
}
