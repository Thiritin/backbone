// GDD, Own datacenter: what the player lays out in a hall of their own.
import { coolingSlots, fixtures, fixtureTiles, HALL_MARGIN, hallSize, officePlan, rowBack, rowFront, rowTiles } from "../20-world/layout";
import { euro } from "../00-core/money";
import { hashRng, rand } from "../00-core/rng";
import { carriersAt, type Carrier } from "../10-catalog/network";
import { DATACENTERS } from "../20-world/datacenters";
import { HALL, hallCapacity, isHalle, type HallUpgrade } from "../20-world/properties";
import { cents } from "../45-billing/billing";
import type { GameState, Hall, HallRow, Location, Property, Rack } from "../50-state";
import { freePositions } from "../60-infra/status";
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
  h.hall.rows = rows;
  h.loc.positions = rows.reduce((n, r) => n + r.length, 0);
}

// The player's racks standing on a row, with the index each holds in it.
function rowRacks(s: GameState, h: HallAt, rowId: string) {
  const start = h.hall.rows.slice(0, h.hall.rows.findIndex((r) => r.id === rowId)).reduce((n, r) => n + r.length, 0), len = h.hall.rows.find((r) => r.id === rowId)?.length ?? 0;
  const inRow = (p: number) => p > start && p <= start + len;
  return { racks: s.racks.filter((x) => x.locationId === h.loc.id && inRow(x.position)), customers: h.hall.customers.filter((c) => inRow(c.position)), start };
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
      const standing = [...u.racks.map((x) => x.position), ...u.customers.map((c) => c.position)];
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
  relayRows(s, hallAt(s, locationId)!, hallAt(s, locationId)!.hall.rows.filter((r) => r.id !== rowId));
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

// At each month start: customers pay their month, some leave and free their position, and a listed hall with a spare
// position may sign one new customer at its rate, who takes the first free position.
export function coloTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  s.properties.forEach((p, pi) => {
    const hall = p.hall, loc = hall && s.locations.find((l) => l.id === hall.locationId);
    if (!hall || !loc) return;
    for (const c of hall.customers) {
      s.cash = cents(s.cash + c.monthly);
      s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.colo", params: { customer: c.name, location: loc.name }, amount: c.monthly }];
    }
    const left = hall.customers.filter((_, i) => rand(hashRng(s.seed, s.hour, pi, i, 1)) < HALL.colo.leaves);
    for (const c of left) events.push({ app: "Locations", key: "event.coloLeft", params: { customer: c.name, location: loc.name } });
    hall.customers = hall.customers.filter((c) => !left.includes(c));
    const free = freePositions(s, loc.id)[0], going = goingRate(loc.city);
    if (hall.rate === null || free === undefined || loc.readyAt > s.hour || !going) return;
    if (rand(hashRng(s.seed, s.hour, pi, 2)) >= signChance(hall.rate, going)) return;
    const name = COLO_NAMES[s.nextId % COLO_NAMES.length];
    hall.customers = [...hall.customers, { id: `colo${s.nextId++}`, name, position: free, monthly: hall.rate, since: s.hour }];
    events.push({ app: "Locations", key: "event.coloSigned", params: { customer: name, location: loc.name, amount: euro(hall.rate) } });
  });
  return events;
}
