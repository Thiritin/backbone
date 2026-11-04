// GDD, Own datacenter, Edit mode: the plan board puts every area of the hall location into edit mode. The player holds a part from
// the strip and places it, lays lines of it with a drag, selects with a click or a rectangle, moves, turns, copies and sells. Every
// hovered tile asks the sim's editHallError check and the ghost shows the footprint, the service front and the way to it.
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { t } from "../../i18n/en";
import { airTones, type AirTone } from "../../sim/60-infra/airflow";
import { areaAt, fixtures, footprint, exhaust, siteAreas, customerTiles, type Area, type Facing, type OfficePlan } from "../../sim/20-world/layout";
import { rackUnits } from "../../sim/20-world/datacenters";
import { HALL, isHalle, zoneSpots } from "../../sim/20-world/properties";
import type { GameState, HallItemKind, HallZone, Location, RackModel } from "../../sim/50-state";
import { editHall, editHallError, hallAt, type HallEdit, type HallPlace, type LayoutError } from "../../sim/90-actions/hall";
import { useStore } from "../store";
import { onX, pts, rackHeight, RackBox } from "./draw";
import { iso, type Pt } from "./grid";
import { Battery, Containment, Crac, CratedRack, Generator, NocDesk, NocLettering, Switchgear, Transformer, Ups, Vent, WallScreen } from "./hall-art";
import { dragLine, frontOf, key, tilesOf, turnParts, walkPath, type Part } from "./hall-edit-geom";
import { corner, itemTiles } from "./hall-annex";

// What a part is: a new or delivered rack, a zone, or an item of the layout.
export type Spec = { kind: "rack"; model: string; units: number; rackId?: string } | { kind: "zone"; zone: HallZone["kind"] } | { kind: HallItemKind };
// One part of a hold or a selection; `ref` names the placed object it moves, `length` is a zone's.
export interface Entry extends Part { spec: Spec; ref?: string; length?: number }
// What the pointer carries: parts fixed to the grabbed tile.
export interface Hold { entries: Entry[]; anchor: Pt; moving: boolean }
export type Tab = "racks" | "cooling" | "areas" | "rooms" | "power" | "delivered";

interface Edit {
  loc: string;
  hold: Hold | null;
  sel: string[];
  at: Pt | null;
  onStrip: boolean;
  line: { from: Pt; to: Pt } | null;
  box: { from: Pt; to: Pt } | null;
  msg: { text: string; at: Pt; n: number } | null;
  clip: Entry[];
  tab: Tab;
  // The NOC room outline is held on the floor, waiting for the click that builds it.
  room: boolean;
  open: (loc: string, hold: Hold | null) => void;
  escape: () => boolean;
}

const MSG_MS = 2000, ZONE_LEN: Record<HallZone["kind"], number> = { colo: 4, cage: 4, meetme: 3 };
let seq = 0;
export const useEdit = create<Edit>((set, get) => ({
  loc: "", hold: null, sel: [], at: null, onStrip: false, line: null, box: null, msg: null, clip: [], tab: "racks", room: false,
  open: (loc, hold) => set({ loc, hold, line: null, msg: null, room: false }),
  // Escape drops the hold first, then the selection; false when there was nothing to drop.
  escape: () => {
    const s = get();
    if (s.room) { set({ room: false }); return true; }
    if (s.hold) { set({ hold: null, line: null }); return true; }
    if (s.sel.length) { set({ sel: [] }); return true; }
    return false;
  },
}));

export const shout = (text: string, at: Pt) => {
  const n = ++seq;
  useEdit.setState({ msg: { text, at, n } });
  setTimeout(() => { if (useEdit.getState().msg?.n === n) useEdit.setState({ msg: null }); }, MSG_MS);
};

// ---- Parts and objects ----

export const extentOf = (p: Pt[]) => ({ w: Math.max(...p.map((q) => q.x)) + 1, h: Math.max(...p.map((q) => q.y)) + 1 });

export function entryOf(spec: Spec, facing: Facing, halle: boolean): Entry {
  const base = { spec, x: 0, y: 0, facing };
  if (spec.kind === "rack") return { ...base, fw: 1, fh: 1 };
  if (spec.kind === "zone") { const len = ZONE_LEN[spec.zone]; return sized({ ...base, fw: 1, fh: 1, length: len }, len); }
  if (HALL.items[spec.kind].layer === "wall") return { ...base, facing: "e", fw: 1, fh: HALL.items[spec.kind].w as number, wall: true };
  const e = extentOf(footprint(spec.kind, { x: 0, y: 0, facing }, halle));
  return { ...base, fw: e.w, fh: e.h };
}

// A zone entry of the given length lies along x when it faces n or s, along y otherwise.
const sized = (e: Entry, len: number): Entry => {
  const along = e.facing === "n" || e.facing === "s";
  return { ...e, length: len, fw: along ? len : 1, fh: along ? 1 : len };
};

interface Ctx { game: GameState; loc: Location; plan: OfficePlan; areas: Area[]; halle: boolean }
interface Obj { ref: string; entry: Entry; tiles: Pt[]; layer: "body" | "floor" | "zone"; height: number }

// Everything the player can select: own racks, every item and every zone. Customers and the exchange are never selectable.
function objectsOf(c: Ctx): Obj[] {
  const out: Obj[] = [], hall = c.plan.hall!;
  for (const r of c.game.racks) {
    if (r.locationId !== c.loc.id || !r.tile || r.provided) continue;
    out.push({ ref: `rack:${r.id}`, entry: { spec: { kind: "rack", model: r.model, units: rackUnits(r.model) }, ref: `rack:${r.id}`, x: r.tile.x, y: r.tile.y, fw: 1, fh: 1, facing: r.tile.facing }, tiles: [r.tile], layer: "body", height: rackHeight(rackUnits(r.model)) });
  }
  for (const i of hall.items) {
    const p = itemTiles(i, c.areas, c.halle), o = corner(p), wall = HALL.items[i.kind].layer === "wall", layer = HALL.items[i.kind].layer;
    const e = { x: Math.max(...p.map((q) => q.x)) - o.x + 1, y: Math.max(...p.map((q) => q.y)) - o.y + 1 };
    out.push({ ref: `item:${i.id}`, entry: { spec: { kind: i.kind }, ref: `item:${i.id}`, ...o, fw: e.x, fh: e.y, facing: i.facing, wall }, tiles: p, layer: layer === "body" ? "body" : "floor", height: 80 });
  }
  for (const z of hall.zones) {
    const sp = zoneSpots(z), along = z.facing === "n" || z.facing === "s";
    out.push({ ref: `zone:${z.id}`, entry: { spec: { kind: "zone", zone: z.kind }, ref: `zone:${z.id}`, x: z.x, y: z.y, fw: along ? z.length : 1, fh: along ? 1 : z.length, facing: z.facing, length: z.length }, tiles: sp, layer: "zone", height: 0 });
  }
  return out;
}

function ctxOf(locId: string): Ctx | null {
  const game = useStore.getState().game, at = hallAt(game, locId);
  if (!at) return null;
  const plan = { sections: [], hour: game.hour, floor: 1, hall: at.hall } as OfficePlan;
  return { game, loc: at.loc, plan, areas: siteAreas(game, at.loc), halle: isHalle(at.p.buildingId) };
}

// The floor tile under the pointer, through the room's own view transform.
function tileAt(e: { clientX: number; clientY: number }): Pt | null {
  const svg = document.querySelector<SVGSVGElement>(".world-svg"), ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: Math.floor((p.x / 32 + p.y / 16) / 2), y: Math.floor((p.y / 16 - p.x / 32) / 2) };
}

// A press on a tall body lands on a floor tile behind it; the object is the nearer tile whose body covers the pressed point.
function pick(e: { clientX: number; clientY: number }, p: Pt, objs: Obj[]): Obj | null {
  const svg = document.querySelector<SVGSVGElement>(".world-svg"), ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const s = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  const at = (layer: Obj["layer"], q: Pt) => objs.find((o) => o.layer === layer && o.tiles.some((tl) => key(tl) === key(q)));
  for (let k = 3; k >= 0; k--) {
    const q = { x: p.x + k, y: p.y + k }, o = at("body", q), c = iso(q.x + 0.5, q.y + 0.5);
    if (o && Math.abs(s.x - c.x) <= 30 && s.y <= c.y + 6 && s.y >= c.y - o.height) return o;
  }
  return at("floor", p) ?? at("zone", p) ?? null;
}

// ---- What a drop does ----

interface Verdict { edit: HallEdit; entries: Entry[]; error: LayoutError | null }

function shifted(e: Entry, dx: number, dy: number): Entry { return { ...e, x: e.x + dx, y: e.y + dy }; }

// The edit that putting the hold's parts down with its anchor on `at` makes. A line lays the single held part along the drag.
export function verdictOf(c: Ctx, h: Hold, at: Pt, line: Edit["line"]): Verdict {
  let entries: Entry[];
  const one = h.entries.length === 1 && !h.moving ? h.entries[0] : null;
  if (one && line && (line.from.x !== line.to.x || line.from.y !== line.to.y)) {
    if (one.spec.kind === "zone") {
      const spec = one.spec, along = one.facing === "n" || one.facing === "s", max = spec.zone === "cage" ? HALL.zones.cage.max : spec.zone === "meetme" ? HALL.zones.meetme.max : 12;
      const d = along ? line.to.x - line.from.x : line.to.y - line.from.y, perpendicular = Math.abs(along ? line.to.y - line.from.y : line.to.x - line.from.x) > Math.abs(d);
      const len = perpendicular ? one.length! : Math.max(1, Math.min(max, Math.abs(d) + 1)), start = d < 0 ? d : 0;
      entries = [shifted(sized(one, len), line.from.x - h.anchor.x + (along ? start : 0), line.from.y - h.anchor.y + (along ? 0 : start))];
    } else {
      entries = dragLine(line.from, line.to, one.fw, one.fh).map((p) => shifted(one, p.x - h.anchor.x, p.y - h.anchor.y));
    }
  } else entries = h.entries.map((e) => shifted(e, at.x - h.anchor.x, at.y - h.anchor.y));
  return { entries, ...editOf(c, entries) };
}

function editOf(c: Ctx, entries: Entry[]): { edit: HallEdit; error: LayoutError | null } {
  const move: NonNullable<HallEdit["move"]> = [], place: HallPlace[] = [];
  for (const e of entries) {
    let { x, y } = e, area: Area["id"] | undefined;
    if (e.spec.kind !== "rack" && e.spec.kind !== "zone") {
      const a = areaAt(c.areas, { x, y });
      if (!a) return { edit: {}, error: { key: "error.wrongRoom", at: { x, y } } };
      x -= a.rect.x; y -= a.rect.y; area = a.id;
    }
    if (e.ref) move.push({ ref: e.ref, x, y, facing: e.facing, area });
    else if (e.spec.kind === "rack") place.push({ kind: "rack", model: e.spec.model as RackModel, rackId: e.spec.rackId, x, y, facing: e.facing });
    else if (e.spec.kind === "zone") place.push({ kind: "zone", zone: e.spec.zone, length: e.length!, x, y, facing: e.facing });
    else place.push({ kind: e.spec.kind, area, x, y, facing: e.facing });
  }
  const edit: HallEdit = { move: move.length ? move : undefined, place: place.length ? place : undefined };
  return { edit, error: editHallError(c.game, c.loc.id, edit) };
}

const bodyKind = (s: Spec) => s.kind === "rack" || s.kind === "zone" || HALL.items[s.kind].layer === "body";

// Tiles with a body in the hall as it stands, without the objects in `skip`, and the fixtures that stand in the way.
function blockedOf(c: Ctx, skip: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const o of objectsOf(c)) if (!skip.has(o.ref) && o.entry.spec.kind !== "vent" && o.entry.spec.kind !== "containment" && bodyKind(o.entry.spec) && o.entry.spec.kind !== "screen") for (const q of o.tiles) out.add(key(q));
  for (const q of customerTiles(c.loc, c.plan)) out.add(key(q.tile));
  const ex = c.plan.hall!.exchange?.tile;
  if (ex) out.add(key(ex));
  for (const [id, f] of Object.entries(fixtures(c.loc, c.plan))) {
    if (f.kind === "noc" || f.kind === "cooling") continue;
    for (let i = 0; i < (f.w ?? 1) * (f.h ?? 1); i++) out.add(key({ x: f.x + (i % (f.w ?? 1)), y: f.y + Math.floor(i / (f.w ?? 1)) }));
    if (id === "door" || f.kind === "meetmedoor") out.add(key({ x: f.x + 1, y: f.y }));
  }
  return out;
}

const entryTile = (c: Ctx): Pt => { const d = fixtures(c.loc, c.plan).door; return { x: d.x + 1, y: d.y }; };

// ---- Gestures ----

type Gesture =
  | { kind: "place"; from: Pt }
  | { kind: "object"; ref: string; from: Pt; x: number; y: number; moved: boolean; shift: boolean }
  | { kind: "box"; from: Pt }
  | { kind: "bg"; x: number; y: number; shift: boolean };
let gesture: Gesture | null = null;

const overStrip = (e: { clientX: number; clientY: number }) => !!document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-strip]");

function selectionHold(c: Ctx, refs: string[], anchor: Pt): Hold | null {
  const entries = objectsOf(c).filter((o) => refs.includes(o.ref)).map((o) => o.entry);
  return entries.length ? { entries, anchor, moving: true } : null;
}

// Applies the edit the hold makes at `at`. A failure is shown at the tile the sim names.
function drop(c: Ctx, h: Hold, at: Pt, line: Edit["line"]): boolean {
  const v = verdictOf(c, h, at, line);
  if (v.error) { shout(t(v.error.key), v.error.at ?? at); return false; }
  const r = useStore.getState().attempt(editHall, c.loc.id, v.edit);
  if (!r.ok) { shout(t(r.error ?? "error.occupied"), at); return false; }
  return true;
}

function remove(c: Ctx, refs: string[], at: Pt): boolean {
  const edit: HallEdit = { remove: refs }, err = editHallError(c.game, c.loc.id, edit);
  if (err) { shout(t(err.key), err.at ?? at); return false; }
  const r = useStore.getState().attempt(editHall, c.loc.id, edit);
  if (!r.ok) shout(t(r.error ?? "error.occupied"), at);
  return r.ok;
}

function turnHold() {
  const { hold, sel, loc } = useEdit.getState();
  if (hold) { useEdit.setState({ hold: { ...hold, entries: turnParts(hold.entries, hold.anchor) as Entry[] } }); return; }
  const c = ctxOf(loc);
  if (!c || !sel.length) return;
  const first = objectsOf(c).find((o) => sel.includes(o.ref));
  if (!first) return;
  const pivot = { x: first.entry.x, y: first.entry.y }, h = selectionHold(c, sel, pivot);
  if (h) drop(c, { ...h, entries: turnParts(h.entries, pivot) as Entry[] }, pivot, null);
}

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
  const s = useEdit.getState(), k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (!mod && k === "r") { e.preventDefault(); turnHold(); return; }
  const c = ctxOf(s.loc);
  if (!c) return;
  if (mod && k === "c" && s.sel.length) {
    e.preventDefault();
    useEdit.setState({ clip: objectsOf(c).filter((o) => s.sel.includes(o.ref)).map((o) => ({ ...o.entry, ref: undefined })) });
  } else if (mod && k === "v" && s.clip.length) {
    e.preventDefault();
    const a = { x: s.clip[0].x, y: s.clip[0].y };
    useEdit.setState({ hold: { entries: s.clip, anchor: a, moving: false }, sel: [], line: null });
  } else if ((e.key === "Delete" || e.key === "Backspace") && s.sel.length) {
    e.preventDefault();
    const o = objectsOf(c).find((q) => s.sel.includes(q.ref));
    if (remove(c, s.sel, o ? { x: o.entry.x, y: o.entry.y } : { x: 0, y: 0 })) useEdit.setState({ sel: [] });
  }
}

function onMove(e: PointerEvent) {
  const s = useEdit.getState(), at = tileAt(e) ?? s.at, patch: Partial<Edit> = { at, onStrip: overStrip(e) };
  const g = gesture;
  if (g?.kind === "place" && at) patch.line = { from: g.from, to: at };
  if (g?.kind === "box" && at) patch.box = { from: g.from, to: at };
  if (g?.kind === "object" && !g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) {
    const c = ctxOf(s.loc);
    if (c) {
      g.moved = true;
      const refs = s.sel.includes(g.ref) ? s.sel : [g.ref], h = selectionHold(c, refs, g.from);
      if (h) { patch.hold = h; patch.sel = refs; }
    }
  }
  if (g?.kind === "bg" && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) gesture = null;
  useEdit.setState(patch);
}

function onUp(e: PointerEvent) {
  const g = gesture, s = useEdit.getState(), at = tileAt(e) ?? s.at;
  gesture = null;
  if (!g) return;
  const c = ctxOf(s.loc);
  if (!c) return;
  if (g.kind === "place" && s.hold && at) {
    drop(c, s.hold, at, s.line);
    useEdit.setState({ line: null });
  } else if (g.kind === "object") {
    if (g.moved && s.hold) {
      const refs = s.hold.entries.map((q) => q.ref!);
      if (overStrip(e)) { if (remove(c, refs, g.from)) useEdit.setState({ sel: [] }); }
      else if (at) drop(c, s.hold, at, null);
      useEdit.setState({ hold: null });
    } else if (g.shift) useEdit.setState({ sel: s.sel.includes(g.ref) ? s.sel.filter((r) => r !== g.ref) : [...s.sel, g.ref] });
    else useEdit.setState({ sel: [g.ref] });
  } else if (g.kind === "box" && s.box) {
    const x0 = Math.min(s.box.from.x, s.box.to.x), x1 = Math.max(s.box.from.x, s.box.to.x), y0 = Math.min(s.box.from.y, s.box.to.y), y1 = Math.max(s.box.from.y, s.box.to.y);
    const inside = objectsOf(c).filter((o) => o.tiles.some((q) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1)).map((o) => o.ref);
    useEdit.setState({ sel: [...new Set([...s.sel, ...inside])], box: null });
  } else if (g.kind === "bg" && !g.shift) useEdit.setState({ sel: [] });
}

// ---- Drawing ----

const Quad = ({ p, cls }: { p: Pt; cls: string }) => <polygon className={cls} points={pts(iso(p.x, p.y), iso(p.x + 1, p.y), iso(p.x + 1, p.y + 1), iso(p.x, p.y + 1))} pointerEvents="none" />;

// The grid of every area and the layer that takes the presses on the floor, among the room's depth-sorted things.
export function editThings(game: GameState, loc: Location, plan: OfficePlan, push: (depth: number, node: ReactNode) => void): void {
  if (!plan.hall) return;
  const lines: string[] = [];
  for (const a of siteAreas(game, loc)) {
    const { x, y, w, h } = a.rect;
    for (let i = 0; i <= w; i++) lines.push(`M${pts(iso(x + i, y))} L${pts(iso(x + i, y + h))}`);
    for (let j = 0; j <= h; j++) lines.push(`M${pts(iso(x, y + j))} L${pts(iso(x + w, y + j))}`);
  }
  push(-3, <path key="egrid" className="w-edit-grid" d={lines.join(" ")} pointerEvents="none" />);
  push(-1.4, <EditFloor key="efloor" game={game} loc={loc} plan={plan} />);
  push(1e8, <EditLayer key="elayer" game={game} loc={loc} plan={plan} />);
}

function GhostArt({ e, halle, ok }: { e: Entry; halle: boolean; ok: boolean }) {
  const s = e.spec, p = { x: e.x, y: e.y, facing: e.facing, ghost: true };
  if (s.kind === "rack") return s.rackId ? <CratedRack {...p} /> : <RackBox tile={{ x: e.x, y: e.y, facing: e.facing }} units={s.units} items={[]} leds={[]} zoomed={false} />;
  if (s.kind === "zone") return <>{tilesOf(e).map((q) => <polygon key={key(q)} className={`w-zone-${s.zone}`} points={pts(iso(q.x, q.y), iso(q.x + 1, q.y), iso(q.x + 1, q.y + 1), iso(q.x, q.y + 1))} />)}</>;
  switch (s.kind) {
    case "crac": return <Crac {...p} />;
    case "vent": return <Vent x={e.x} y={e.y} reach={ok} ghost />;
    case "containment": return <Containment x={e.x} y={e.y} ghost />;
    case "transformer": return <Transformer {...p} size={halle ? "halle" : "office"} />;
    case "switchgear": return <Switchgear {...p} />;
    case "generator": return <Generator {...p} />;
    case "ups": return <Ups {...p} running={false} />;
    case "battery": return <Battery {...p} />;
    case "nocdesk": return <NocDesk {...p} seats={HALL.items.nocdesk.seats ?? 2} occupied={[]} />;
    case "screen": return <WallScreen y={e.y} state="ok" ghost />;
  }
}

const centre = (q: Pt) => iso(q.x + 0.5, q.y + 0.5);

interface View { v: Verdict | null; bad: boolean; footprintTiles: Pt[]; fronts: Pt[]; exh: Pt[]; cut: Set<string>; pathD: string; blockedKey: string | null; selTiles: Pt[]; boxTiles: Pt[]; ghostAir: [Pt, AirTone][] }

// The air the hall would have after the drop: the edit runs on a copy of the state, never the store's.
let airCache: { game: GameState; sig: string; tones: [Pt, AirTone][] } | null = null;
function ghostTones(c: Ctx, edit: HallEdit): [Pt, AirTone][] {
  const sig = JSON.stringify(edit);
  if (airCache && airCache.game === c.game && airCache.sig === sig) return airCache.tones;
  const copy = structuredClone(c.game), loc = copy.locations.find((l) => l.id === c.loc.id);
  let tones: [Pt, AirTone][] = [];
  if (loc && editHall(copy, loc.id, edit).ok) {
    const was = airTones(c.game, c.loc), now = airTones(copy, loc);
    tones = Object.entries(now).filter(([k, v]) => was[k] !== v && v !== "room" && v !== "ventIdle").map(([k, v]) => { const [x, y] = k.split(",").map(Number); return [{ x, y }, v] as [Pt, AirTone]; });
  }
  airCache = { game: c.game, sig, tones };
  return tones;
}

// Everything the edit state draws on the floor: footprint, fronts, the way from the door, selection and the air the drop would give.
function useView(c: Ctx | null, objs: Obj[]): View {
  const { hold, sel, at, onStrip, line, box } = useEdit();
  const none: View = { v: null, bad: false, footprintTiles: [], fronts: [], exh: [], cut: new Set(), pathD: "", blockedKey: null, selTiles: [], boxTiles: [], ghostAir: [] };
  if (!c) return none;
  const v = hold && at && !onStrip ? verdictOf(c, hold, at, line) : null;
  const bad = !!v?.error;
  const footprintTiles = v ? v.entries.flatMap((e) => tilesOf(e)) : [];
  // Service fronts, exhaust tiles and the way from the door to every front.
  const fronts: Pt[] = [], exh: Pt[] = [], edges = new Set<string>(), cut = new Set<string>();
  if (v) {
    const skip = new Set(v.entries.flatMap((e) => (e.ref ? [e.ref] : []))), blocked = blockedOf(c, skip), entry = entryTile(c);
    const bodies = v.entries.filter((e) => bodyKind(e.spec) && e.spec.kind !== "screen");
    for (const e of bodies) for (const q of tilesOf(e)) blocked.add(key(q));
    blocked.delete(key(entry));
    for (const a of c.areas) for (const q of a.passages) blocked.delete(key(q.tile));
    const seen = new Set<string>();
    for (const e of bodies) {
      for (const f of frontOf(tilesOf(e), e.facing)) {
        if (seen.has(key(f))) continue;
        seen.add(key(f)); fronts.push(f);
        const path = walkPath(c.areas, blocked, entry, f);
        if (!path || blocked.has(key(f))) cut.add(key(f));
        else path.forEach((q, i) => { if (i) edges.add(`${path[i - 1].x},${path[i - 1].y}>${q.x},${q.y}`); });
      }
      if (e.spec.kind === "rack") for (const q of tilesOf(e)) exh.push(exhaust({ ...q, facing: e.facing }));
    }
  }
  const blockedKey = v?.error && (v.error.key === "error.blocked" || v.error.key === "error.noPath") ? v.error.key : null;
  const pathD = [...edges].map((k) => { const [a, b] = k.split(">").map((s) => s.split(",").map(Number)); const p = centre({ x: a[0], y: a[1] }), q = centre({ x: b[0], y: b[1] }); return `M${p.x} ${p.y}L${q.x} ${q.y}`; }).join("");
  const selTiles = objs.filter((o) => sel.includes(o.ref)).flatMap((o) => o.tiles);
  const boxTiles: Pt[] = [];
  if (box) for (let x = Math.min(box.from.x, box.to.x); x <= Math.max(box.from.x, box.to.x); x++) for (let y = Math.min(box.from.y, box.to.y); y <= Math.max(box.from.y, box.to.y); y++) boxTiles.push({ x, y });
  const ghostAir = v && !v.error ? ghostTones(c, v.edit) : [];
  return { v, bad, footprintTiles, fronts, exh, cut, pathD, blockedKey, selTiles, boxTiles, ghostAir };
}

// The floor pieces of edit mode sit among the room's depth-sorted things, so racks and items stand over them.
function EditFloor({ game, loc, plan }: { game: GameState; loc: Location; plan: OfficePlan }) {
  const a = hallAt(game, loc.id), c: Ctx | null = a ? { game, loc, plan, areas: siteAreas(game, loc), halle: isHalle(a.p.buildingId) } : null;
  const view = useView(c, c ? objectsOf(c) : []);
  if (!c) return null;
  const { v, bad, fronts, exh, cut, blockedKey, footprintTiles, pathD, selTiles, boxTiles, ghostAir } = view;
  return (
    <g pointerEvents="none">
      {selTiles.map((q) => <Quad key={`s${key(q)}`} p={q} cls="w-edit-sel" />)}
      {boxTiles.map((q) => <Quad key={`b${key(q)}`} p={q} cls="w-edit-box" />)}
      {ghostAir.map(([q, tone]) => <Quad key={`a${key(q)}`} p={q} cls={`w-air-${tone}`} />)}
      {v && <>
        {exh.map((q) => <Quad key={`x${key(q)}`} p={q} cls="w-edit-exhaust" />)}
        {fronts.map((q) => <Quad key={`f${key(q)}`} p={q} cls={cut.has(key(q)) || (blockedKey && v.error?.at && key(v.error.at) === key(q)) ? "w-edit-clear-bad" : "w-edit-clear"} />)}
        {blockedKey && v.error?.at && !fronts.some((q) => key(q) === key(v.error!.at!)) && <Quad p={v.error.at} cls="w-edit-clear-bad" />}
        {pathD && <path className="w-edit-path" d={pathD} />}
        {footprintTiles.map((q) => <Quad key={`g${key(q)}`} p={q} cls={bad ? "w-edit-bad" : "w-edit-ok"} />)}
      </>}
    </g>
  );
}

function EditLayer({ game, loc, plan }: { game: GameState; loc: Location; plan: OfficePlan }) {
  const { msg, room } = useEdit();
  useEffect(() => {
    useEdit.setState({ loc: loc.id });
    const menu = (e: Event) => { if (document.querySelector(".world-svg")?.contains(e.target as Node) || useEdit.getState().hold) { e.preventDefault(); turnHold(); } };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", menu);
      gesture = null;
      useEdit.setState({ hold: null, sel: [], line: null, box: null, at: null, onStrip: false, msg: null, room: false });
    };
  }, [loc.id]);

  const c: Ctx | null = (() => { const a = hallAt(game, loc.id); return a ? { game, loc, plan, areas: siteAreas(game, loc), halle: isHalle(a.p.buildingId) } : null; })();
  if (!c) return null;
  const objs = objectsOf(c);

  const press = (e: React.PointerEvent) => {
    if (e.button) return;
    const p = tileAt(e);
    if (!p) return;
    const st = useEdit.getState();
    if (st.hold) { e.stopPropagation(); e.preventDefault(); gesture = { kind: "place", from: p }; useEdit.setState({ at: p, line: { from: p, to: p } }); return; }
    const hit = pick(e, p, objs);
    if (hit) {
      e.stopPropagation(); e.preventDefault();
      gesture = { kind: "object", ref: hit.ref, from: p, x: e.clientX, y: e.clientY, moved: false, shift: e.shiftKey };
      if (!e.shiftKey && !st.sel.includes(hit.ref)) useEdit.setState({ sel: [hit.ref] });
    } else if (e.shiftKey) { e.stopPropagation(); e.preventDefault(); gesture = { kind: "box", from: p }; useEdit.setState({ box: { from: p, to: p } }); }
    else gesture = { kind: "bg", x: e.clientX, y: e.clientY, shift: false };
  };

  const { v, bad } = useView(c, objs);
  const bounds = c.areas.map((a) => a.rect);
  const hallRect = c.areas.find((a) => a.id === "hall")?.rect, ghost = room && hallRect && !c.areas.some((a) => a.id === "noc") ? { x: 0, y: hallRect.h, w: HALL.noc.w, h: HALL.noc.d } : null;
  const build = (e: React.PointerEvent) => {
    if (e.button) return;
    e.stopPropagation(); e.preventDefault();
    const at = { x: 3, y: hallRect!.h };
    const r = useStore.getState().attempt(editHall, c.loc.id, { place: [{ kind: "noc", x: 0, y: 0, facing: "s" }] });
    if (r.ok) useEdit.setState({ room: false, tab: "rooms" });
    else shout(t(r.error ?? "error.occupied"), at);
  };

  return (
    <g>
      {bounds.map((r, i) => <g key={i}>
        <polygon points={pts(iso(r.x, r.y), iso(r.x + r.w, r.y), iso(r.x + r.w, r.y + r.h), iso(r.x, r.y + r.h))} fill="rgba(0,0,0,0)" onPointerDown={press} />
        {/* Units on the far wall stand taller than the floor, so a press on their upper body lands on the wall. */}
        {r.y === 0 && <polygon points={pts(iso(r.x, 0), iso(r.x + r.w, 0), { x: iso(r.x + r.w, 0).x, y: iso(r.x + r.w, 0).y - 100 }, { x: iso(r.x, 0).x, y: iso(r.x, 0).y - 100 })} fill="rgba(0,0,0,0)" onPointerDown={press} />}
      </g>)}
      {ghost && <g role="button" aria-label={t("hall.room.noc")} className="w-edit-room" onPointerDown={build}>
        <polygon points={pts(iso(ghost.x, ghost.y), iso(ghost.x + ghost.w, ghost.y), iso(ghost.x + ghost.w, ghost.y + ghost.h), iso(ghost.x, ghost.y + ghost.h))} />
        <NocLettering y={ghost.y} len={ghost.h} ghost />
      </g>}
      {v && <>
        <g className="w-edit-ghost" pointerEvents="none">
          {[...v.entries].sort((a, b) => a.x + a.y - b.x - b.y).map((e, i) => <g key={i}><GhostArt e={e} halle={c.halle} ok={!bad} /></g>)}
        </g>
      </>}
      {msg && (
        <g pointerEvents="none" transform={`translate(${centre(msg.at).x} ${centre(msg.at).y - 58})`}>
          <rect className="w-edit-msg" x={-5 - msg.text.length * 2.6} y="-10" width={10 + msg.text.length * 5.2} height="14" />
          <text className="w-edit-msg-t" x="0" y="0">{msg.text}</text>
        </g>
      )}
    </g>
  );
}

// The floor plan on the wall beside the door; clicking it enters edit mode.
export function PlanBoard({ f }: { f: { y: number } }) {
  return (
    <g transform={onX(0, f.y + 0.4, 66)}>
      <rect className="w-plan-frame" x="0" y="0" width="26" height="19" rx="1" />
      <rect className="w-plan-paper" x="2" y="2" width="22" height="15" />
      {[0, 1, 2].map((i) => <rect key={i} className="w-plan-row" x="4" y={4.5 + i * 4} width={i === 1 ? 12 : 16} height="2" />)}
      <rect className="w-plan-cool" x="19" y="4.5" width="3" height="10" />
    </g>
  );
}

