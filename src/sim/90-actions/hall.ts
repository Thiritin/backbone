// GDD, Own datacenter: what the player lays out in a hall of their own.
import { coolingSlots, fixtures, fixtureTiles, HALL_MARGIN, hallSize, officePlan, rowBack, rowFront, rowTiles } from "../20-world/layout";
import { euro } from "../00-core/money";
import { hashRng, rand } from "../00-core/rng";
import { carriersAt, EXCHANGES, exchangeAt, type Carrier } from "../10-catalog/network";
import { DATACENTERS } from "../20-world/datacenters";
import { customerPositions, HALL, hallCapacity, isHalle, zonePositions, type HallUpgrade } from "../20-world/properties";
import { cents } from "../45-billing/billing";
import type { GameState, Hall, HallRow, HallZone, Location, Property, Rack } from "../50-state";
import { yearOf } from "../00-core/time";
import { freeJack } from "../60-infra/panels";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const pay = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key, params, amount: -amount }];
};
const tileKey = (t: { x: number; y: number }) => `${t.x},${t.y}`;

export function hallAt(s: GameState, locationId: string): { p: Property; hall: Hall; loc: Location } | null {
  const p = s.properties.find((x) => x.hall?.locationId === locationId), loc = s.locations.find((l) => l.id === locationId);
  return p?.hall && loc ? { p, hall: p.hall, loc } : null;
}

type HallAt = NonNullable<ReturnType<typeof hallAt>>;
// Positions run along the rows in order, so a change to the rows renumbers the racks and customers. A position keeps its
// index in its row, except in the row `moved` gives, which maps old indexes to new ones.
function relayRows(s: GameState, h: HallAt, rows: HallRow[], moved?: { id: string; to: (i: number) => number }): void {
  const old = h.hall.rows, oldStart = new Map<string, number>();
  old.reduce((n, r) => (oldStart.set(r.id, n), n + r.length), 0);
  const newStart = new Map<string, number>();
  rows.reduce((n, r) => (newStart.set(r.id, n), n + r.length), 0);
  const renumber = (position: number) => {
    const r = old.find((x) => position > oldStart.get(x.id)! && position <= oldStart.get(x.id)! + x.length);
    if (!r) return position;
    const i = position - oldStart.get(r.id)! - 1;
    return newStart.get(r.id)! + 1 + (moved?.id === r.id ? moved.to(i) : i);
  };
  for (const r of s.racks) if (r.locationId === h.loc.id) r.position = renumber(r.position);
  h.hall.customers = h.hall.customers.map((c) => ({ ...c, position: renumber(c.position) }));
  if (h.hall.exchange?.position) h.hall.exchange = { ...h.hall.exchange, position: renumber(h.hall.exchange.position) };
  // Zones are kept by row and index, so only the moved row's indexes change.
  if (moved) h.hall.zones = h.hall.zones.map((z) => (z.rowId === moved.id ? { ...z, from: moved.to(z.from) } : z));
  h.hall.rows = rows;
  h.loc.positions = rows.reduce((n, r) => n + r.length, 0);
}

// The player's racks standing on a row, with the index each holds in it.
function rowRacks(s: GameState, h: HallAt, rowId: string) {
  const start = h.hall.rows.slice(0, h.hall.rows.findIndex((r) => r.id === rowId)).reduce((n, r) => n + r.length, 0), len = h.hall.rows.find((r) => r.id === rowId)?.length ?? 0;
  const inRow = (p: number) => p > start && p <= start + len;
  // Customers, a cage's every position and the exchange's rack count as standing on the row.
  const sold = [...h.hall.customers.flatMap((c) => customerPositions(h.hall, c)), ...(h.hall.exchange?.position ? [h.hall.exchange.position] : [])].filter(inRow).map((position) => ({ position }));
  return { racks: s.racks.filter((x) => x.locationId === h.loc.id && inRow(x.position)), customers: sold, start };
}

// Whether a row holds a rack or a customer.
export function rowInUse(s: GameState, locationId: string, rowId: string): boolean {
  const h = hallAt(s, locationId);
  if (!h || !h.hall.rows.some((r) => r.id === rowId)) return false;
  const u = rowRacks(s, h, rowId);
  return u.racks.length > 0 || u.customers.length > 0;
}

const hasDevices = (s: GameState, rackId: string) => s.devices.some((d) => d.rackId === rackId);
// A rack with devices goes dark while it is moved.
export const darken = (s: GameState, rack: Rack): void => { if (hasDevices(s, rack.id)) rack.arriveAt = s.hour + HALL.moveHours; };

const inBounds = (t: { x: number; y: number }, size: { w: number; h: number }) => t.x >= 0 && t.y >= 0 && t.x < size.w && t.y < size.h;

// Why a row cannot be laid, or null. Without an id it is a new row; with one, the row moves, turns or resizes.
export function layRowError(s: GameState, locationId: string, row: Omit<HallRow, "id"> & { id?: string }): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  if (!["n", "e", "s", "w"].includes(row.facing) || !Number.isInteger(row.length) || row.length < 1) return "error.badRow";
  const current = row.id ? h.hall.rows.find((r) => r.id === row.id) : undefined;
  if (row.id && !current) return "error.unknownRow";
  const capacity = hallCapacity(h.p), dock = isHalle(h.p.buildingId), size = hallSize(capacity, dock), next: HallRow = { ...row, id: row.id ?? "new" };
  const others = h.hall.rows.filter((r) => r.id !== next.id), taken = new Set(others.flatMap(rowTiles).map(tileKey));
  const inside = (t: { x: number; y: number }) => t.x >= HALL_MARGIN.x0 && t.y >= HALL_MARGIN.y0 && t.x < size.w - HALL_MARGIN.right && t.y < size.h - HALL_MARGIN.bottom;
  const tiles = rowTiles(next);
  if (!tiles.every(inside)) return "error.rowOutside";
  if (tiles.some((t) => taken.has(tileKey(t)))) return "error.rowOverlap";
  if (others.reduce((n, r) => n + r.length, 0) + next.length > capacity) return "error.rowsFull";
  const plan = officePlan(s, h.loc), blocked = new Set(fixtureTiles(h.loc, plan).map(tileKey));
  const door = fixtures(h.loc, plan).door;
  blocked.add(tileKey({ x: door.x + 1, y: door.y }));
  if (tiles.some((t) => blocked.has(tileKey(t)))) return "error.occupied";
  // Each row needs a free aisle line in front and behind; rows may share one.
  const aisle = (r: HallRow) => [...rowFront(r), ...rowBack(r)];
  const mine = new Set(tiles.map(tileKey)), theirs = new Set(others.flatMap(rowTiles).map(tileKey));
  if (aisle(next).some((t) => !inBounds(t, size) || theirs.has(tileKey(t)))) return "error.noAisle";
  if (others.some((r) => aisle(r).some((t) => mine.has(tileKey(t))))) return "error.noAisle";
  if (current) {
    const u = rowRacks(s, h, current.id), same = rowTiles(current).map(tileKey);
    const resize = next.facing === current.facing && next.length !== current.length;
    if (resize) {
      // Lengthening or shortening keeps every tile where it is, so nothing may stand on a removed one.
      const keep = new Set(tiles.map(tileKey));
      const zoned = h.hall.zones.filter((z) => z.rowId === current.id).flatMap((z) => zonePositions(h.hall, z));
      const standing = [...u.racks.map((x) => x.position), ...u.customers.map((c) => c.position), ...zoned];
      if (standing.some((pos) => !keep.has(same[pos - u.start - 1])) || (u.customers.length && next.length < current.length)) return "error.rowInUse";
    } else if ((next.x !== current.x || next.y !== current.y || next.facing !== current.facing) && u.customers.length) return "error.rowInUse";
  }
  return null;
}

// Places a new row, or moves, turns or resizes one given by id; its racks go with it and are dark for two hours.
export function layRow(s: GameState, locationId: string, row: Omit<HallRow, "id"> & { id?: string }): ActionResult {
  const error = layRowError(s, locationId, row);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!, next: HallRow = { ...row, id: row.id ?? `row${s.nextId}` };
  if (!row.id) {
    s.nextId++;
    relayRows(s, h, [...h.hall.rows, next]);
    return { ok: true, id: next.id };
  }
  const current = h.hall.rows.find((r) => r.id === row.id)!, u = rowRacks(s, h, row.id);
  const resize = next.facing === current.facing && next.length !== current.length;
  const moves = !resize && (next.x !== current.x || next.y !== current.y || next.facing !== current.facing);
  const cur = rowTiles(current), now = rowTiles(next);
  // A resize keeps each tile; a move keeps each index.
  const to = resize ? (i: number) => now.findIndex((t) => tileKey(t) === tileKey(cur[i])) : (i: number) => i;
  const moving = u.racks;
  relayRows(s, h, h.hall.rows.map((r) => (r.id === next.id ? next : r)), { id: next.id, to });
  if (moves) for (const x of moving) darken(s, x);
  return { ok: true, id: next.id };
}

export function removeRowError(s: GameState, locationId: string, rowId: string): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  if (!h.hall.rows.some((r) => r.id === rowId)) return "error.unknownRow";
  return rowInUse(s, locationId, rowId) ? "error.rowInUse" : null;
}

export function removeRow(s: GameState, locationId: string, rowId: string): ActionResult {
  const error = removeRowError(s, locationId, rowId);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!;
  relayRows(s, h, h.hall.rows.filter((r) => r.id !== rowId));
  h.hall.zones = h.hall.zones.filter((z) => z.rowId !== rowId);
  return { ok: true };
}

const slotsOf = (h: HallAt) => coolingSlots(hallSize(hallCapacity(h.p), isHalle(h.p.buildingId)), isHalle(h.p.buildingId));

export function placeCoolerError(s: GameState, locationId: string, slot: number): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  if (!Number.isInteger(slot) || !slotsOf(h)[slot]) return "error.noWallSlot";
  if (h.hall.coolers.includes(slot)) return "error.occupied";
  return s.cash < HALL.cooling.price ? "error.noCash" : null;
}

// A cooling unit on a wall slot.
export function placeCooler(s: GameState, locationId: string, slot: number): ActionResult {
  const error = placeCoolerError(s, locationId, slot);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!;
  pay(s, "ledger.hallCooling", { location: h.loc.name }, HALL.cooling.price);
  h.hall.coolers = [...h.hall.coolers, slot].sort((a, b) => a - b);
  return { ok: true };
}

// A cooling unit on the first free wall slot.
export function addCooling(s: GameState, locationId: string): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  const slot = slotsOf(h).findIndex((_, i) => !h.hall.coolers.includes(i));
  return slot < 0 ? fail("error.wallsFull") : placeCooler(s, locationId, slot);
}

export function moveCoolerError(s: GameState, locationId: string, from: number, to: number): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  if (!h.hall.coolers.includes(from) || !Number.isInteger(to) || !slotsOf(h)[to]) return "error.noWallSlot";
  return h.hall.coolers.includes(to) ? "error.occupied" : null;
}

export function moveCooler(s: GameState, locationId: string, from: number, to: number): ActionResult {
  const error = moveCoolerError(s, locationId, from, to);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!;
  h.hall.coolers = h.hall.coolers.map((c) => (c === from ? to : c)).sort((a, b) => a - b);
  return { ok: true };
}

export function removeCoolerError(s: GameState, locationId: string, slot: number): string | null {
  const h = hallAt(s, locationId);
  return !h ? "error.unknownLocation" : h.hall.coolers.includes(slot) ? null : "error.noWallSlot";
}

// Removing a unit refunds half its price; racks it covered may run hot.
export function removeCooler(s: GameState, locationId: string, slot: number): ActionResult {
  const error = removeCoolerError(s, locationId, slot);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!, refund = HALL.cooling.price * HALL.cooling.refund;
  h.hall.coolers = h.hall.coolers.filter((c) => c !== slot);
  s.cash = cents(s.cash + refund);
  s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key: "ledger.coolerRefund", params: { location: h.loc.name }, amount: refund }];
  return { ok: true };
}

export function buyTransformerError(s: GameState, locationId: string): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  if (h.hall.transformers >= new Set(h.p.sections.filter((x) => x.fit === "hall").map((x) => x.floor)).size) return "error.upgradeBuilt";
  return s.cash < HALL.transformer.price ? "error.noCash" : null;
}

// One extra transformer per hall floor, raising the floor's limit by its base value.
export function buyTransformer(s: GameState, locationId: string): ActionResult {
  const error = buyTransformerError(s, locationId);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!;
  pay(s, "ledger.transformer", { location: h.loc.name }, HALL.transformer.price);
  h.hall.transformers++;
  return { ok: true };
}

// Feed B, the UPS and the generator are built once and billed monthly from then on; the generator needs the UPS to bridge its start.
export function buyHallUpgrade(s: GameState, locationId: string, what: HallUpgrade): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  if (!(what in HALL.upgrades)) return fail("error.unknownUpgrade");
  if (h.hall[what]) return fail("error.upgradeBuilt");
  if (what === "generator" && !h.hall.ups) return fail("error.needsUps");
  const { price } = HALL.upgrades[what];
  if (s.cash < price) return fail("error.noCash");
  pay(s, `ledger.hall.${what}`, { location: h.loc.name }, price);
  h.hall[what] = true;
  return { ok: true };
}

// The monthly cost of a hall's cooling units and upgrades.
export const hallMonthly = (hall: Hall): number =>
  hall.coolers.length * HALL.cooling.monthly + hall.transformers * HALL.transformer.monthly + (Object.keys(HALL.upgrades) as HallUpgrade[]).reduce((n, k) => n + (hall[k] ? HALL.upgrades[k].monthly : 0), 0);

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

type ZoneSpec = { kind: HallZone["kind"]; rowId: string; from: number; length: number };
const fenceCost = (z: Pick<ZoneSpec, "kind" | "length">): number => (z.kind === "cage" ? z.length * HALL.zones.cage.perPosition : z.kind === "meetme" ? HALL.zones.meetme.price : 0);

// Why a zone cannot be painted, or null.
export function paintZoneError(s: GameState, locationId: string, z: ZoneSpec): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  const row = h.hall.rows.find((r) => r.id === z.rowId);
  if (!row) return "error.unknownRow";
  if (!["colo", "cage", "meetme"].includes(z.kind) || !Number.isInteger(z.from) || !Number.isInteger(z.length) || z.length < 1) return "error.badZone";
  if (z.from < 0 || z.from + z.length > row.length) return "error.zoneOutside";
  if (z.kind === "cage") {
    if (yearOf(s.hour) < HALL.zones.cage.from) return "error.cageLater";
    if (z.length < HALL.zones.cage.min || z.length > HALL.zones.cage.max) return "error.zoneSize";
  }
  if (z.kind === "meetme") {
    if (z.length > HALL.zones.meetme.max) return "error.zoneSize";
    if (h.hall.zones.some((x) => x.kind === "meetme")) return "error.zoneExists";
  }
  if (h.hall.zones.some((x) => x.rowId === z.rowId && x.from < z.from + z.length && z.from < x.from + x.length)) return "error.occupied";
  if (z.kind !== "meetme") {
    const at = new Set(zonePositions(h.hall, { ...z, id: "", builtAt: 0 }));
    if (s.racks.some((r) => r.locationId === locationId && at.has(r.position))) return "error.zoneRack";
  }
  return s.cash < fenceCost(z) ? "error.noCash" : null;
}

// Sets a run of positions in one row aside as open colocation, a fenced cage or the meet-me area; the fence is paid once.
export function paintZone(s: GameState, locationId: string, z: ZoneSpec): ActionResult {
  const error = paintZoneError(s, locationId, z);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!, cost = fenceCost(z), id = `zone${s.nextId++}`;
  if (cost) pay(s, "ledger.fence", { location: h.loc.name }, cost);
  h.hall.zones = [...h.hall.zones, { id, kind: z.kind, rowId: z.rowId, from: z.from, length: z.length, builtAt: s.hour }];
  return { ok: true, id };
}

export function removeZoneError(s: GameState, locationId: string, zoneId: string): string | null {
  const h = hallAt(s, locationId);
  if (!h) return "error.unknownLocation";
  const z = h.hall.zones.find((x) => x.id === zoneId);
  if (!z) return "error.unknownZone";
  const at = new Set(zonePositions(h.hall, z));
  const rented = h.hall.customers.some((c) => c.zoneId === z.id || customerPositions(h.hall, c).some((p) => at.has(p))) || (!!h.hall.exchange && at.has(h.hall.exchange.position));
  return rented || s.racks.some((r) => r.locationId === locationId && at.has(r.position)) ? "error.zoneInUse" : null;
}

// Takes a zone away; a fence refunds half.
export function removeZone(s: GameState, locationId: string, zoneId: string): ActionResult {
  const error = removeZoneError(s, locationId, zoneId);
  if (error) return fail(error);
  const h = hallAt(s, locationId)!, z = h.hall.zones.find((x) => x.id === zoneId)!, refund = fenceCost(z) * HALL.zones.refund;
  h.hall.zones = h.hall.zones.filter((x) => x.id !== zoneId);
  if (refund) {
    s.cash = cents(s.cash + refund);
    s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key: "ledger.fence", params: { location: h.loc.name }, amount: refund }];
  }
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
  const at = new Set(hall.zones.filter((z) => z.kind === "meetme").flatMap((z) => zonePositions(hall, z)));
  for (const r of s.racks) if (r.locationId === locationId && at.has(r.position)) { const j = freeJack(s, r.id); if (j) return j; }
  return null;
}

// Positions of the meet-me zone with no player rack and not taken by the exchange.
const freeMeetMe = (s: GameState, hall: Hall, locationId: string): number[] => {
  const racks = new Set(s.racks.filter((r) => r.locationId === locationId).map((r) => r.position));
  return hall.zones.filter((z) => z.kind === "meetme").flatMap((z) => zonePositions(hall, z)).filter((p) => !racks.has(p) && p !== hall.exchange?.position);
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
  if (!x || hall.exchange?.position) return;
  if (!hall.exchange) {
    hall.exchange = { id: x.id, position: 0 };
    events.push({ app: "Locations", key: "event.exchangeComing", params: { exchange: x.name, location: loc.name } });
  }
  const at = freeMeetMe(s, hall, loc.id)[0];
  if (at === undefined) return;
  hall.exchange = { id: x.id, position: at };
  events.push({ app: "Locations", key: "event.exchangeOpened", params: { exchange: x.name, location: loc.name } });
}

// A listed hall signs customers onto free positions of its colocation zones and onto empty cages.
function signTick(s: GameState, hall: Hall, loc: Location, pi: number, events: SimEvent[]): void {
  const going = goingRate(loc.city);
  if (hall.rate === null || loc.readyAt > s.hour || !going) return;
  const taken = () => new Set(hall.customers.flatMap((c) => customerPositions(hall, c)));
  const freeColo = () => hall.zones.filter((z) => z.kind === "colo").flatMap((z) => zonePositions(hall, z)).filter((q) => !taken().has(q));
  const kw = (n: number) => HALL.colo.kw.min + Math.floor(rand(hashRng(s.seed, s.hour, pi, 3, n)) * (HALL.colo.kw.max - HALL.colo.kw.min + 1));
  const name = () => COLO_NAMES[s.nextId % COLO_NAMES.length];
  const chances = 1 + Math.floor(freeColo().length / 10);
  for (let k = 0; k < chances; k++) {
    const free = freeColo()[0];
    if (free === undefined || rand(hashRng(s.seed, s.hour, pi, 2, k)) >= signChance(hall.rate, going)) continue;
    const zone = hall.zones.find((z) => z.kind === "colo" && zonePositions(hall, z).includes(free))!, n = name(), id = `colo${s.nextId++}`;
    hall.customers = [...hall.customers, { id, name: n, position: free, monthly: hall.rate, since: s.hour, kw: kw(k), zoneId: zone.id }];
    events.push({ app: "Locations", key: "event.coloSigned", params: { customer: n, location: loc.name, amount: euro(hall.rate) } });
  }
  if (yearOf(s.hour) < HALL.zones.cage.from) return;
  hall.zones.forEach((z, zi) => {
    if (z.kind !== "cage" || hall.customers.some((c) => c.zoneId === z.id) || rand(hashRng(s.seed, s.hour, pi, 4, zi)) >= HALL.colo.signs) return;
    const n = name(), monthly = Math.round(z.length * hall.rate! * HALL.colo.cageMarkup), id = `colo${s.nextId++}`;
    hall.customers = [...hall.customers, { id, name: n, position: zonePositions(hall, z)[0], monthly, since: s.hour, kw: kw(100 + zi), zoneId: z.id }];
    events.push({ app: "Locations", key: "event.cageSigned", params: { customer: n, location: loc.name, amount: euro(monthly), positions: z.length } });
  });
}
