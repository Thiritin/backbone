import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { coldAisles, fixtures, rackTiles, roomSize, type Fixture } from "../../sim/20-world/layout";
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
import { SpeedControl } from "../desktop/MenuBar";
import { formatClock } from "../../sim/00-core/time";
import { iso, type Pt } from "./grid";
import { useTrip } from "../travel/route";
import { artOf, type Use } from "./rooms";
import {
  Cooling, CrossConnect, Desk, Dock, Door, Extinguisher, FuseBox, Grate, Letterbox, Monitor, Parcel, PARCEL_H, Pdu, pts, RackBox, Scanner, Shelf, Walls, WALL, Window,
} from "./draw";
import { RackPanel } from "./rack/RackPanel";
import { NetworkPanel, PostPanel, PowerPanel, StoragePanel } from "./panel/Panels";
import "./world.css";

const BLINK_MS = 500, FLASH_MS = 120, ZOOM_MIN = 0.75, ZOOM_MAX = 3, PAN_PX_S = 700;
// Arrow keys and WASD pan the view, in screen directions.
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
// How each room was zoomed and panned, per location, so the room resumes there.
const looked: Record<string, { zoom: number | null; org: Pt | null }> = {};

export const roomOf = (game: GameState): Location =>
  game.locations.find((l) => l.id === game.player.at) ?? game.locations.find((l) => l.space === "basement") ?? game.locations[0];

export function World() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), setSurface = useStore((s) => s.setSurface);
  const speed = useStore((s) => s.speed), setSpeed = useStore((s) => s.setSpeed);
  const loc = roomOf(game), home = loc.space === "basement";
  const { w, h } = roomSize(loc);
  const tiles = useMemo(() => rackTiles(loc, game.racks), [loc, game.racks]);
  const racks = game.racks.filter((r) => tiles[r.id]);
  const fx = fixtures(loc);

  const [door, setDoor] = useState(0);
  const [lit, setLit] = useState<string | null>(null);
  const [rackOpen, setRackOpen] = useState<string | null>(null);
  // The panel open over the room: storage, network, the post or the power of a fixture.
  const [panel, setPanel] = useState<{ kind: "storage" | "network" | "post" | "power"; title: string } | null>(null);
  const [hand, setHand] = useState<Pt | null>(null);
  const held = useRef<string[]>([]);
  const svg = useRef<SVGSVGElement>(null);

  // The default view fits the room with its walls and fills the window.
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [zoomSet, setZoom] = useState<number | null>(looked[loc.id]?.zoom ?? null);
  const [org, setOrg] = useState<Pt | null>(looked[loc.id]?.org ?? null);
  // Arriving by a trip shows the destination as it was last seen.
  const shown = useRef(loc.id);
  useEffect(() => {
    if (shown.current === loc.id) return;
    shown.current = loc.id;
    setZoom(looked[loc.id]?.zoom ?? null); setOrg(looked[loc.id]?.org ?? null); setRackOpen(null); setPanel(null);
  }, [loc]);
  useEffect(() => { if (shown.current === loc.id) looked[loc.id] = { zoom: zoomSet, org }; }, [loc.id, zoomSet, org]);
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

  // Held pan keys and the LED blink share one frame loop.
  useEffect(() => {
    let raf = 0, blinkAt = 0, last = 0;
    const frame = (now: number) => {
      if (now - blinkAt > BLINK_MS) { blinkAt = now; svg.current?.classList.toggle("w-blink"); }
      const dir = held.current.reduce<[number, number]>((a, k) => [a[0] + KEYS[k][0], a[1] + KEYS[k][1]], [0, 0]);
      if ((dir[0] || dir[1]) && last) {
        const { zoom, o } = view.current, step = PAN_PX_S * Math.min(0.05, (now - last) / 1000) / zoom;
        setOrg({ x: o.x + dir[0] * step, y: o.y + dir[1] * step });
      }
      last = now;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Escape puts a carried unit down; open panels close themselves.
  const escape = useRef(() => {});
  escape.current = () => { if (game.player.carrying) act(putDown); };
  useEffect(() => {
    const busy = (e: KeyboardEvent) =>
      e.metaKey || e.ctrlKey || e.altKey || !!(e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || !!document.querySelector("[role=dialog], [role=alertdialog], [role=menu]");
    const down = (e: KeyboardEvent) => {
      if (busy(e)) return;
      if (e.key === "Escape") { escape.current(); return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!KEYS[k]) return;
      e.preventDefault();
      if (!held.current.includes(k)) held.current.push(k);
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
  }, []);

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

  // Drag pans; a press that moved is no click. A carried unit follows the pointer.
  const drag = useRef<{ x: number; y: number; o: Pt } | null>(null), dragged = useRef(false);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, o }; dragged.current = false; };
  const move = (e: React.PointerEvent) => {
    if (game.player.carrying) {
      const r = svg.current!.getBoundingClientRect();
      setHand({ x: o.x + (e.clientX - r.left) / zoom, y: o.y + (e.clientY - r.top) / zoom });
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) return;
    dragged.current = true;
    setOrg({ x: d.o.x - dx / zoom, y: d.o.y - dy / zoom });
  };

  const click = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); if (!dragged.current) fn(); };
  // Clicking an object uses it at once.
  const use = (id: string, run: () => void) => click(() => {
    setLit(id);
    setTimeout(() => setLit((v) => (v === id ? null : v)), FLASH_MS);
    run();
  });

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
        <g key={r.id} className={`w-obj w-rack${lit === r.id ? " w-lit" : ""}`} data-rack={r.id} role="button" aria-label={r.name} onClick={use(r.id, () => setRackOpen(r.id))}>
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
        onClick={use("parcels", () => { if (act(pickUp, top.id).ok) setHand(null); })}>
        {shown.map((d, i) => <Parcel key={d.id} cx={p.x + 0.5} cy={p.y + 0.5} z={i * PARCEL_H} brand={d.brand} />)}
        {parcels.length > 1 && <text className="w-num w-num-tag" x={label.x} y={label.y - shown.length * PARCEL_H - 10}>{n(parcels.length)}</text>}
      </g>
    ) });
  }
  const run = (label: string): Record<Use, () => void> => ({
    desktop: () => setSurface("desktop"),
    storage: () => (carried ? act(putDown) : setPanel({ kind: "storage", title: "" })),
    network: () => setPanel({ kind: "network", title: "" }),
    power: () => setPanel({ kind: "power", title: t(label) }),
    door: () => openDoor(),
    post: () => { if (waiting) act(fetchPost); setPanel({ kind: "post", title: t(label) }); },
    scan: () => setPanel({ kind: "post", title: t(label) }),
    none: () => {},
  });
  const carriers = loc.dc ? carriersAt(datacenterById(loc.dc)).map((c) => c.name) : [];
  const watts = `${n(power)}W`;
  const draw: Record<string, (f: Fixture) => ReactNode> = {
    // The desk runs under the scanner and the PC beside it, so the three read as one piece.
    desk: (f) => <Desk from={fx.scanner?.x ?? f.x} to={(fx.pc?.x ?? f.x) + 1} />,
    scanner: (f) => <Scanner x={f.x} />,
    pc: (f) => <Monitor x={f.x} />,
    noc: (f) => <><Desk from={f.x} to={f.x + (f.w ?? 1)} y={f.y} />{Array.from({ length: f.w ?? 1 }, (_, i) => <Monitor key={i} x={f.x + i} y={f.y} />)}</>,
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
      ? <g key={id} className={`w-obj${lit === id ? " w-lit" : ""}`} role="button" aria-label={t(a.label)} onClick={use(id, run(a.label)[a.use])}>{art}</g>
      : <g key={id} aria-label={t(a.label)} pointerEvents="none">{art}</g>;
    if (a.wall) back.push(node);
    else things.push({ depth: f.x + f.y + (a.depth ?? 0), node });
  }
  things.sort((a, b) => a.depth - b.depth);

  const openDoor = () => {
    setDoor(1);
    setTimeout(() => setDoor(2), 150);
    setTimeout(() => { setDoor(0); useTrip.getState().send("door"); }, 700);
  };
  const grid = Array.from({ length: w + 1 }, (_, x) => `M${pts(iso(x, 0))} L${pts(iso(x, h))}`)
    .concat(Array.from({ length: h + 1 }, (_, y) => `M${pts(iso(0, y))} L${pts(iso(w, y))}`)).join(" ");

  return (
    <div className={`world${carried ? " w-carrying" : ""}`} aria-label={loc.name}>
      <svg ref={svg} className="world-svg" viewBox={`${o.x} ${o.y} ${size.w / zoom} ${size.h / zoom}`} preserveAspectRatio="xMinYMin meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        <Defs />
        <Walls w={w} h={h} fenced={!home} />
        <polygon className="w-floor" points={pts(iso(0, 0), iso(w, 0), iso(w, h), iso(0, h))} />
        {coldAisles(loc).map((a) => <Grate key={a.y} {...a} />)}
        <path className="w-tile" d={grid} />
        {back}
        {things.map((x) => x.node)}
        {carried && hand && (
          <g className="w-hand" data-carried={carried.id} transform={`translate(${hand.x} ${hand.y}) scale(${1.6 / zoom}) translate(14 24)`} pointerEvents="none"><Parcel cx={0} cy={0} z={-4} brand={carried.brand} /></g>
        )}
      </svg>
      <div className="w-clock">
        <SpeedControl speed={speed} setSpeed={setSpeed} />
        <span className="num">{formatClock(game.hour, game.minute)}</span>
      </div>
      {panel?.kind === "storage" && <StoragePanel loc={loc} onClose={() => setPanel(null)} />}
      {panel?.kind === "network" && <NetworkPanel loc={loc} onClose={() => setPanel(null)} />}
      {panel?.kind === "power" && <PowerPanel loc={loc} title={panel.title} onClose={() => setPanel(null)} />}
      {panel?.kind === "post" && <PostPanel title={panel.title} onClose={() => setPanel(null)} />}
      {rackOpen && <RackPanel key={rackOpen} rackId={rackOpen} onClose={() => setRackOpen(null)} />}
    </div>
  );
}

// Parcels drawn per stack before the count takes over.
const PARCEL_STACK = 3;
