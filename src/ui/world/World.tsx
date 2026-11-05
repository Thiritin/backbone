import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { FullscreenButton } from "../FullscreenButton";
import { floodedDevice } from "../../sim/60-infra/network";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { HALL } from "../../sim/20-world/properties";
import { cage, fixtures, neighbourRacks, officeFloors, officePlan, rackTiles, roomSize, shareMates, siteAreas, type Fixture } from "../../sim/20-world/layout";
import { rackUnits } from "../../sim/20-world/datacenters";
import { sky, temperature } from "../../sim/20-world/weather";
import { isOfficeRouter, modelById } from "../../sim/10-catalog/hardware";
import { atDesk, boxAt } from "../../sim/40-support/letters";
import { fetchPost } from "../../sim/90-actions/post";
import { powerByLocation } from "../../sim/88-tick/tick";
import { fanRuns, roomTemperature } from "../../sim/60-infra/sensors";
import { rackPower } from "../../sim/60-infra/status";
import type { End, GameState, Location } from "../../sim/50-state";
import { Defs } from "../art/fronts";
import { rackItems } from "../apps/locations/RackView";
import { uiSound, useStore } from "../store";
import { SpeedControl } from "../desktop/MenuBar";
import { dateOf, formatClock } from "../../sim/00-core/time";
import { iso, type Pt } from "./grid";
import { useTrip } from "../travel/route";
import { artOf, type Use } from "./rooms";
import { nearDoor } from "./slots";
import {
  at3, BeerCrate, Corkboard, Boiler, CableDuct, cageFence, Cart, CeilingLamp, CellarWindow, Chair, Concrete, Cooling, darkness, daylight, Desk, DeskLamp, Dock, Door, Drain, DryingRack, Extinguisher, FuseBox,
  CORDLESS_YEAR, Hygrometer, Letterbox, LightSwitch, Phone, Mat, Monitor, Night, Parcel, PARCEL_H, Pdu, pts, rackHeight, RackBox, RaisedFloor, Scanner, Shimmer, Shelf, ShelfUnit, Tower, Tubes, WallJack, Walls, WALL, Washer,
} from "./draw";
import { RackPanel } from "./rack/RackPanel";
import { playerFloor } from "../../sim/60-infra/figures";
import { useFigures } from "./figures";
import { OrderChip } from "./OrderChip";
import { visitThen } from "./visit";
import { frontOf, seatOf } from "../../sim/90-actions/work-orders";
import { PairPanel } from "./rack/PairPanel";
import { menuOn } from "../desktop/ContextMenu";
import { RoomCables } from "./rack/Cables";
import { PostPanel, PowerPanel, ScanPanel, StoragePanel } from "./panel/Panels";
import { PhonePanel } from "./panel/PhonePanel";
import { boardOf, CorkboardPanel } from "./panel/Corkboard";
import { TicketsPanel } from "./panel/Tickets";
import { answerCall } from "../../sim/90-actions/staff";
import type { Call } from "../../sim/47-staff/oncall";
import {
  Bin, ReceptionBoard, BossDesk, Buckets, chairAt, CodeDoor, Kitchen, Ladder, OfficeChair, OfficeDesk, OfficeFloor, OfficeWindow, Partition, Plant, Printer, Reception, StairsSign, Toolbox, Tube,
  WallTray, Whiteboard,
} from "./office";
import { Closet } from "./office";
import { hallScene } from "./hall";
import { useEdit } from "./hall-edit";
import { HallStrip, STRIP_H } from "./hall-parts";
import { MainBoardRoom, MeetMeRoom } from "./hall-doors";
import { GroundRect, SiteBack, SiteFront, SiteNight, SiteWeather, type Drive } from "./site/Site";
import { leafPhase, leafVars, seasonClasses } from "./site/season";
import { carDoor } from "../travel/sounds";
import { siteOf } from "./site/layout";
import "./world.css";

// How dark a tripped room is drawn, darker than a night with the lights off.
const TRIPPED_DARK = 0.6;
const BLINK_MS = 500, FLASH_MS = 120, HINT_MS = 1600, RING_MS = 4000, ZOOM_MIN = 0.75, ZOOM_MAX = 3, PAN_PX_S = 700;
// Arrow keys and WASD pan the view, in screen directions.
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};
// How each room was zoomed and panned and whether its lights were on, per location, so the room resumes there.
// Objects whose close-up opens after the figure walked to them.
const STANDS = new Set<Use>(["storage", "power", "post", "scan", "board", "phone", "mainboard", "meetme"]);
const looked: Record<string, { zoom: number | null; org: Pt | null; lights: boolean }> = {};

export const roomOf = (game: GameState): Location =>
  game.locations.find((l) => l.id === game.player.at) ?? game.locations.find((l) => l.space === "basement") ?? game.locations[0];

export const World = memo(function World() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), setSurface = useStore((s) => s.setSurface);
  const speed = useStore((s) => s.speed), setSpeed = useStore((s) => s.setSpeed);
  const loc = roomOf(game), home = loc.space === "basement", office = loc.space === "office";
  // An office shows one floor at a time, the reception's floor first.
  const [floorSet, setFloor] = useState<number | null>(null);
  const base = officePlan(game, loc), plan = base && { ...base, floor: floorSet ?? playerFloor(game, loc) };
  const { w, h } = roomSize(loc, plan);
  const tiles = useMemo(() => {
    const own = rackTiles(loc, game.racks, plan);
    return { ...own, ...shareMates(loc, game.locations, game.racks, own) };
  }, [loc, game.locations, game.racks, game.properties, plan?.floor]);
  const racks = game.racks.filter((r) => tiles[r.id] && (tiles[r.id].floor ?? 1) === (plan?.floor ?? 1));
  const fx = fixtures(loc, plan);

  const [door, setDoor] = useState(0);
  // The player's car: it slides into its bay when the trip ends and out of it on leaving. UI state only, never saved.
  const [carAnim, setCarAnim] = useState<"" | "in" | "out">("");
  const stage = useTrip((x) => x.stage), lastStage = useRef(stage);
  useEffect(() => {
    const was = lastStage.current; lastStage.current = stage;
    if (was === "arrive" && stage === "room") { setCarAnim("in"); const id = setTimeout(() => setCarAnim("") , 1300); return () => clearTimeout(id); }
  }, [stage]);
  const [lit, setLit] = useState<string | null>(null);
  // The object a corkboard card points at, glowing for a moment after the close-up closes.
  const [hint, setHint] = useState<string | null>(null);
  // The own hall is being edited.
  const [editing, setEditing] = useState(false);
  const [rackOpen, setRackOpen] = useState<{ id: string; port?: End } | null>(null);
  // The port whose cable the player holds; with no panel open, the room is in cable mode.
  const [cable, setCable] = useState<End | null>(null);
  // A connection between two racks: the pair whose backs are open, and the rack or device a right-click started from.
  const [pair, setPair] = useState<{ a: string; b: string; from?: string } | null>(null);
  const [from, setFrom] = useState<{ rack: string; device?: string } | null>(null);
  // A drag from one rack to another, with the pointer in room coordinates.
  const link = useRef<string | null>(null);
  const [linkAt, setLinkAt] = useState<Pt | null>(null);
  // The panel open over the room: storage, the post or the power of a fixture.
  const [panel, setPanel] = useState<{ kind: "storage" | "post" | "scan" | "power" | "phone" | "board" | "mainboard" | "meetme" | "tickets"; title: string; id?: string; call?: Call | null } | null>(null);
  const held = useRef<string[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  // Alerts wait behind a chip while a close-up or edit mode is open.
  const covered = !!(editing || panel || rackOpen || pair), setCloseup = useStore((s) => s.setCloseup);
  useEffect(() => { setCloseup(covered); return () => setCloseup(false); }, [covered, setCloseup]);

  // The default view fits the room with its walls and fills the window.
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [zoomSet, setZoom] = useState<number | null>(looked[loc.id]?.zoom ?? null);
  const [org, setOrg] = useState<Pt | null>(looked[loc.id]?.org ?? null);
  const [lights, setLights] = useState(looked[loc.id]?.lights ?? false);
  // Arriving by a trip shows the destination as it was last seen.
  const shown = useRef(loc.id);
  useEffect(() => {
    if (shown.current === loc.id) return;
    shown.current = loc.id;
    setZoom(looked[loc.id]?.zoom ?? null); setOrg(looked[loc.id]?.org ?? null); setLights(looked[loc.id]?.lights ?? false); setFloor(null); setRackOpen(null); setPanel(null); setCable(null); setPair(null); setFrom(null); setEditing(false);
  }, [loc]);
  useEffect(() => { if (shown.current === loc.id) looked[loc.id] = { zoom: zoomSet, org, lights }; }, [loc.id, zoomSet, org, lights]);
  // An own hall is fitted with its annex rooms and the NOC room's place below it.
  const rects = loc.space === "hall" ? [...siteAreas(game, loc).map((a) => a.rect), { x: 0, y: h, w: HALL.noc.w, h: HALL.noc.d }] : [{ x: 0, y: 0, w, h }];
  const left = Math.min(...rects.map((r) => iso(r.x, r.y + r.h).x)), right = Math.max(...rects.map((r) => iso(r.x + r.w, r.y).x)), low = Math.max(...rects.map((r) => iso(r.x + r.w, r.y + r.h).y));
  const box = { x: left - 8, y: -WALL - 12, w: right - left + 16, h: low + WALL + 12 };
  // The parts strip covers the bottom of the room in edit mode; the room is fitted and centred above it.
  const room = size.h - (editing ? STRIP_H : 0);
  const fit = Math.min(ZOOM_MAX, size.w * 0.94 / box.w, room * 0.94 / box.h);
  const zoom = zoomSet ?? fit;
  const o = org ?? { x: box.x + box.w / 2 - size.w / 2 / zoom, y: box.y + box.h / 2 - room / 2 / zoom };
  const view = useRef({ zoom, o, fit });
  // The player may zoom out to fit the whole site around the room.
  const staffHere = game.staff.length;
  const site = useMemo(() => siteOf(game, loc, w, h), [loc.id, game.properties, staffHere, w, h]);
  const fitSite = Math.min(size.w * 0.98 / site.box.w, size.h * 0.98 / site.box.h) * (site.kind === "plot" ? (site.setting === "nowhere" ? 1 : 1.3) : 1);
  view.current = { zoom, o, fit: Math.min(fit, fitSite) };
  const port = { x: o.x, y: o.y, w: size.w / zoom, h: size.h / zoom };
  const zoomed = zoom >= 2;
  const hallRect = loc.space === "hall" ? siteAreas(game, loc).find((a) => a.id === "hall")?.rect : undefined;

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

  // Escape drops a cable in progress; open panels close themselves.
  const escape = useRef(() => {});
  escape.current = () => { if (from) setFrom(null); else if (cable) setCable(null); else if (editing) { if (!useEdit.getState().escape()) setEditing(false); } else useStore.getState().setPause(true); };
  useEffect(() => {
    const busy = (e: KeyboardEvent) =>
      e.metaKey || e.ctrlKey || e.altKey || !!(e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || !!document.querySelector("[role=dialog], [role=alertdialog], [role=menu]");
    const down = (e: KeyboardEvent) => {
      // The OS swallows the keyup of a key released under a modifier, so a modifier drops every held key.
      if (e.metaKey || e.ctrlKey || e.altKey) held.current = [];
      if (busy(e)) return;
      if (e.key === "Escape") { escape.current(); return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!KEYS[k]) return;
      e.preventDefault();
      if (!held.current.includes(k)) held.current.push(k);
    };
    const release = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) { held.current = []; return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      held.current = held.current.filter((x) => x !== k);
    };
    const clear = () => { held.current = []; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", release); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
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

  // Drag pans; a press that moved is no click.
  const drag = useRef<{ x: number; y: number; o: Pt } | null>(null), dragged = useRef(false);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, o }; dragged.current = false; };
  const move = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect(), p = { x: o.x + (e.clientX - r.left) / zoom, y: o.y + (e.clientY - r.top) / zoom };
    if (link.current) { setLinkAt(p); return; }
    const d = drag.current;
    if (!d) return;
    // A release outside the view or a cancelled gesture sends no pointerup; a move with no button down ends the drag.
    if (!e.buttons) { drag.current = null; return; }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) return;
    dragged.current = true;
    setOrg({ x: d.o.x - dx / zoom, y: d.o.y - dy / zoom });
  };

  // A press on a rack that lets go on another opens both backs.
  const up = (e: React.PointerEvent) => {
    drag.current = null;
    const a = link.current;
    link.current = null;
    setLinkAt(null);
    const b = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-rack]")?.getAttribute("data-rack");
    if (a && b && b !== a) { dragged.current = true; setPair({ a, b }); }
  };
  const click = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); if (!dragged.current) fn(); };
  // Clicking an object uses it at once.
  const use = (id: string, run: () => void, stand?: () => Pt | null, label = "") => click(() => {
    setLit(id);
    setTimeout(() => setLit((v) => (v === id ? null : v)), FLASH_MS);
    visit(run, stand, label);
  });
  // A close-up or the desktop opens once the player's figure stands at it.
  const visit = (run: () => void, stand?: () => Pt | null, label = "") => visitThen(loc.id, stand?.() ?? null, label, run);
  // Free floor beside an object, nearest to the figure; walls and the like clamp into the room.
  const beside = (f: Fixture): Pt | null => {
    const busy = new Set([...Object.values(tiles).map((t) => `${t.x},${t.y}`), ...Object.entries(fx).filter(([id, x]) => !artOf(id, x)?.wall).map(([, x]) => x).flatMap((x) => Array.from({ length: (x.w ?? 1) * (x.h ?? 1) }, (_, i) => `${x.x + (i % (x.w ?? 1))},${x.y + Math.floor(i / (x.w ?? 1))}`))]);
    const at = (x: number, y: number) => ({ x: Math.min(w - 1, Math.max(0, x)), y: Math.min(h - 1, Math.max(0, y)) });
    const c = [at(f.x, f.y), at(f.x, f.y + 1), at(f.x, f.y - 1), at(f.x + 1, f.y), at(f.x - 1, f.y)].filter((p) => !busy.has(`${p.x},${p.y}`));
    return c[0] ?? null;
  };
  const seat = (): Pt | null => seatOf(useStore.getState().game, loc.id, "player");

  const staff = useFigures(game, loc, plan, tiles, speed);
  const power = useMemo(() => (powerByLocation(game)[loc.id]?.kwh ?? 0) * 1000, [game, loc.id]);
  const waiting = boxAt(game, loc.id).length;
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId).length;
  // A unit that landed in storage within the last day stands by the door as a parcel until it is mounted.
  const parcels = game.devices.filter((d) => d.store === loc.id && !d.chassisId && d.arrivedAt !== null && d.arrivedAt > game.hour - 24);
  // The phone rings for every open call while this room with a phone is on screen.
  const ringing = game.calls.find((c) => c.answeredAt === null), cordless = dateOf(game.hour).getUTCFullYear() >= CORDLESS_YEAR;
  const rings = !!ringing && !!fx.phone;
  useEffect(() => {
    if (!rings) return;
    uiSound("ring");
    const id = setInterval(() => uiSound("ring"), RING_MS);
    return () => clearInterval(id);
  }, [rings]);
  const n = (v: number, digits = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits });


  // Things standing on the floor, sorted by x + y so nearer ones overlap farther ones; a fixture sorts by its farthest tile.
  const things: { depth: number; node: ReactNode; front?: boolean }[] = racks.map((r) => {
    const tile = tiles[r.id], glow = (cable && !rackOpen && game.devices.find((d) => d.id === cable.device)?.rackId !== r.id) || (from && from.rack !== r.id), leds = game.devices.filter((d) => d.rackId === r.id && !d.chassisId).map((d) => ({ id: d.id, on: d.on && !loc.tripped, fault: d.components.some((c) => c.failedAt !== null), flood: floodedDevice(game, d) && !loc.tripped, top: d.slot + modelById(d.model).height - 1 }));
    const p = rackPower(game, r.id), hot = !loc.tripped && p.limitWatts > 0 && p.watts >= 0.9 * p.limitWatts;
    return {
      depth: tile.x + tile.y,
      node: (
        <g key={r.id} className={`w-obj w-rack${lit === r.id ? " w-lit" : ""}${glow || hint === r.id ? " w-glow" : ""}`} data-rack={r.id} role="button" aria-label={r.name}
          onClick={use(r.id, () => { if (from && from.rack !== r.id) { setPair({ a: from.rack, b: r.id, from: from.device }); setFrom(null); } else setRackOpen({ id: r.id }); }, () => frontOf(tile), r.name)}
          onPointerDown={(e) => { if (!e.button && r.model !== "shelf") { e.stopPropagation(); link.current = r.id; dragged.current = false; } }}
          onContextMenu={menuOn(() => [{ label: t("world.newConnection"), run: () => setFrom({ rack: r.id }) }])}>
          {r.model === "shelf"
            ? <ShelfUnit tile={tile} units={rackUnits(r.model)} devices={game.devices.filter((d) => d.rackId === r.id).map((d) => ({ id: d.id, slot: d.slot, height: modelById(d.model).height, light: isOfficeRouter(modelById(d.model)), on: d.on && !loc.tripped, flood: floodedDevice(game, d) && !loc.tripped }))} />
            : <RackBox tile={tile} units={rackUnits(r.model)} items={zoomed ? rackItems(game, r.id) : []} leds={leds} zoomed={zoomed} mesh={!home} name={home ? undefined : r.name} cabinet={r.provided ? 42 : undefined} />}
          {hot && <Shimmer tile={tile} z={rackHeight(rackUnits(r.model))} />}
        </g>
      ),
    };
  });
  // Other tenants' racks and the cage fence are scenery from the layout.
  const fence = cage(loc), taken = new Set(Object.values(tiles).map((t) => `${t.x},${t.y}`)), others = neighbourRacks(loc).filter((t) => !taken.has(`${t.x},${t.y}`));
  for (const tile of others)
    things.push({ depth: tile.x + tile.y, node: <g key={`n${tile.x},${tile.y}`} pointerEvents="none" aria-hidden><RackBox tile={tile} units={42} items={[]} leds={[]} zoomed={false} mesh neighbour /></g> });
  if (fence) things.push(...cageFence(fence));
  // Parcels stack on the floor tile beside the door, clear of its swing, the newest on top; a picture only.
  if (parcels.length && fx.door) {
    const p = { x: fx.door.x + 1, y: fx.door.y - 1 }, shown = parcels.slice(-PARCEL_STACK);
    const label = iso(p.x + 0.5, p.y + 0.5);
    things.push({ depth: p.x + p.y, node: (
      <g key="parcels" pointerEvents="none" data-parcels={parcels.length} role="img" aria-label={t("world.obj.parcels", { n: parcels.length })}>
        {shown.map((d, i) => <Parcel key={d.id} cx={p.x + 0.5} cy={p.y + 0.5} z={i * PARCEL_H} brand={d.brand} />)}
        {parcels.length > 1 && <text className="w-num w-num-tag" x={label.x} y={label.y - shown.length * PARCEL_H - 10}>{n(parcels.length)}</text>}
      </g>
    ) });
  }
  const run = (label: string, id = ""): Record<Use, () => void> => ({
    desktop: () => setSurface("desktop"),
    storage: () => setPanel({ kind: "storage", title: "" }),
    power: () => setPanel({ kind: "power", title: t(label), id }),
    door: () => openDoor(),
    post: () => { if (waiting) act(fetchPost); if (atDesk(useStore.getState().game).length) setPanel({ kind: "post", title: t(label) }); },
    scan: () => setPanel({ kind: "scan", title: t(label) }),
    stairs: () => { const fs = officeFloors(plan?.sections ?? []); setFloor(fs[(fs.indexOf(plan?.floor ?? 1) + 1) % fs.length]); setRackOpen(null); },
    light: () => setLights((v) => !v),
    board: () => setPanel({ kind: "board", title: t(label) }),
    edit: () => setEditing((v) => !v),
    mainboard: () => setPanel({ kind: "mainboard", title: t(label) }),
    meetme: () => setPanel({ kind: "meetme", title: t(label) }),
    phone: () => {
      const g = useStore.getState().game, c = g.calls.find((x) => x.answeredAt === null) ?? g.calls[g.calls.length - 1] ?? null;
      if (c?.answeredAt === null) act(answerCall, c.id);
      setPanel({ kind: "phone", title: t(label), call: c });
    },
  });
  const watts = `${n(power)}W`;
  const day = Math.floor(game.hour / 24), seasons = useMemo(() => seasonClasses(loc.city, day * 24), [loc.city, day]), leaf = useMemo(() => leafVars(day * 24) as CSSProperties, [day]);
  const date = dateOf(game.hour), hd = date.getUTCHours() + game.minute / 60, month = date.getUTCMonth(), night = daylight(hd, month) < 0.5;
  // The meter disc turns once every few seconds at a kilowatt, faster as the draw grows.
  const turn = power > 0 ? Math.min(20, 4000 / power) : 0;
  const board = boardOf(game);
  const pinned = { cards: board.cards.map((c) => c.done), current: board.cards.findIndex((c) => c.id === board.current), under: board.under.length };
  const draw: Record<string, (f: Fixture) => ReactNode> = {
    // The desk runs under the scanner and the PC beside it, so the three read as one piece.
    desk: (f) => <Desk from={fx.scanner?.x ?? f.x} to={(fx.pc?.x ?? f.x) + 1} under={home && <><BeerCrate x={fx.scanner?.x ?? f.x} /><Tower x={fx.pc?.x ?? f.x} /></>} />,
    scanner: (f) => <Scanner x={f.x} />,
    pc: (f) => <><Monitor x={f.x} />{home && <DeskLamp x={f.x - 1} on={lights} />}</>,
    noc: (f) => <><Desk from={f.x} to={f.x + (f.w ?? 1)} y={f.y} />{Array.from({ length: f.w ?? 1 }, (_, i) => <Monitor key={i} x={f.x + i} y={f.y} />)}</>,
    shelf: (f) => <Shelf at={f} count={stored} />,
    fan: (f) => <CellarWindow f={f} fan spin={!loc.tripped && fanRuns(game, loc)} night={night} sky={sky(loc.city, game.hour)} />,
    window: (f) => <CellarWindow f={f} night={night} sky={sky(loc.city, game.hour)} />,
    hygrometer: (f) => <Hygrometer f={f} inside={`${n(roomTemperature(game, loc), 1)}°`} outside={`${n(temperature(loc.city, game.hour))}°`} />,
    fusebox: (f) => <FuseBox f={f} reading={watts} turn={turn} w={w} />,
    jack: (f) => <WallJack f={f} />,
    duct: () => <CableDuct w={w} h={h} door={fx.door} socket={fx.jack} />,
    switch: (f) => <LightSwitch f={f} on={lights} />,
    boiler: (f) => <Boiler f={f} />,
    washer: (f) => <Washer f={f} />,
    dryer: (f) => <DryingRack f={f} />,
    chair: (f) => <Chair f={f} />,
    mat: (f) => <Mat f={f} />,
    drain: (f) => <Drain f={f} />,
    lamp: (f) => <CeilingLamp f={f} on={lights} />,
    phone: (f) => <Phone f={f} ringing={!!ringing} cordless={cordless} near={nearDoor(f, fx.door)} />,
    letterbox: (f) => <Letterbox f={f} count={waiting} shown={n(waiting)} near={nearDoor(f, fx.door)} />,
    door: (f) => <Door f={f} open={door} steel={!home && !office} />,
    extinguisher: (f) => <Extinguisher f={f} />,
    cart: (f) => <Cart f={f} />,
    cooling: (f) => <Cooling f={f} />,
    pdu: (f) => <Pdu f={f} reading={watts} />,
    dock: (f) => <Dock f={f} />,
    stairs: (f) => <><Door f={f} open={0} steel={false} /><StairsSign f={f} floor={n(plan?.floor ?? 1)} /></>,
    bossdesk: (f) => <BossDesk f={f} night={night} />,
    owindow: (f) => <OfficeWindow f={f} night={night} sky={sky(loc.city, game.hour)} />,
    whiteboard: (f) => <Whiteboard f={f} />,
    tray: (f) => <WallTray f={f} />,
    tube: (f) => <Tube f={f} on={lights} />,
    kitchen: (f) => <Kitchen f={f} />,
    printer: (f) => <Printer f={f} />,
    reception: (f) => <Reception f={f} name={game.company.name} />,
    plant: (f) => <Plant f={f} />,
    bin: (f) => <Bin f={f} />,
    partition: (f) => <Partition f={f} />,
    codedoor: (f) => <CodeDoor f={f} />,
    "odesk-s": (f) => <OfficeDesk f={f} facing="s" />,
    "odesk-n": (f) => <OfficeDesk f={f} facing="n" />,
    "ochair-s": (f) => <OfficeChair {...chairAt(f, "s")} facing="s" />,
    "ochair-n": (f) => <OfficeChair {...chairAt(f, "n")} facing="n" />,
    buckets: (f) => <Buckets f={f} />,
    ladder: (f) => <Ladder f={f} />,
    toolbox: (f) => <Toolbox f={f} />,
    closet: (f) => <Closet f={f} />,
    corkboard: (f) => office ? <ReceptionBoard f={f} {...pinned} /> : <Corkboard f={f} {...pinned} span={2} />,
  };
  if (loc.space === "hall") hallScene(game, loc, plan, tiles, { w, h }, things, draw, editing, () => setPanel({ kind: "tickets", title: t("hall.tickets.title") }));
  // A tripped room goes dark; its windows and lit bulbs are drawn again over the dark.
  const back: ReactNode[] = [], over: ReactNode[] = [], bright: ReactNode[] = [];
  for (const [id, f] of Object.entries(fx)) {
    const a = artOf(id, f), art = draw[f.kind ?? id](f);
    if (loc.tripped && (["fan", "window", "owindow"].includes(f.kind ?? id) || (lights && ["lamp", "tube"].includes(f.kind ?? id)))) bright.push(<g key={`b${id}`} pointerEvents="none" aria-hidden>{art}</g>);
    const node = a.use && !(a.use === "door" && site.bay) && a.label && art
      ? <g key={id} className={`w-obj${lit === id ? " w-lit" : ""}${hint === id ? " w-glow" : ""}`} role="button" aria-label={t(a.label)} onClick={use(id, run(a.label, f.kind ?? id)[a.use], a.use === "desktop" ? seat : STANDS.has(a.use) ? () => beside(f) : undefined, t(a.label))}>{art}</g>
      : <g key={id} aria-label={a.label && t(a.label)} aria-hidden={!a.label || undefined} pointerEvents="none">{art}</g>;
    if (a.wall) back.push(node);
    else if (a.top) over.push(node);
    else things.push({ depth: f.x + f.y + (a.depth ?? 0), node });
  }
  things.push(...staff);
  things.sort((a, b) => a.depth - b.depth);

  const leaveRef = useRef<(e: MouseEvent) => void>(() => {});
  const leaveCar = () => {
    carDoor();
    setCarAnim("out");
    setTimeout(() => { setCarAnim(""); useTrip.getState().send("door"); }, 700);
  };
  leaveRef.current = use("car", leaveCar, () => (fx.door ? beside(fx.door) : null), t("world.site.car")) 
  const drive: Drive = useMemo(() => ({ anim: carAnim, onLeave: (e) => leaveRef.current(e as MouseEvent) }), [carAnim]);
  const openDoor = () => {
    setDoor(1);
    setTimeout(() => setDoor(2), 150);
    setTimeout(() => { setDoor(0); useTrip.getState().send("door"); }, 700);
  };

  return (
    <div className="world" aria-label={loc.name}>
      <FullscreenButton className="world-fs" />
      <svg ref={svg} className={`world-svg ${seasons}${night ? " w-night" : ""}`} style={leaf}
        viewBox={`${o.x} ${o.y} ${size.w / zoom} ${size.h / zoom}`} preserveAspectRatio="xMinYMin meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { drag.current = null; link.current = null; setLinkAt(null); }}>
        <GroundRect view={port} kind={site.kind} />
        <Defs />
        <SiteBack s={site} name={game.company.name} band={game.company.color} month={month} year={date.getUTCFullYear()} drive={drive} />
        <Walls w={w} h={h} dc={!home && !office} color={game.company.color} />
        {home ? <><polygon className="w-floor" points={pts(iso(0, 0), iso(w, 0), iso(w, h), iso(0, h))} /><Concrete w={w} h={h} /></>
          : office ? <OfficeFloor w={w} h={h} servers={Object.values(fx).filter((f) => f.kind === "tray").map((f) => f.x - 3)} /> : <RaisedFloor w={hallRect?.w ?? w} h={hallRect?.h ?? h} />}
        {back}
        {things.filter((x) => !x.front).map((x) => x.node)}
        <SiteFront s={site} name={game.company.name} band={game.company.color} year={date.getUTCFullYear()} drive={drive} />
        {(home || office) && <Night w={w} h={h} opacity={loc.tripped ? TRIPPED_DARK : darkness(hd, month, lights)} />}
        {things.filter((x) => x.front).map((x) => x.node)}
        <SiteNight s={site} view={port} opacity={darkness(hd, month)} />
        <SiteWeather sky={sky(loc.city, game.hour)} night={night} falling={leafPhase(game.hour).now === "falling" || leafPhase(game.hour).now === "autumn"} view={port} />
        {bright}
        {!home && !office && loc.space !== "hall" && <Tubes tiles={[...others, ...Object.values(tiles)]} />}
        <RoomCables game={game} loc={loc} tiles={tiles} fx={fx} onOpen={(id, port) => { setCable(null); setRackOpen({ id, port }); }} />
        {over}
        {linkAt && link.current && tiles[link.current] && (() => {
          const tl = tiles[link.current], top = at3(tl.x + 0.5, tl.y + 0.5, rackHeight(rackUnits(game.racks.find((r) => r.id === link.current)!.model)));
          return <path className="w-link" d={`M${top.x} ${top.y}L${linkAt.x} ${linkAt.y}`} pointerEvents="none" />;
        })()}
      </svg>
      <OrderChip game={game} loc={loc} />
      <div className="w-clock">
        <SpeedControl speed={speed} setSpeed={setSpeed} />
        <span className="num">{formatClock(game.hour, game.minute)}</span>
      </div>
      {editing && loc.space === "hall" && <HallStrip loc={loc} onDone={() => setEditing(false)} />}
      {panel?.kind === "storage" && <StoragePanel loc={loc} onClose={() => setPanel(null)} />}
      {panel?.kind === "power" && <PowerPanel loc={loc} title={panel.title} kind={panel.id ?? ""} onClose={() => setPanel(null)} />}
      {panel?.kind === "mainboard" && <MainBoardRoom loc={loc} title={panel.title} onClose={() => setPanel(null)} />}
      {panel?.kind === "meetme" && <MeetMeRoom loc={loc} title={panel.title} onClose={() => setPanel(null)} />}
      {panel?.kind === "post" && <PostPanel title={panel.title} onClose={() => setPanel(null)} />}
      {panel?.kind === "phone" && <PhonePanel title={panel.title} call={panel.call ?? null} cordless={cordless} onOpenRack={(id) => { setPanel(null); setRackOpen({ id }); }} onClose={() => setPanel(null)} />}
      {panel?.kind === "board" && <CorkboardPanel title={panel.title} onClose={() => setPanel(null)}
        spot={(k) => (k === "rack" ? (racks[0] ? { id: racks[0].id, name: racks[0].name } : null) : fx[k] ? { id: k, name: t(artOf(k, fx[k]).label ?? k) } : null)}
        onGlow={(id) => { setHint(id); setTimeout(() => setHint((v) => (v === id ? null : v)), HINT_MS); }} />}
      {panel?.kind === "tickets" && <TicketsPanel loc={loc} title={panel.title} onClose={() => setPanel(null)} />}
      {panel?.kind === "scan" && <ScanPanel title={panel.title} onClose={() => setPanel(null)} />}
      {rackOpen && <RackPanel key={rackOpen.id} rackId={rackOpen.id} port={rackOpen.port} hand={cable} onHand={setCable} onClose={() => setRackOpen(null)}
        onConnectFrom={(device) => { setFrom({ rack: rackOpen.id, device }); setRackOpen(null); }} />}
      {pair && <PairPanel key={`${pair.a} ${pair.b}`} a={pair.a} b={pair.b} from={pair.from} onClose={() => setPair(null)} />}
    </div>
  );
});

// Parcels drawn per stack before the count takes over.
const PARCEL_STACK = 3;
