import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { coldAisles, entryTile, fixtures, rackTiles, roomSize, type Facing, type Fixture } from "../../sim/20-world/layout";
import { carriersAt } from "../../sim/10-catalog/network";
import { datacenterById } from "../../sim/20-world/datacenters";
import { rackUnits } from "../../sim/20-world/datacenters";
import { sky, temperature } from "../../sim/20-world/weather";
import { modelById } from "../../sim/10-catalog/hardware";
import { inLetterbox, postLocation } from "../../sim/40-support/letters";
import { fetchPost } from "../../sim/90-actions/post";
import { pickUp, putDown } from "../../sim/90-actions/carry";
import { powerByLocation } from "../../sim/88-tick/tick";
import { roomTemperature } from "../../sim/60-infra/sensors";
import type { GameState, Location } from "../../sim/50-state";
import { Defs } from "../art/fronts";
import { rackItems } from "../apps/locations/RackView";
import { useStore } from "../store";
import { facingOf, iso, key, pathTo, useTiles, type Pt } from "./grid";
import { useTrip } from "../travel/route";
import { artOf, type Use } from "./rooms";
import {
  Cooling, CrossConnect, Desk, Dock, Door, Extinguisher, FuseBox, Grate, Letterbox, Monitor, Parcel, PARCEL_H, Pdu, Player, pts, RackBox, Scanner, Shelf, Walls, WALL, Window,
} from "./draw";
import { RackPanel } from "./rack/RackPanel";
import { ScanPanel } from "./scan/ScanPanel";
import "./world.css";

const STEP_MS = 400, BLINK_MS = 500, FLASH_MS = 120, ZOOM_MIN = 0.75, ZOOM_MAX = 3;
// Arrow keys and WASD step along the grid: up is away from the camera to the upper right.
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
  const game = useStore((s) => s.game), act = useStore((s) => s.act), setSurface = useStore((s) => s.setSurface), openApp = useStore((s) => s.openApp);
  const loc = roomOf(game), home = loc.space === "basement";
  const { w, h } = roomSize(loc);
  const tiles = useMemo(() => rackTiles(loc, game.racks), [loc, game.racks]);
  const racks = game.racks.filter((r) => tiles[r.id]);
  const fx = fixtures(loc);
  const blocked = useMemo(() => new Set([
    ...Object.entries(fx).filter(([id, f]) => artOf(id, f).solid).flatMap(([, f]) => Array.from({ length: f.w ?? 1 }, (_, i) => key(f.x + i, f.y))),
    ...Object.values(tiles).map((p) => key(p.x, p.y)),
  ]), [tiles, fx]);
  const grid = useRef({ w, h, blocked });
  grid.current = { w, h, blocked };

  const start = stood[loc.id] ?? (home ? { x: fx.pc.x, y: fx.pc.y + 1 } : entryTile(loc));
  const [pos, setPos] = useState<Pt>(start);
  const [facing, setFacing] = useState<Facing>("s");
  const [stride, setStride] = useState(0);
  const [door, setDoor] = useState(0);
  const [hover, setHover] = useState<Pt | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [rackOpen, setRackOpen] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const at = useRef<Pt>(start), path = useRef<Pt[]>([]), then = useRef<(() => void) | null>(null), held = useRef<string[]>([]), tap = useRef<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  // Arriving by a trip puts the player inside the destination's door.
  const shown = useRef(loc.id);
  useEffect(() => {
    if (shown.current === loc.id) return;
    shown.current = loc.id;
    const p = entryTile(loc);
    at.current = p; path.current = []; then.current = null;
    setPos(p); setFacing("e"); setZoom(null); setOrg(null); setRackOpen(null); setScanOpen(false);
  }, [loc]);

  // The default view fits the room with its walls and fills the window.
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [zoomSet, setZoom] = useState<number | null>(looked[loc.id]?.zoom ?? null);
  const [org, setOrg] = useState<Pt | null>(looked[loc.id]?.org ?? null);
  useEffect(() => { looked[loc.id] = { zoom: zoomSet, org }; }, [loc.id, zoomSet, org]);
  const box = { x: iso(0, h).x - 8, y: -WALL - 12, w: (w + h) * 32 + 16, h: (w + h) * 16 + WALL + 12 };
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
      if ((k === "Enter" || k === "e") && !busy(e)) { actOn.current(); return; }
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

  // The action key uses the rack the player faces.
  const actOn = useRef(() => {});
  actOn.current = () => {
    const [dx, dy] = AHEAD[facing];
    const p = { x: at.current.x + dx, y: at.current.y + dy };
    const r = racks.find((x) => tiles[x.id].x === p.x && tiles[x.id].y === p.y);
    if (r && !path.current.length) setRackOpen(r.id);
  };

  const power = useMemo(() => (powerByLocation(game)[loc.id]?.kwh ?? 0) * 1000, [game, loc.id]);
  const waiting = loc.id === postLocation(game) ? inLetterbox(game).length : 0;
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId).length;
  const parcels = game.devices.filter((d) => d.door?.at === loc.id && !d.chassisId);
  const carried = game.devices.find((d) => d.id === game.player.carrying);
  const n = (v: number, digits = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits });


  // Things standing on the floor, sorted by x + y so nearer ones overlap farther ones; a fixture sorts by its farthest tile.
  const things: { depth: number; node: ReactNode }[] = racks.map((r) => {
    const tile = tiles[r.id], leds = game.devices.filter((d) => d.rackId === r.id && !d.chassisId).map((d) => ({ id: d.id, on: d.on, top: d.slot + modelById(d.model).height - 1 }));
    return {
      depth: tile.x + tile.y,
      node: (
        <g key={r.id} className={`w-obj w-rack${lit === r.id ? " w-lit" : ""}`} data-rack={r.id} role="button" aria-label={r.name} onClick={use(r.id, tile, () => setRackOpen(r.id))}>
          <RackBox tile={tile} units={rackUnits(r.model)} items={zoomed ? rackItems(game, r.id) : []} leds={leds} zoomed={zoomed} />
        </g>
      ),
    };
  });
  // Parcels stack on the floor tile beside the door, clear of its swing, the newest on top.
  if (parcels.length && fx.door) {
    const p = { x: fx.door.x + 1, y: fx.door.y - 1 }, top = parcels[parcels.length - 1], shown = parcels.slice(-PARCEL_STACK);
    const label = iso(p.x + 0.5, p.y + 0.5);
    things.push({ depth: p.x + p.y, node: (
      <g key="parcels" className={`w-obj${lit === "parcels" ? " w-lit" : ""}`} role="button" data-parcels={parcels.length} aria-label={t("world.obj.parcels", { n: parcels.length })}
        onClick={use("parcels", p, () => act(pickUp, top.id))}>
        {shown.map((d, i) => <Parcel key={d.id} cx={p.x + 0.5} cy={p.y + 0.5} z={i * PARCEL_H} brand={d.brand} />)}
        {parcels.length > 1 && <text className="w-num w-num-tag" x={label.x} y={label.y - shown.length * PARCEL_H - 10}>{n(parcels.length)}</text>}
      </g>
    ) });
  }
  const run: Record<Use, () => void> = {
    desktop: () => setSurface("desktop"),
    storage: () => (carried ? act(putDown) : openApp("Locations", { kind: "storage", id: loc.id })),
    network: () => openApp("Locations", { kind: "network", id: loc.id }),
    power: () => openApp("Locations", { kind: "location", id: loc.id }),
    door: () => openDoor(),
    post: () => { if (waiting) act(fetchPost); openApp("Post"); },
    scan: () => setScanOpen(true),
    none: () => {},
  };
  const carriers = loc.dc ? carriersAt(datacenterById(loc.dc)).map((c) => c.name) : [];
  const watts = `${n(power)}W`;
  const draw: Record<string, (f: Fixture) => ReactNode> = {
    // The desk runs under the scanner and the PC beside it, so the three read as one piece.
    desk: (f) => <Desk from={fx.scanner?.x ?? f.x} to={(fx.pc?.x ?? f.x) + 1} />,
    scanner: (f) => <Scanner x={f.x} />,
    pc: (f) => <Monitor x={f.x} />,
    noc: (f) => <><Desk from={f.x} to={f.x + (f.w ?? 1)} />{Array.from({ length: f.w ?? 1 }, (_, i) => <Monitor key={i} x={f.x + i} />)}</>,
    shelf: (f) => <Shelf at={f} count={stored} />,
    fan: (f) => <Window f={f} sky={sky(loc.city, game.hour)} outside={`${n(temperature(loc.city, game.hour))}°C`} inside={`${n(roomTemperature(game, loc), 1)}°C`} />,
    fusebox: (f) => <FuseBox f={f} reading={watts} />,
    letterbox: (f) => <Letterbox f={f} count={waiting} shown={n(waiting)} />,
    door: (f) => <Door f={f} open={door} cage={!home} />,
    extinguisher: (f) => <Extinguisher f={f} />,
    xconnect: (f) => <CrossConnect f={f} carriers={carriers} />,
    cooling: (f) => <Cooling f={f} />,
    pdu: (f) => <Pdu f={f} reading={watts} />,
    dock: (f) => <Dock f={f} />,
  };
  const back: ReactNode[] = [];
  for (const [id, f] of Object.entries(fx)) {
    const a = artOf(id, f), art = draw[f.kind ?? id](f);
    const node = a.use
      ? <g key={id} className={`w-obj${lit === id ? " w-lit" : ""}`} role="button" aria-label={t(a.label)} onClick={use(id, f, run[a.use])}>{art}</g>
      : <g key={id} aria-label={t(a.label)} pointerEvents="none">{art}</g>;
    if (a.wall) back.push(node);
    else things.push({ depth: f.x + f.y + (a.depth ?? 0), node });
  }
  const carry = carried && <g data-carried={carried.id}><Parcel cx={pos.x + 0.5} cy={pos.y + 0.5} z={44} brand={carried.brand} /></g>;
  things.push({ depth: pos.x + pos.y + 0.01, node: <Player key="player" at={pos} facing={facing} stride={stride} carry={carry} /> });
  things.sort((a, b) => a.depth - b.depth);

  const openDoor = () => {
    setDoor(1);
    setTimeout(() => setDoor(2), 150);
    setTimeout(() => { setDoor(0); useTrip.getState().send("door"); }, 700);
  };
  const diamond = (x: number, y: number) => pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1));

  return (
    <div className="world" aria-label={loc.name}>
      <svg ref={svg} className="world-svg" viewBox={`${o.x} ${o.y} ${size.w / zoom} ${size.h / zoom}`} preserveAspectRatio="xMinYMin meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; setHover(null); }}>
        <Defs />
        <Walls w={w} h={h} fenced={!home} />
        <polygon className="w-floor" points={pts(iso(0, 0), iso(w, 0), iso(w, h), iso(0, h))} />
        {coldAisles(loc).map((a) => <Grate key={a.y} {...a} />)}
        {Array.from({ length: w * h }, (_, i) => {
          const x = i % w, y = Math.floor(i / w);
          return <polygon key={i} className="w-tile" points={diamond(x, y)} onPointerEnter={() => setHover({ x, y })} onClick={click(() => walk([{ x, y }]))} />;
        })}
        {hover && <polygon className="w-cursor" points={diamond(hover.x, hover.y)} />}
        {back}
        {things.map((x) => x.node)}
      </svg>
      {scanOpen && <ScanPanel onClose={() => setScanOpen(false)} />}
      {rackOpen && <RackPanel key={rackOpen} rackId={rackOpen} onClose={() => setRackOpen(null)} />}
    </div>
  );
}

const AHEAD: Record<Facing, [number, number]> = { s: [0, 1], n: [0, -1], w: [-1, 0], e: [1, 0] };
// Parcels drawn per stack before the count takes over.
const PARCEL_STACK = 3;
