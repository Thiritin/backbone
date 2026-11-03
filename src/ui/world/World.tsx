import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { FIXTURES, rackTiles, roomSize, type Facing, type Tile } from "../../sim/20-world/layout";
import { rackUnits } from "../../sim/20-world/datacenters";
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

const WALL = 64, DOOR_H = 40, STEP_MS = 400, BLINK_MS = 500, FLASH_MS = 120, ZOOM_MIN = 1, ZOOM_MAX = 3;
// Rack art is drawn 110 wide with 10 per unit, about a 19-inch front.
const RACK_W = 110, ART_U = 10;
const SOLID = ["desk", "pc", "scanner", "shelf"];
// Half a tile of wall thickness, outward from the far-left and the far-right wall.
const OUT_L: Pt = iso(-0.5, 0), OUT_R: Pt = iso(0, -0.5);
// Where the player stood per location, so the room resumes there.
const stood: Record<string, Pt> = {};

const pts = (...p: Pt[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });
const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const snap = (v: number, z: number) => Math.round(v * z) / z;

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

  const start = stood[loc.id] ?? (home ? { x: FIXTURES.pc.x, y: FIXTURES.pc.y + 1 } : { x: Math.floor(w / 2), y: h - 2 });
  const [pos, setPos] = useState<Pt>(start);
  const [facing, setFacing] = useState<Facing>("s");
  const [stride, setStride] = useState(0);
  const [door, setDoor] = useState(0);
  const [hover, setHover] = useState<Pt | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const at = useRef<Pt>(start), path = useRef<Pt[]>([]), then = useRef<(() => void) | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // Integer zoom over a viewBox the size of the element, so one unit is always a whole number of screen pixels.
  const [zoom, setZoom] = useState(2);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [org, setOrg] = useState<Pt | null>(null);
  const mid = { x: (w - h) * (iso(1, 0).x / 2), y: (iso(w, h).y - WALL - 8) / 2 };
  const o = org ?? { x: snap(mid.x - size.w / 2 / zoom, zoom), y: snap(mid.y - size.h / 2 / zoom, zoom) };
  const view = useRef({ zoom, o });
  view.current = { zoom, o };
  const zoomed = zoom >= 2;

  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; if (r.width) setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Walking, the leg frames and LED blink share one frame loop.
  useEffect(() => {
    let raf = 0, blinkAt = 0, t0 = 0, from = at.current;
    const frame = (now: number) => {
      if (now - blinkAt > BLINK_MS) { blinkAt = now; svg.current?.classList.toggle("w-blink"); }
      const next = path.current[0];
      if (next) {
        if (!t0) { t0 = now; from = at.current; setFacing(facingOf(next.x - from.x, next.y - from.y)); }
        const k = Math.min(1, (now - t0) / STEP_MS);
        setPos(lerp(from, next, k));
        setStride(k < 0.5 ? 1 : 2);
        if (k === 1) {
          at.current = next; path.current.shift(); t0 = 0;
          if (!path.current.length) { setStride(0); const run = then.current; then.current = null; run?.(); }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); stood[loc.id] = at.current; };
  }, [loc.id]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest?.("[role=dialog], [role=alertdialog], [role=menu]")) return;
      setSurface("desktop");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSurface]);

  // Wheel steps the zoom by one around the pointer; small trackpad deltas add up to a step.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let acc = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      const { zoom: z0, o } = view.current, z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 + (acc < 0 ? 1 : -1)));
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
  const temp = roomTemperature(game, loc);
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
  things.push({ depth: pos.x + pos.y + 0.01, node: <Player key="player" at={pos} facing={facing} stride={stride} name={game.company.name} /> });
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
          <polygon className="w-skirt" points={pts(O, Y, up(Y, 3), up(O, 3))} />
          <polygon className="w-skirt" points={pts(O, X, up(X, 3), up(O, 3))} />
          <polygon className="w-wall-end-l" points={pts(Y, add(Y, OUT_L), up(add(Y, OUT_L), WALL), up(Y, WALL))} />
          <polygon className="w-wall-end-r" points={pts(X, add(X, OUT_R), up(add(X, OUT_R), WALL), up(X, WALL))} />
          <polygon className="w-wall-top" points={pts(top, up(Y, WALL), add(up(Y, WALL), OUT_L), add(top, OUT_L), up(top, 8), add(top, OUT_R), add(up(X, WALL), OUT_R), up(X, WALL))} />
        </g>
        {home && <Fan at={FIXTURES.fan} label={`${n(temp, 1)} °C`} />}
        {home && <FuseBox at={FIXTURES.fusebox} label={`${n(power)} W`} />}
        {home && <Letterbox at={FIXTURES.letterbox} count={unread} label={t("world.obj.letterbox")} lit={lit === "letterbox"} onClick={use("letterbox", FIXTURES.letterbox, () => openApp("Post"))} />}
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
function corners(tile: Pt, dx = 14) {
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
  const units = rackUnits(rack.model), H = Math.round(12 + units * 0.8), { L, B, R } = corners(tile);
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

function Desk({ at, label, lit, onClick, children }: { at: Pt; label: string; lit: boolean; onClick: Click; children: ReactNode }) {
  const { c } = corners(at);
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <Box tile={at} height={11} dx={16} tone="w-tone-wood" />
      <g transform={`translate(${c.x} ${c.y - 11})`}>{children}</g>
    </g>
  );
}

// Faces as [points, class] pairs with one outline around them, for small items drawn by hand.
const Solid = ({ faces, edge }: { faces: [string, string][]; edge: string }) => (
  <>
    {faces.map(([p, cls]) => <polygon key={p} className={cls} points={p} />)}
    <polygon className="w-edge" points={edge} />
  </>
);

// Desk items draw around the desk top's centre; the screen faces the room's lower left.
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

// Open toward the room on its lower-right face; one stored device shows as one box, up to six.
function Shelf({ at, count, label, lit, onClick }: { at: Pt; count: number; label: string; lit: boolean; onClick: Click }) {
  const { B, c } = corners(at), boxes = Math.min(count, 6), H = 36;
  const on = (u: number, z: number) => ({ x: B.x + u, y: B.y - u / 2 - z });
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <Box tile={at} height={H} tone="w-tone-shelf" />
      {[12, 24].map((z) => <polygon key={z} className="w-board" points={pts(on(0, z), on(14, z), on(14, z + 1), on(0, z + 1))} />)}
      {Array.from({ length: boxes }, (_, i) => {
        const u = 2 + (i % 2) * 6, z = Math.floor(i / 2) * 12 + 1;
        return <polygon key={i} className="w-parcel" points={pts(on(u, z), on(u + 4, z), on(u + 4, z + 8), on(u, z + 8))} />;
      })}
      <Tag at={up(c, H + 10)} text={n0(count)} />
    </g>
  );
}

const n0 = (v: number) => v.toLocaleString(LOCALE);

// A small sign in the desktop font; at is the middle of its bottom edge.
function Tag({ at, text }: { at: Pt; text: string }) {
  const tw = text.length * 5 + 6, x = Math.round(at.x - tw / 2), y = Math.round(at.y) - 11;
  return (
    <g className="w-tag" pointerEvents="none">
      <rect x={x} y={y} width={tw} height={11} />
      <text x={x + tw / 2} y={y + 8} textAnchor="middle">{text}</text>
    </g>
  );
}

// A point on the far wall behind fixture tile f, u along the tile toward the near end and z above the floor.
const wallAt = (f: Pt, u: number, z: number): Pt => up(f.x === 0 ? iso(0, f.y + u) : iso(f.x + u, 0), z);
const plate = (f: Pt, a: number, b: number, z0: number, z1: number) => pts(wallAt(f, a, z0), wallAt(f, b, z0), wallAt(f, b, z1), wallAt(f, a, z1));

function Fan({ at, label }: { at: Pt; label: string }) {
  return (
    <g aria-label={t("world.obj.fan")}>
      <polygon className="w-frame" points={plate(at, 0.125, 0.875, 26, 52)} />
      <polygon className="w-glass" points={plate(at, 0.25, 0.75, 30, 48)} />
      <polygon className="w-blade" points={pts(wallAt(at, 0.5, 32), wallAt(at, 0.5, 46))} />
      <polygon className="w-blade" points={pts(wallAt(at, 0.3125, 39), wallAt(at, 0.6875, 39))} />
      <Tag at={wallAt(at, 0.5, 56)} text={label} />
    </g>
  );
}

function FuseBox({ at, label }: { at: Pt; label: string }) {
  return (
    <g aria-label={t("world.obj.fusebox")}>
      <polygon className="w-fuse" points={plate(at, 0.125, 0.875, 20, 40)} />
      <polygon className="w-blade" points={pts(wallAt(at, 0.5, 22), wallAt(at, 0.5, 38))} />
      <Tag at={wallAt(at, 0.5, 44)} text={label} />
    </g>
  );
}

function Letterbox({ at, count, label, lit, onClick }: { at: Pt; count: number; label: string; lit: boolean; onClick: Click }) {
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <polygon className="w-brass w-edge-fill" points={plate(at, 0.25, 0.75, 16, 28)} />
      <polygon className="w-slot" points={plate(at, 0.375, 0.625, 23, 24)} />
      <Tag at={wallAt(at, 0.5, 32)} text={n0(count)} />
    </g>
  );
}

// A doorway in the far wall; the panel hinges at the near jamb and is skewed shut, halfway, then into the room.
function Door({ at, open, label, lit, onClick }: { at: Pt; open: number; label: string; lit: boolean; onClick: Click }) {
  const hinge = wallAt(at, 0.875, 0), far = wallAt(at, 0.125, 0), pw = far.x - hinge.x, k = [-0.5, 0, 0.5][open];
  return (
    <g className={`w-obj${lit ? " w-lit" : ""}`} role="button" aria-label={label} onClick={onClick}>
      <polygon className="w-jamb w-edge-fill" points={plate(at, 0, 1, 0, DOOR_H + 4)} />
      <polygon className="w-doorway" points={plate(at, 0.125, 0.875, 0, DOOR_H)} />
      <g transform={`matrix(1 ${k} 0 1 ${hinge.x} ${hinge.y})`}>
        <rect className="w-panel" x="0" y={-DOOR_H} width={pw} height={DOOR_H} />
        <rect className="w-knob" x={pw - 4} y={-DOOR_H / 2} width="2" height="2" />
      </g>
    </g>
  );
}

// Pixel parts as x, y, width, height and fill, feet at 0,0, facing the lower left.
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
function Player({ at, facing, stride, name }: { at: Pt; facing: Facing; stride: number; name: string }) {
  const c = center(at.x, at.y), flip = facing === "e" || facing === "n";
  const parts = [...LEGS[stride], ...BODY, ...(facing === "s" || facing === "e" ? FRONT : BACK)];
  const x = Math.round(c.x), y = Math.round(c.y);
  return (
    <g className="w-player" transform={`translate(${x} ${y})`} aria-label={t("world.you")} pointerEvents="none">
      <polygon className="w-shadow" points="-8,0 0,-4 8,0 0,4" />
      <g transform={flip ? "scale(-1 1)" : undefined}>
        {parts.map(([px, py, pw, ph], i) => <rect key={`o${i}`} x={px - 1} y={py - 1} width={pw + 2} height={ph + 2} fill={INK} />)}
        {parts.map(([px, py, pw, ph, fill], i) => <rect key={i} x={px} y={py} width={pw} height={ph} fill={fill} />)}
      </g>
      <Tag at={{ x: 0, y: -28 }} text={name} />
    </g>
  );
}
