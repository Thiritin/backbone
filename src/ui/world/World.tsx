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
import { facingOf, key, pathTo, T, useTiles, type Pt } from "./grid";
import { Sprite } from "./Sprite";
import { useTrip } from "../travel/route";
import "./world.css";

const STEP_MS = 400, BLINK_MS = 500, FLASH_MS = 120, ZOOM_MIN = 1, ZOOM_MAX = 3;
// Rack art is drawn 110 wide with 10 per unit, about a 19-inch front.
const RACK_W = 110, ART_U = 10;
const SOLID = ["desk", "pc", "scanner", "shelf", "fusebox"];
// Arrow keys and WASD step along the grid; up is toward the far wall.
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
// Where the player stood and how the room was zoomed and panned, per location, so the room resumes there.
const stood: Record<string, Pt> = {};
const looked: Record<string, { zoom: number | null; org: Pt | null }> = {};

const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

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

  // The default view fits the room with its walls.
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [zoomSet, setZoom] = useState<number | null>(looked[loc.id]?.zoom ?? null);
  const [org, setOrg] = useState<Pt | null>(looked[loc.id]?.org ?? null);
  useEffect(() => { looked[loc.id] = { zoom: zoomSet, org }; }, [loc.id, zoomSet, org]);
  const box = { x: -T, y: -3 * T, w: (w + 2) * T, h: (h + 3) * T };
  const fit = Math.min(ZOOM_MAX, size.w * 0.94 / box.w, size.h * 0.94 / box.h);
  const zoom = zoomSet ?? fit;
  const o = org ?? { x: box.x + box.w / 2 - size.w / 2 / zoom, y: box.y + box.h / 2 - size.h / 2 / zoom };
  const view = useRef({ zoom, o, fit });
  view.current = { zoom, o, fit };
  const zoomed = zoom >= 2;

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

  // Wheel zooms around the pointer.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z0, o, fit } = view.current;
      const z1 = Math.min(ZOOM_MAX, Math.max(Math.min(fit, ZOOM_MIN), z0 * Math.exp(-e.deltaY * 0.002)));
      if (z1 === z0) return;
      const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      setZoom(z1);
      setOrg({ x: o.x + sx / z0 - sx / z1, y: o.y + sy / z0 - sy / z1 });
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
    setOrg({ x: d.o.x - dx / zoom, y: d.o.y - dy / zoom });
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

  // Things standing on the floor, sorted by their row so nearer ones overlap farther ones.
  const things: { depth: number; node: ReactNode }[] = racks.map((r) => ({
    depth: tiles[r.id].y,
    node: <RackSprite key={r.id} rack={r} tile={tiles[r.id]} game={game} zoomed={zoomed} lit={lit === r.id} onClick={use(r.id, tiles[r.id], () => openApp("Locations", { kind: "rack", id: r.id }))} />,
  }));
  if (home) {
    const f = FIXTURES, obj = (id: string, label: string, run: () => void, art: ReactNode, k = 0) => ({
      depth: f[id].y + k,
      node: <g key={id} className={`w-obj${lit === id ? " w-lit" : ""}`} role="button" aria-label={label} onClick={use(id, f[id], run)}>{art}</g>,
    });
    things.push(
      obj("scanner", t("world.obj.scanner"), () => openApp("DocuWhere"), <Sprite name="scanner" x={f.scanner.x * T} y={(f.scanner.y + 1) * T} />),
      obj("desk", t("world.obj.desk"), () => {}, <Sprite name="desk" x={f.desk.x * T} y={(f.desk.y + 1) * T} />),
      // The tower stands at the desk's right end, beside the chair.
      obj("pc", t("world.obj.pc"), () => setSurface("desktop"), <Sprite name="pc" x={f.pc.x * T + 16} y={(f.pc.y + 1) * T} />, 0.001),
      {
        depth: f.fusebox.y,
        node: (
          <g key="fusebox" aria-label={t("world.obj.fusebox")} pointerEvents="none">
            <Sprite name="fusebox" x={f.fusebox.x * T} y={(f.fusebox.y + 1) * T}>
              <text className="w-num w-num-tag" x="34" y="12">{`${n(power)}W`}</text>
            </Sprite>
          </g>
        ),
      },
      obj("shelf", t("world.obj.shelf"), () => openApp("Locations", { kind: "storage", id: loc.id }), (
        <Sprite name="shelf" x={f.shelf.x * T} y={(f.shelf.y + 1) * T}>
          {Array.from({ length: Math.min(stored, CRATES.length) }, (_, i) => <Sprite key={i} name="crate" x={CRATES[i].x} y={CRATES[i].y} />)}
        </Sprite>
      )),
    );
  }
  things.push({ depth: pos.y + 0.01, node: <Sprite key="player" name={`player-${DIR[facing]}-${stride % 2}`} x={pos.x * T} y={(pos.y + 1) * T} /> });
  things.sort((a, b) => a.depth - b.depth);

  const openDoor = () => {
    setDoor(1);
    setTimeout(() => setDoor(2), 150);
    setTimeout(() => { setDoor(0); useTrip.getState().send("door"); }, 700);
  };

  return (
    <div className="world" aria-label={loc.name}>
      <svg ref={svg} className="world-svg" viewBox={`${o.x} ${o.y} ${size.w / zoom} ${size.h / zoom}`} preserveAspectRatio="xMinYMin meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; setHover(null); }}>
        <Defs />
        {/* Repeating tiles fill one rect each, so no seams show between them at any zoom. */}
        <defs>
          {TILED.map((name) => (
            <pattern key={name} id={`w-${name}`} width={T} height={T} patternUnits="userSpaceOnUse"><Sprite name={name} x={0} y={T} /></pattern>
          ))}
        </defs>
        <g pointerEvents="none">
          <rect fill="url(#w-floor)" x={0} y={0} width={w * T} height={h * T} />
          <rect fill="url(#w-wall-top)" x={0} y={-3 * T} width={w * T} height={T} />
          <rect fill="url(#w-wall)" x={0} y={-2 * T} width={w * T} height={T} />
          <rect fill="url(#w-wall-base)" x={0} y={-T} width={w * T} height={T} />
          <rect fill="url(#w-wall-side)" x={-T} y={-3 * T} width={T} height={(h + 3) * T} />
          <rect fill="url(#w-wall-side-right)" x={w * T} y={-3 * T} width={T} height={(h + 3) * T} />
        </g>
        {home && (
          <>
            <g aria-label={t("world.obj.fan")} pointerEvents="none">
              <Sprite name="fan" x={FIXTURES.fan.x * T - 12} y={-T + 2} />
              <Sprite name="weather" x={FIXTURES.fan.x * T + 4} y={-8}>
                <g transform="translate(4 6)">{SKY[sky(loc.city, game.hour)]}</g>
                <text className="w-num" x="37" y="11">{`${n(temperature(loc.city, game.hour))}°C`}</text>
                <text className="w-num w-num-dim" x="37" y="21">{`${n(roomTemperature(game, loc), 1)}°C`}</text>
              </Sprite>
            </g>
            <g className={`w-obj${lit === "letterbox" ? " w-lit" : ""}`} role="button" aria-label={t("world.obj.letterbox")} onClick={use("letterbox", FIXTURES.letterbox, () => openApp("Post"))}>
              <Sprite name="letterbox" x={-T + 10} y={(FIXTURES.letterbox.y + 1) * T - 8}>
                {Array.from({ length: Math.min(unread, 3) }, (_, i) => <rect key={i} className="w-letter" x={5 + i * 4} y={2 + i} width="10" height="9" rx="0.5" />)}
                <rect className="w-slot" x="5" y="8" width="18" height="3" rx="1.5" />
              </Sprite>
            </g>
            <g className={`w-obj${lit === "door" ? " w-lit" : ""}`} role="button" aria-label={t("world.obj.door")} onClick={use("door", FIXTURES.door, openDoor)}>
              <Sprite name={DOOR[door]} x={-T} y={(FIXTURES.door.y + 1) * T} />
            </g>
          </>
        )}
        {Array.from({ length: w * h }, (_, i) => {
          const x = i % w, y = Math.floor(i / w);
          return <rect key={i} className="w-tile" x={x * T} y={y * T} width={T} height={T} onPointerEnter={() => setHover({ x, y })} onClick={click(() => walk([{ x, y }]))} />;
        })}
        {hover && <rect className="w-cursor" x={hover.x * T + 2} y={hover.y * T + 2} width={T - 4} height={T - 4} rx="4" />}
        {things.map((x) => x.node)}
      </svg>
    </div>
  );
}

type Click = (e: MouseEvent) => void;

const DIR: Record<Facing, string> = { s: "down", n: "up", w: "left", e: "right" };
const DOOR = ["door-closed", "door-half", "door-open"];
// The far wall is a cap row over a face two tiles tall; the side walls are one-tile strips.
const TILED = ["floor", "wall-top", "wall", "wall-base", "wall-side", "wall-side-right"];
// Crate spots on the shelf, bottom-left corners in the shelf sprite's pixels.
const CRATES: Pt[] = [{ x: 4, y: 40 }, { x: 24, y: 40 }, { x: 4, y: 72 }, { x: 24, y: 72 }];
// The front panel of the rack sprites, in their pixels, where device fronts go when zoomed in.
const RACK_FACE = { x: 8, y: 22, w: 32, h: 66 };

function RackSprite({ rack, tile, game, zoomed, lit, onClick }: { rack: Rack; tile: Tile; game: GameState; zoomed: boolean; lit: boolean; onClick: Click }) {
  const units = rackUnits(rack.model), { x, y, w, h } = RACK_FACE;
  // RackFront's front view: unit numbers, rails and devices span RACK_W, the cable channel beyond it is cut off.
  const artW = RACK_W + 36, artH = units * ART_U + 8;
  return (
    <g className={`w-obj w-rack${lit ? " w-lit" : ""}`} data-rack={rack.id} role="button" aria-label={rack.name} onClick={onClick}>
      <Sprite name={zoomed ? "rack-open" : "rack-closed"} x={tile.x * T} y={(tile.y + 1) * T}>
        {zoomed ? (
          <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${artW} ${artH}`} preserveAspectRatio="none" pointerEvents="none">
            <RackFront units={units} items={rackItems(game, rack.id)} w={RACK_W} u={ART_U} onDevice={() => {}} onFree={() => {}} />
          </svg>
        ) : (
          game.devices.filter((d) => d.rackId === rack.id && !d.chassisId).map((d) => (
            <rect key={d.id} className={d.on ? "w-led w-led-on" : "w-led"} x={x + 2} y={y + h - (d.slot + modelById(d.model).height - 1) * (h / units) - 3} width="2" height="2" />
          ))
        )}
      </Sprite>
    </g>
  );
}

// Weather icons in a 9 by 10 box.
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
