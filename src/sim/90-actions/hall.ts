// GDD, Own datacenter: what the player lays out in a hall of their own. Racks, zones and items stand on tiles with a facing
// inside the location's areas; one validator checks a whole candidate layout and one action applies any edit.
import { areaAt, areasOf, footprint, hallRoom, hallSize, intake, type Area, type Facing, type Pt, type Tile } from "../20-world/layout";
import { euro } from "../00-core/money";
import { hashRng, rand } from "../00-core/rng";
import { carriersAt, EXCHANGES, exchangeAt, type Carrier } from "../10-catalog/network";
import { DATACENTERS, RACK_MODELS } from "../20-world/datacenters";
import { access, customerSpots, HALL, hallCapacity, hallKw, hallSpots, isHalle, stepTile, zoneSpots } from "../20-world/properties";
import { cents } from "../45-billing/billing";
import type { AreaId, GameState, Hall, HallItem, HallItemKind, HallZone, Location, Property, Rack, RackModel } from "../50-state";
import { yearOf } from "../00-core/time";
import { freeJack, jackRoles, panelOf } from "../60-infra/panels";
import { freePositions, roomPower } from "../60-infra/status";
import { t } from "../../i18n/en";
import type { SimEvent } from "../88-tick/tick";
import { buyRack, sellRack, type ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const pay = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key, params, amount: -amount }];
};
const refund = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key, params, amount }];
};
const tileKey = (t: { x: number; y: number }) => `${t.x},${t.y}`;

export function hallAt(s: GameState, locationId: string): { p: Property; hall: Hall; loc: Location } | null {
  const p = s.properties.find((x) => x.hall?.locationId === locationId), loc = s.locations.find((l) => l.id === locationId);
  return p?.hall && loc ? { p, hall: p.hall, loc } : null;
}
type HallAt = NonNullable<ReturnType<typeof hallAt>>;

const hasDevices = (s: GameState, rackId: string) => s.devices.some((d) => d.rackId === rackId);
// A rack with devices goes dark while it is moved.
export const darken = (s: GameState, rack: Rack): void => { if (hasDevices(s, rack.id)) rack.arriveAt = s.hour + HALL.moveHours; };

// ---- Layout: the part of a hall the player edits ----

// Racks by id with their tile (null while delivered), the placed items, the zones and whether the NOC room stands.
export interface Layout { racks: Record<string, Tile | null>; items: HallItem[]; zones: HallZone[]; noc: boolean }
export interface LayoutError { key: string; at: Pt | null }

export const currentLayout = (s: GameState, h: HallAt): Layout => ({
  racks: Object.fromEntries(s.racks.filter((r) => r.locationId === h.loc.id).map((r) => [r.id, r.tile ?? null])),
  items: h.hall.items, zones: h.hall.zones, noc: h.hall.noc,
});

interface Ctx { h: HallAt; areas: Area[]; halle: boolean; fixed: Set<string>; entry: Pt; size: { w: number; h: number } }
function ctxOf(h: HallAt, noc: boolean): Ctx {
  const halle = isHalle(h.p.buildingId), cap = hallCapacity(h.p), size = hallSize(cap, halle);
  const room = hallRoom({ ...h.hall, noc }, cap, halle), areas = areasOf(size, noc), fixed = new Set<string>();
  for (const [id, f] of Object.entries(room.fixtures)) {
    if (f.kind === "noc" || f.kind === "cooling") continue;
    for (let i = 0; i < (f.w ?? 1) * (f.h ?? 1); i++) fixed.add(tileKey({ x: f.x + (i % (f.w ?? 1)), y: f.y + Math.floor(i / (f.w ?? 1)) }));
    if (id === "door" || f.kind === "meetmedoor") fixed.add(tileKey({ x: f.x + 1, y: f.y }));
  }
  for (const a of areas) for (const p of a.passages) fixed.add(tileKey(p.tile));
  const door = room.fixtures.door;
  return { h, areas, halle, fixed, entry: { x: door.x + 1, y: door.y }, size };
}

const areaOf = (c: Ctx, id: AreaId) => c.areas.find((a) => a.id === id);
const WALL_KINDS = new Set<HallItemKind>(["screen"]);
const layerOf = (kind: HallItemKind) => HALL.items[kind].layer;

// Scene tiles an item covers; a wall item runs w tiles down its area's left wall.
function itemPts(c: Ctx, i: HallItem): Pt[] {
  const a = areaOf(c, i.area);
  if (!a) return [];
  if (WALL_KINDS.has(i.kind)) return Array.from({ length: HALL.items[i.kind].w as number }, (_, k) => ({ x: a.rect.x + i.x, y: a.rect.y + i.y + k }));
  return footprint(i.kind, i, c.halle, a.rect);
}

// The tiles in front of an object's footprint, as wide as the footprint and one deep, two for large gear.
function frontOf(pts: Pt[], facing: Facing): Pt[] {
  const depth = pts.length >= HALL.service.largeTiles ? HALL.service.largeDepth : 1;
  const edge = facing === "s" ? Math.max(...pts.map((p) => p.y)) : facing === "n" ? Math.min(...pts.map((p) => p.y)) : facing === "e" ? Math.max(...pts.map((p) => p.x)) : Math.min(...pts.map((p) => p.x));
  const along = facing === "n" || facing === "s";
  return pts.filter((p) => (along ? p.y : p.x) === edge).flatMap((p) => Array.from({ length: depth }, (_, k) => stepTile(p, facing, k + 1)));
}

interface Body { ref: string; pts: Pt[]; front: Pt[]; kind: string }

// Everything with a body in the layout: racks, zone tiles, customers and the exchange off their zones, and the body items.
function bodiesOf(c: Ctx, l: Layout): Body[] {
  const h = c.h.hall, out: Body[] = [];
  for (const [id, t] of Object.entries(l.racks)) if (t) out.push({ ref: `rack:${id}`, pts: [t], front: [intake(t)], kind: "rack" });
  const zoneTiles = new Set(l.zones.flatMap(zoneSpots).map(tileKey));
  for (const z of l.zones) for (const t of zoneSpots(z)) out.push({ ref: `zone:${z.id}`, pts: [t], front: [intake(t)], kind: "zone" });
  for (const x of [...h.customers.flatMap((cu) => customerSpots(h, cu)), ...(h.exchange?.tile ? [h.exchange.tile] : [])])
    if (!zoneTiles.has(tileKey(x))) out.push({ ref: "locked", pts: [x], front: [intake(x)], kind: "rack" });
  for (const i of l.items) if (layerOf(i.kind) === "body") { const pts = itemPts(c, i); out.push({ ref: `item:${i.id}`, pts, front: frontOf(pts, i.facing), kind: i.kind }); }
  return out;
}

// Tiles reachable on foot from the tile inside the entry door, with each tile's predecessor. Passages join areas.
function walk(c: Ctx, blocked: Set<string>, from: Pt): Map<string, string | null> {
  const seen = new Map<string, string | null>([[tileKey(from), null]]), queue: Pt[] = [from];
  const link = (a: Pt, b: Pt, aa: Area, ba: Area) => aa.passages.some((p) => p.to === ba.id && tileKey(p.tile) === tileKey(a)) && ba.passages.some((p) => p.to === aa.id && tileKey(p.tile) === tileKey(b));
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], pa = areaAt(c.areas, p)!;
    for (const f of ["n", "e", "s", "w"] as Facing[]) {
      const q = stepTile(p, f), qa = areaAt(c.areas, q);
      if (!qa || seen.has(tileKey(q)) || blocked.has(tileKey(q)) || (qa !== pa && !link(p, q, pa, qa))) continue;
      seen.set(tileKey(q), tileKey(p));
      queue.push(q);
    }
  }
  return seen;
}

const blockedOf = (c: Ctx, bodies: Body[]): Set<string> => new Set([...bodies.flatMap((b) => b.pts.map(tileKey)), ...[...c.fixed].filter((k) => !isPassageOrInside(c, k))]);
const isPassageOrInside = (c: Ctx, k: string): boolean => {
  const [x, y] = k.split(",").map(Number);
  return c.areas.some((a) => a.passages.some((p) => p.tile.x === x && p.tile.y === y)) || (x === c.entry.x && y === c.entry.y) || (x === 1 && y === 3);
};

// The way on foot between two tiles of the hall as it stands, tile by tile, or null.
export function hallPath(s: GameState, locationId: string, from: Pt, to: Pt): Pt[] | null {
  const h = hallAt(s, locationId);
  if (!h) return null;
  const c = ctxOf(h, h.hall.noc), seen = walk(c, blockedOf(c, bodiesOf(c, currentLayout(s, h))), from);
  if (!seen.has(tileKey(to))) return null;
  const path: Pt[] = [];
  for (let k: string | null = tileKey(to); k; k = seen.get(k) ?? null) { const [x, y] = k.split(",").map(Number); path.unshift({ x, y }); }
  return path;
}

// Bodies whose service front is blocked, outside their area or cut off from the entry door: rule 4 failures first, then rule 5.
function frontErrors(c: Ctx, bodies: Body[], solid: Set<string>): { body: Body; err: LayoutError }[] {
  const seen = walk(c, solid, c.entry), out: { body: Body; err: LayoutError }[] = [];
  for (const rule of [4, 5]) for (const body of bodies) for (const f of body.front) {
    const a = areaAt(c.areas, body.pts[0]), fa = areaAt(c.areas, f);
    const key = !fa || fa !== a || solid.has(tileKey(f)) ? "error.blocked" : !seen.has(tileKey(f)) ? "error.noPath" : null;
    if (key && (key === "error.blocked") === (rule === 4)) out.push({ body, err: { key: body.ref.startsWith("item:") ? "error.noAccess" : key, at: f } });
  }
  return out;
}

// The racks and items that have no service front or no way to it, as "rack:<id>" and "item:<id>". Old crammed halls load with these.
export function unmaintained(s: GameState, locationId: string): string[] {
  const h = hallAt(s, locationId);
  if (!h) return [];
  const l = currentLayout(s, h), c = ctxOf(h, l.noc), bodies = bodiesOf(c, l), bodyAt = new Set(bodies.flatMap((b) => b.pts.map(tileKey)));
  const solid = new Set([...bodyAt, ...c.fixed].filter((k) => !isPassageOrInside(c, k)));
  return [...new Set(frontErrors(c, bodies, solid).map((e) => e.body.ref).filter((r) => r !== "locked"))];
}

access.cut = (s, id) => new Set(unmaintained(s, id).map((r) => r.slice(5)));

// Decision 3, rules 1 to 7, over a whole candidate layout: first failure wins.
export function hallLayoutError(s: GameState, locationId: string, layout?: Layout): LayoutError | null {
  const h = hallAt(s, locationId);
  if (!h) return { key: "error.unknownLocation", at: null };
  const l = layout ?? currentLayout(s, h), c = ctxOf(h, l.noc), bodies = bodiesOf(c, l);
  const err = (key: string, at: Pt | null): LayoutError => ({ key, at });
  // 1. Every tile inside an area that takes the kind.
  const inArea = (pts: Pt[], kind: string, area: AreaId): Pt | null => pts.find((p) => { const a = areaAt(c.areas, p); return !a || a.id !== area || !a.accepts.includes(kind); }) ?? null;
  for (const b of bodies) if (b.ref !== "locked") { const bad = inArea(b.pts, b.kind, b.ref.startsWith("item:") ? l.items.find((i) => `item:${i.id}` === b.ref)!.area : "hall"); if (bad) return err("error.wrongRoom", bad); }
  for (const i of l.items) if (!areaOf(c, i.area)) return err("error.wrongRoom", null);
  for (const i of l.items) if (layerOf(i.kind) !== "body") { const bad = inArea(itemPts(c, i), i.kind, i.area); if (bad) return err("error.wrongRoom", bad); }
  for (const i of l.items) if (WALL_KINDS.has(i.kind) && i.x !== 0) return err("error.wrongRoom", itemPts(c, i)[0] ?? null);
  // 2 and 3. Bodies overlap neither each other, zone tiles, fixtures, door tiles nor locked spots; one vent, one containment and one wall item per tile.
  const zoneAt = new Map(l.zones.flatMap((z) => zoneSpots(z).map((t) => [tileKey(t), z] as const)));
  const seated = new Set<string>(), owner = new Map<string, string>();
  const locked = new Set<string>([...h.hall.customers.flatMap((cu) => customerSpots(h.hall, cu)), ...(h.hall.exchange?.tile ? [h.hall.exchange.tile] : [])].map(tileKey));
  for (const b of bodies) for (const p of b.pts) {
    const k = tileKey(p), z = zoneAt.get(k);
    if (c.fixed.has(k)) return err("error.occupied", p);
    if (b.kind === "zone") { if (owner.has(k)) return err("error.occupied", p); owner.set(k, b.ref); continue; }
    if (b.kind === "rack" && b.ref.startsWith("rack:") && z) {
      if (z.kind !== "meetme" || seated.has(k) || locked.has(k)) return err("error.occupied", p);
      seated.add(k);
      continue;
    }
    if (b.ref === "locked") continue;
    if (owner.has(k) || (z && b.kind !== "zone")) return err("error.occupied", p);
    owner.set(k, b.ref);
  }
  const bodyAt = new Set([...owner.keys(), ...seated]);
  const stacked = new Set<string>();
  for (const i of l.items) {
    if (layerOf(i.kind) === "body") continue;
    for (const p of itemPts(c, i)) {
      const k = `${i.kind}@${tileKey(p)}`;
      if (stacked.has(k) || (layerOf(i.kind) !== "wall" && (bodyAt.has(tileKey(p)) || c.fixed.has(tileKey(p)) || zoneAt.has(tileKey(p))))) return err("error.occupied", p);
      stacked.add(k);
    }
  }
  // 4 and 5. Every service front is free and joined to the entry door.
  const bad = frontErrors(c, bodies, new Set([...bodyAt, ...c.fixed].filter((k) => !isPassageOrInside(c, k))));
  if (bad.length) return bad[0].err;
  // 6. Rack spots.
  if (hallSpots(h.hall, l.racks, l.zones) > hallCapacity(h.p)) return err("error.hallFull", null);
  // 7. Limits.
  const n = (k: HallItemKind) => l.items.filter((i) => i.kind === k).length, floors = new Set(h.p.sections.filter((x) => x.fit === "hall").map((x) => x.floor)).size;
  if (n("transformer") > HALL.items.transformer.perFloor! * floors || n("switchgear") > HALL.items.switchgear.max! || n("screen") > HALL.items.screen.max! || l.zones.filter((z) => z.kind === "meetme").length > 1) return err("error.limit", null);
  return null;
}

// Puts an item on the first spot of an area the validator accepts. Used by the refit and the old-save load.
// ponytail: row-major scan; an area too full for it takes the item on its corner anyway so the power it gives is not lost.
export function packArea(s: GameState, locationId: string, kind: HallItemKind, area: AreaId, price: number): HallItem {
  const h = hallAt(s, locationId)!, c = ctxOf(h, h.hall.noc), a = areaOf(c, area)!, l = currentLayout(s, h);
  const make = (x: number, y: number, facing: Facing): HallItem => ({ id: `item${s.nextId}`, kind, area, x, y, facing, price, builtAt: s.hour });
  let item = make(0, 0, "s");
  search: for (let y = 0; y < a.rect.h; y++) for (let x = 0; x < a.rect.w; x++) for (const f of ["s", "n", "e", "w"] as Facing[]) {
    const cand = make(x, y, f);
    if (!hallLayoutError(s, locationId, { ...l, items: [...l.items, cand] })) { item = cand; break search; }
  }
  s.nextId++;
  h.hall.items = [...h.hall.items, item];
  return item;
}

// ---- Edits ----

type At = { x: number; y: number; facing: Facing; area?: AreaId };
export type HallPlace = At & ({ kind: "rack"; model?: RackModel; rackId?: string } | { kind: HallItemKind } | { kind: "zone"; zone: HallZone["kind"]; length: number } | { kind: "noc" });
export interface HallEdit {
  place?: HallPlace[];
  // ref is "rack:<id>", "item:<id>" or "zone:<id>"; x and y are local to the item's area.
  move?: (At & { ref: string })[];
  remove?: string[];
}

export const fenceCost = (z: Pick<HallZone, "kind" | "length">): number => (z.kind === "cage" ? z.length * HALL.zones.cage.perPosition : z.kind === "meetme" ? HALL.zones.meetme.price : 0);
const FACINGS = ["n", "e", "s", "w"];
const rackPrice = (model: RackModel) => RACK_MODELS.find((m) => m.id === model)?.price ?? 0;

// The tile of a rack on a meet-me zone takes the zone's facing.
const settle = (zones: HallZone[], a: At): Tile => {
  const z = zones.find((q) => q.kind === "meetme" && zoneSpots(q).some((t) => t.x === a.x && t.y === a.y));
  return { x: a.x, y: a.y, facing: z ? z.facing : a.facing };
};

interface Plan { layout: Layout; cost: number; sell: string[]; refunds: number; buy: { id: string; model: RackModel; tile: Tile }[]; newItems: HallItem[]; newZones: HallZone[]; building: boolean; moved: string[]; removedItems: HallItem[]; removedZones: HallZone[] }

// Builds the layout an edit would give, or the reason it cannot.
function planOf(s: GameState, h: HallAt, edit: HallEdit): Plan | LayoutError {
  const l = currentLayout(s, h), racks = { ...l.racks };
  let items = [...l.items], zones = [...l.zones], noc = l.noc, cost = 0, refunds = 0;
  const plan: Plan = { layout: l, cost: 0, sell: [], refunds: 0, buy: [], newItems: [], newZones: [], building: false, moved: [], removedItems: [], removedZones: [] };
  const bad = (key: string): LayoutError => ({ key, at: null });
  for (const ref of edit.remove ?? []) {
    const [kind, id] = ref.split(":");
    if (kind === "rack") {
      if (!(id in racks)) return bad("error.unknownRack");
      if (hasDevices(s, id)) return bad("error.notEmpty");
      delete racks[id]; plan.sell.push(id);
    } else if (kind === "item") {
      const i = items.find((x) => x.id === id);
      if (!i) return bad("error.unknownItem");
      items = items.filter((x) => x !== i); plan.removedItems.push(i); refunds += i.price * HALL.refund;
    } else if (kind === "zone") {
      const z = zones.find((x) => x.id === id);
      if (!z) return bad("error.unknownZone");
      zones = zones.filter((x) => x !== z); plan.removedZones.push(z); refunds += fenceCost(z) * HALL.zones.refund;
    } else return bad("error.unknownItem");
  }
  for (const m of edit.move ?? []) {
    const [kind, id] = m.ref.split(":");
    if (!FACINGS.includes(m.facing)) return bad("error.badZone");
    if (kind === "rack") {
      if (!(id in racks)) return bad("error.unknownRack");
      racks[id] = settle(zones, m); plan.moved.push(m.ref);
    } else if (kind === "item") {
      if (!items.some((x) => x.id === id)) return bad("error.unknownItem");
      items = items.map((x) => (x.id === id ? { ...x, x: m.x, y: m.y, facing: m.facing, area: m.area ?? x.area } : x)); plan.moved.push(m.ref);
    } else if (kind === "zone") {
      if (!zones.some((x) => x.id === id)) return bad("error.unknownZone");
      zones = zones.map((x) => (x.id === id ? { ...x, x: m.x, y: m.y, facing: m.facing } : x)); plan.moved.push(m.ref);
    } else return bad("error.unknownItem");
  }
  let n = 0;
  for (const p of edit.place ?? []) {
    if (!FACINGS.includes(p.facing) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return bad("error.badZone");
    if (p.kind === "rack") {
      if (p.rackId) {
        if (!(p.rackId in racks) || racks[p.rackId]) return bad("error.locked");
        racks[p.rackId] = settle(zones, p);
      } else {
        const model = p.model;
        if (!model || !RACK_MODELS.some((m) => m.id === model)) return bad("error.unknownRackModel");
        const id = `new${n++}`, tile = settle(zones, p);
        racks[id] = tile; plan.buy.push({ id, model, tile }); cost += rackPrice(model);
      }
    } else if (p.kind === "zone") {
      if (!["colo", "cage", "meetme"].includes(p.zone) || !Number.isInteger(p.length) || p.length < 1) return bad("error.badZone");
      if (p.zone === "cage" && (p.length < HALL.zones.cage.min || p.length > HALL.zones.cage.max)) return bad("error.zoneSize");
      if (p.zone === "meetme" && p.length > HALL.zones.meetme.max) return bad("error.zoneSize");
      const z: HallZone = { id: `new-zone${plan.newZones.length}`, kind: p.zone, x: p.x, y: p.y, length: p.length, facing: p.facing, builtAt: s.hour };
      zones = [...zones, z]; plan.newZones.push(z); cost += fenceCost(z);
    } else if (p.kind === "noc") {
      if (noc) return bad("error.limit");
      noc = true; plan.building = true; cost += HALL.noc.price;
    } else {
      if (!(p.kind in HALL.items)) return bad("error.unknownItem");
      const i: HallItem = { id: `new-item${plan.newItems.length}`, kind: p.kind, area: p.area ?? HALL.items[p.kind].areas[0] as AreaId, x: p.x, y: p.y, facing: p.facing, price: HALL.items[p.kind].price, builtAt: s.hour };
      items = [...items, i]; plan.newItems.push(i); cost += i.price;
    }
  }
  return { ...plan, layout: { racks, items, zones, noc }, cost, refunds };
}

// Why an edit cannot be applied, or null: the physical rules over the whole next layout, then the rules about what is in use and money.
export function editHallError(s: GameState, locationId: string, edit: HallEdit): LayoutError | null {
  const h = hallAt(s, locationId);
  if (!h) return { key: "error.unknownLocation", at: null };
  const plan = planOf(s, h, edit);
  if ("key" in plan) return plan;
  const next = plan.layout, prev = currentLayout(s, h), fail2 = (key: string, at: Pt | null = null): LayoutError => ({ key, at });
  const physical = hallLayoutError(s, locationId, next);
  if (physical) return physical;
  // 8. Not yet on sale.
  const year = yearOf(s.hour);
  if (plan.newItems.some((i) => (HALL.items[i.kind].from ?? 0) > year) || plan.newZones.some((z) => z.kind === "cage" && year < HALL.zones.cage.from)) return fail2("error.notYet");
  // 9. The transformers left must carry the draw.
  const kwOf = (items: HallItem[]) => hallKw({ ...h.p, hall: { ...h.hall, items } });
  if (kwOf(next.items) < kwOf(prev.items) && roomPower(s, h.loc).watts > 1000 * kwOf(next.items)) return fail2("error.overload");
  // 10. One NOC desk stays.
  const desks = (items: HallItem[]) => items.filter((i) => i.kind === "nocdesk").length;
  if (desks(prev.items) > 0 && desks(next.items) === 0) return fail2("error.lastDesk");
  // 11. What is in use stays.
  for (const ref of edit.remove ?? []) if (ref.startsWith("item:") && s.staff.some((e) => e.desk?.sectionId === `noc:${ref.slice(5)}`)) return fail2("error.locked");
  for (const ref of [...plan.moved, ...(edit.remove ?? [])]) {
    const [kind, id] = ref.split(":"), rack = kind === "rack" ? s.racks.find((r) => r.id === id) : undefined;
    if (rack?.arriveAt != null && plan.moved.includes(ref)) return fail2("error.rackMoving");
    if (kind === "zone") {
      const z = prev.zones.find((q) => q.id === id)!, at = new Set(zoneSpots(z).map(tileKey));
      const held = s.racks.some((r) => r.locationId === locationId && r.tile && at.has(tileKey(r.tile))) || h.hall.customers.some((c) => c.zoneId === z.id) || (!!h.hall.exchange?.tile && at.has(tileKey(h.hall.exchange.tile)));
      if (held) return fail2("error.locked");
    }
    if (kind === "item" && prev.items.find((i) => i.id === id)?.kind === "switchgear" && (edit.remove ?? []).includes(ref) && s.racks.some((r) => r.locationId === locationId && r.feedB)) return fail2("error.locked");
  }
  const meetme = new Set(next.zones.filter((z) => z.kind === "meetme").flatMap(zoneSpots).map(tileKey));
  for (const r of s.racks) {
    if (r.locationId !== locationId || !r.tile) continue;
    const panel = panelOf(s, r.id);
    if (!panel || !jackRoles(s, panel.id).some((role) => role !== "free")) continue;
    const to = next.racks[r.id];
    if (!to || !meetme.has(tileKey(to))) return fail2("error.rackLinked");
  }
  // 12. Cash.
  return s.cash < plan.cost ? fail2("error.noCash") : null;
}

// Places, moves and removes in one transaction. Moved racks with devices go dark for two hours.
export function editHall(s: GameState, locationId: string, edit: HallEdit): ActionResult {
  const error = editHallError(s, locationId, edit);
  if (error) return fail(error.key);
  const h = hallAt(s, locationId)!, plan = planOf(s, h, edit) as Plan, params = { location: h.loc.name };
  let made: string | undefined;
  for (const id of plan.sell) sellRack(s, id);
  for (const i of plan.removedItems) if (i.price > 0) refund(s, "ledger.hallRefund", { ...params, item: t(`hall.item.${i.kind}`) }, i.price * HALL.refund);
  for (const z of plan.removedZones) if (fenceCost(z)) refund(s, "ledger.fence", params, fenceCost(z) * HALL.zones.refund);
  for (const m of plan.moved) {
    const [kind, id] = m.split(":"), to = plan.layout;
    if (kind === "rack") {
      const rack = s.racks.find((r) => r.id === id)!, was = rack.tile;
      rack.tile = to.racks[id]!;
      if (was) darken(s, rack);
    }
    if (kind === "item") { const i = to.items.find((x) => x.id === id)!; h.hall.items = h.hall.items.map((x) => (x.id === id ? i : x)); }
    if (kind === "zone") { const z = to.zones.find((x) => x.id === id)!; h.hall.zones = h.hall.zones.map((x) => (x.id === id ? z : x)); }
  }
  for (const [id, tile] of Object.entries(plan.layout.racks)) if (!id.startsWith("new")) { const rack = s.racks.find((r) => r.id === id); if (rack && !rack.tile && tile) rack.tile = tile; }
  for (const b of plan.buy) {
    const position = freePositions(s, locationId)[0], r = buyRack(s, locationId, b.model, position);
    if (r.ok && r.id) { s.racks.find((x) => x.id === r.id)!.tile = b.tile; made = r.id; }
  }
  h.hall.items = h.hall.items.filter((i) => !plan.removedItems.some((x) => x.id === i.id));
  h.hall.zones = h.hall.zones.filter((z) => !plan.removedZones.some((x) => x.id === z.id));
  for (const i of plan.newItems) { const id = `item${s.nextId++}`; pay(s, "ledger.hallItem", { ...params, item: t(`hall.item.${i.kind}`) }, i.price); h.hall.items = [...h.hall.items, { ...i, id }]; made = id; }
  for (const z of plan.newZones) { const id = `zone${s.nextId++}`; if (fenceCost(z)) pay(s, "ledger.fence", params, fenceCost(z)); h.hall.zones = [...h.hall.zones, { ...z, id }]; made = id; }
  if (plan.building) { pay(s, "ledger.nocRoom", params, HALL.noc.price); h.hall.noc = true; }
  return { ok: true, id: made };
}

// The carriers present in the hall's city: every one on site at one of its datacenters.
export const cityCarriers = (city: string): Carrier[] => [...new Map(DATACENTERS.filter((d) => d.city === city).flatMap(carriersAt).map((c) => [c.id, c])).values()];

// A carrier builds its fiber into the meet-me room for a one-time fee; from then on its transit books as at a colocation site.
export function buildCarrier(s: GameState, locationId: string, carrierId: string): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  if (!h.hall.zones.some((z) => z.kind === "meetme")) return fail("error.noMeetMe");
  const c = cityCarriers(h.loc.city).find((x) => x.id === carrierId);
  if (!c) return fail("error.carrierAbsent");
  if (h.hall.carriers.includes(carrierId)) return fail("error.upgradeBuilt");
  if (s.cash < HALL.carrierFee) return fail("error.noCash");
  pay(s, "ledger.carrierBuild", { carrier: c.name, location: h.loc.name }, HALL.carrierFee);
  h.hall.carriers = [...h.hall.carriers, carrierId];
  return { ok: true };
}

// The city's going rate for one rack position a month: the average list price of its datacenters.
export const goingRate = (city: string): number => {
  const here = DATACENTERS.filter((d) => d.city === city);
  return here.length ? Math.round(here.reduce((n, d) => n + d.positionPrice, 0) / here.length) : 0;
};

// Lists the hall's spare positions to colocation customers at a monthly rate per position, or withdraws them with null.
export function setColoRate(s: GameState, locationId: string, rate: number | null): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  if (rate !== null && !(Number.isFinite(rate) && rate > 0)) return fail("error.badRate");
  h.hall.rate = rate === null ? null : Math.round(rate);
  return { ok: true };
}

// Fictional local firms that rent a rack in someone else's hall.
const COLO_NAMES = ["Mainbit", "Taunusnet", "Kranich Media", "Datenwerk Süd", "Pixelhafen", "Nordlicht IT", "Brückner Systems", "Rheinhost", "Ebbelwoi Labs", "Zeilensprung"];

// The chance a spare position signs a customer this month at the rate against the going rate.
export const signChance = (rate: number, going: number): number => Math.max(0, Math.min(1, HALL.colo.signs * (2 - rate / going)));

// The first free jack on a fiber panel of a rack in the meet-me zone.
function meetMeJack(s: GameState, hall: Hall, locationId: string): { device: string; port: number } | null {
  const at = new Set(hall.zones.filter((z) => z.kind === "meetme").flatMap(zoneSpots).map(tileKey));
  for (const r of s.racks) if (r.locationId === locationId && r.tile && at.has(tileKey(r.tile))) { const j = freeJack(s, r.id); if (j) return j; }
  return null;
}

// Tiles of the meet-me zone with no player rack and not taken by the exchange.
const freeMeetMe = (s: GameState, hall: Hall, locationId: string): Tile[] => {
  const racks = new Set(s.racks.filter((r) => r.locationId === locationId && r.tile).map((r) => tileKey(r.tile!)));
  return hall.zones.filter((z) => z.kind === "meetme").flatMap(zoneSpots).filter((t) => !racks.has(tileKey(t)) && tileKey(t) !== (hall.exchange?.tile ? tileKey(hall.exchange.tile) : ""));
};

// At each month start: customers pay their month and their cross-connects, order new cross-connects, some leave (more after a
// trip), a busy hall draws carriers and the city's exchange, and a listed hall signs customers onto its zones.
export function coloTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  s.properties.forEach((p, pi) => {
    const hall = p.hall, loc = hall && s.locations.find((l) => l.id === hall.locationId);
    if (!hall || !loc) return;
    for (const c of hall.customers) {
      s.cash = cents(s.cash + c.monthly);
      s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.colo", params: { customer: c.name, location: loc.name }, amount: c.monthly }];
    }
    for (const x of hall.xconnects) {
      s.cash = cents(s.cash + HALL.xconnect.monthly);
      s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.xconnect", params: { customer: hall.customers.find((c) => c.id === x.customerId)?.name ?? "", location: loc.name }, amount: HALL.xconnect.monthly }];
    }
    // Customers order a cross-connect to a built carrier; a full panel leaves them unhappy.
    const unhappy = new Set<string>();
    if (hall.carriers.length && hall.zones.some((z) => z.kind === "meetme")) {
      hall.customers.forEach((c, i) => {
        if (hall.xconnects.filter((x) => x.customerId === c.id).length >= HALL.xconnect.max || rand(hashRng(s.seed, s.hour, pi, i, 5)) >= HALL.xconnect.chance) return;
        const jack = meetMeJack(s, hall, loc.id);
        if (!jack) {
          unhappy.add(c.id);
          events.push({ app: "Locations", key: "event.xconnectNoJack", params: { customer: c.name, location: loc.name } });
          return;
        }
        const carrierId = hall.carriers[Math.floor(rand(hashRng(s.seed, s.hour, pi, i, 6)) * hall.carriers.length)];
        hall.xconnects = [...hall.xconnects, { id: `xc${s.nextId++}`, customerId: c.id, carrierId, jack }];
      });
    }
    const outage = hall.outage;
    hall.outage = false;
    const left = hall.customers.filter((c, i) => rand(hashRng(s.seed, s.hour, pi, i, 1)) < (outage || unhappy.has(c.id) ? HALL.colo.leavesAfterOutage : HALL.colo.leaves));
    for (const c of left) {
      const params = { customer: c.name, location: loc.name };
      if (outage || unhappy.has(c.id)) events.push({ app: "Locations", key: "event.coloLeftOutage", params });
      else events.push({ app: "Locations", key: "event.coloLeft", params });
    }
    hall.customers = hall.customers.filter((c) => !left.includes(c));
    hall.xconnects = hall.xconnects.filter((x) => hall.customers.some((c) => c.id === x.customerId));
    hubTick(s, hall, loc, pi, events);
    signTick(s, hall, loc, pi, events);
  });
  return events;
}

// A hall with 8 customers draws a carrier of its city for free; with enough carriers and customers the city's exchange moves in.
function hubTick(s: GameState, hall: Hall, loc: Location, pi: number, events: SimEvent[]): void {
  if (!hall.zones.some((z) => z.kind === "meetme")) return;
  const open = cityCarriers(loc.city).filter((c) => !hall.carriers.includes(c.id));
  if (hall.customers.length >= HALL.hub.carrierAt && open.length && rand(hashRng(s.seed, s.hour, pi, 7)) < HALL.hub.carrierChance) {
    const c = open[Math.floor(rand(hashRng(s.seed, s.hour, pi, 8)) * open.length)];
    hall.carriers = [...hall.carriers, c.id];
    events.push({ app: "Locations", key: "event.carrierArrived", params: { carrier: c.name, location: loc.name } });
  }
  if (hall.carriers.length < HALL.hub.exchangeCarriers || hall.customers.length < HALL.hub.exchangeCustomers) return;
  const x = hall.exchange ? EXCHANGES.find((e) => e.id === hall.exchange!.id) : DATACENTERS.filter((d) => d.city === loc.city).map(exchangeAt).find(Boolean);
  if (!x || hall.exchange?.tile) return;
  if (!hall.exchange) {
    hall.exchange = { id: x.id, tile: null };
    events.push({ app: "Locations", key: "event.exchangeComing", params: { exchange: x.name, location: loc.name } });
  }
  const at = freeMeetMe(s, hall, loc.id)[0];
  if (at === undefined) return;
  hall.exchange = { id: x.id, tile: at };
  events.push({ app: "Locations", key: "event.exchangeOpened", params: { exchange: x.name, location: loc.name } });
}

// A listed hall signs customers onto free positions of its colocation zones and onto empty cages.
function signTick(s: GameState, hall: Hall, loc: Location, pi: number, events: SimEvent[]): void {
  const going = goingRate(loc.city);
  if (hall.rate === null || loc.readyAt > s.hour || !going) return;
  const taken = () => new Set(hall.customers.flatMap((c) => customerSpots(hall, c)).map(tileKey));
  const zoneOrder = (a: HallZone, b: HallZone) => a.id.localeCompare(b.id, undefined, { numeric: true });
  const freeColo = () => hall.zones.filter((z) => z.kind === "colo").sort(zoneOrder).flatMap((z) => zoneSpots(z).map((t) => ({ t, z }))).filter((q) => !taken().has(tileKey(q.t)));
  const kw = (n: number) => HALL.colo.kw.min + Math.floor(rand(hashRng(s.seed, s.hour, pi, 3, n)) * (HALL.colo.kw.max - HALL.colo.kw.min + 1));
  const name = () => COLO_NAMES[s.nextId % COLO_NAMES.length];
  const chances = 1 + Math.floor(freeColo().length / 10);
  for (let k = 0; k < chances; k++) {
    const free = freeColo()[0];
    if (free === undefined || rand(hashRng(s.seed, s.hour, pi, 2, k)) >= signChance(hall.rate, going)) continue;
    const zone = free.z, n = name(), id = `colo${s.nextId++}`;
    hall.customers = [...hall.customers, { id, name: n, tile: free.t, monthly: hall.rate, since: s.hour, kw: kw(k), zoneId: zone.id }];
    events.push({ app: "Locations", key: "event.coloSigned", params: { customer: n, location: loc.name, amount: euro(hall.rate) } });
  }
  if (yearOf(s.hour) < HALL.zones.cage.from) return;
  hall.zones.forEach((z, zi) => {
    if (z.kind !== "cage" || hall.customers.some((c) => c.zoneId === z.id) || rand(hashRng(s.seed, s.hour, pi, 4, zi)) >= HALL.colo.signs) return;
    const n = name(), monthly = Math.round(z.length * hall.rate! * HALL.colo.cageMarkup), id = `colo${s.nextId++}`;
    hall.customers = [...hall.customers, { id, name: n, tile: null, monthly, since: s.hour, kw: kw(100 + zi), zoneId: z.id }];
    events.push({ app: "Locations", key: "event.cageSigned", params: { customer: n, location: loc.name, amount: euro(monthly), positions: z.length } });
  });
}
