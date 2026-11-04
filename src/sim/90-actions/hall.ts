// GDD, Own datacenter: what the player lays out in a hall of their own.
import { coolingSlots, HALL_MARGIN, hallSize, officePlan, rowTiles, wallTiles } from "../20-world/layout";
import { euro } from "../00-core/money";
import { hashRng, rand } from "../00-core/rng";
import { carriersAt, type Carrier } from "../10-catalog/network";
import { DATACENTERS } from "../20-world/datacenters";
import { HALL, hallCapacity, isHalle, type HallUpgrade } from "../20-world/properties";
import { cents } from "../45-billing/billing";
import type { GameState, Hall, HallRow, Location, Property } from "../50-state";
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

// Positions run along the rows in order, so a change to the rows renumbers the racks and customers by the tile they stand on.
function relayRows(s: GameState, h: NonNullable<ReturnType<typeof hallAt>>, rows: HallRow[]): void {
  const before = wallTiles(h.loc, officePlan(s, h.loc)).map(tileKey);
  h.hall.rows = rows;
  const after = new Map(rows.flatMap(rowTiles).map((t, i) => [tileKey(t), i + 1]));
  const renumber = (position: number) => after.get(before[position - 1]) ?? position;
  for (const r of s.racks) if (r.locationId === h.loc.id) r.position = renumber(r.position);
  h.hall.customers = h.hall.customers.map((c) => ({ ...c, position: renumber(c.position) }));
  h.loc.positions = rows.reduce((n, r) => n + r.length, 0);
}

// Whether a row holds a rack or a customer.
export function rowInUse(s: GameState, locationId: string, rowId: string): boolean {
  const h = hallAt(s, locationId);
  if (!h) return false;
  let start = 0;
  for (const r of h.hall.rows) {
    if (r.id === rowId) {
      const inRow = (p: number) => p > start && p <= start + r.length;
      return s.racks.some((x) => x.locationId === locationId && inRow(x.position)) || h.hall.customers.some((c) => inRow(c.position));
    }
    start += r.length;
  }
  return false;
}

// Places a new row, or moves, turns or resizes an empty one given by id. Rows stay inside the floor's margin, never overlap
// and hold no more positions together than the hall's floors give.
export function layRow(s: GameState, locationId: string, row: Omit<HallRow, "id"> & { id?: string }): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  if (!["n", "e", "s", "w"].includes(row.facing) || !Number.isInteger(row.length) || row.length < 1) return fail("error.badRow");
  if (row.id && !h.hall.rows.some((r) => r.id === row.id)) return fail("error.unknownRow");
  if (row.id && rowInUse(s, locationId, row.id)) return fail("error.rowInUse");
  const capacity = hallCapacity(h.p), size = hallSize(capacity, isHalle(h.p.buildingId)), next: HallRow = { ...row, id: row.id ?? `row${s.nextId}` };
  const others = h.hall.rows.filter((r) => r.id !== next.id), taken = new Set(others.flatMap(rowTiles).map(tileKey));
  const inside = (t: { x: number; y: number }) => t.x >= HALL_MARGIN.x0 && t.y >= HALL_MARGIN.y0 && t.x < size.w - HALL_MARGIN.right && t.y < size.h - HALL_MARGIN.bottom;
  const tiles = rowTiles(next);
  if (!tiles.every(inside)) return fail("error.rowOutside");
  if (tiles.some((t) => taken.has(tileKey(t)))) return fail("error.rowOverlap");
  if (others.reduce((n, r) => n + r.length, 0) + next.length > capacity) return fail("error.rowsFull");
  if (!row.id) s.nextId++;
  relayRows(s, h, row.id ? h.hall.rows.map((r) => (r.id === next.id ? next : r)) : [...h.hall.rows, next]);
  return { ok: true, id: next.id };
}

export function removeRow(s: GameState, locationId: string, rowId: string): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  if (!h.hall.rows.some((r) => r.id === rowId)) return fail("error.unknownRow");
  if (rowInUse(s, locationId, rowId)) return fail("error.rowInUse");
  relayRows(s, h, h.hall.rows.filter((r) => r.id !== rowId));
  return { ok: true };
}

// A cooling unit on the next free wall slot; a hall takes as many as its walls hold.
export function addCooling(s: GameState, locationId: string): ActionResult {
  const h = hallAt(s, locationId);
  if (!h) return fail("error.unknownLocation");
  const dock = isHalle(h.p.buildingId);
  if (h.hall.cooling >= coolingSlots(hallSize(hallCapacity(h.p), dock), dock).length) return fail("error.wallsFull");
  if (s.cash < HALL.cooling.price) return fail("error.noCash");
  pay(s, "ledger.hallCooling", { location: h.loc.name }, HALL.cooling.price);
  h.hall.cooling++;
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
  hall.cooling * HALL.cooling.monthly + (Object.keys(HALL.upgrades) as HallUpgrade[]).reduce((n, k) => n + (hall[k] ? HALL.upgrades[k].monthly : 0), 0);

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
