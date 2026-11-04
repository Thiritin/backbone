import { hashRng, rand } from "../00-core/rng";
import type { Building, ColoCustomer, GameState, Hall, HallZone, Property } from "../50-state";

// Office buildings to rent sections in or buy (GDD, Properties; economy/properties.md). region matches a location's city;
// rent is the factor on the era's rent per section; price is the buy price in 2005 euros, null when not for sale.
// A "halle" is an industrial building sold only, one section per floor, each floor fitted as a hall with a loading dock.
export interface Listing extends Building { id: string; region: string; floors: number; perFloor: number; rent: number; price: number | null; from: number; taken: number; lat: number; lon: number; kind?: "halle" }

export const LISTINGS: Listing[] = [
  { id: "zeilwerk", name: "Zeilwerk", street: "Kontorweg 8", zip: "60313", city: "Frankfurt am Main", region: "Frankfurt", floors: 4, perFloor: 3, rent: 1.2, price: null, from: 2005, taken: 0.7, lat: 50.115, lon: 8.682 },
  { id: "mainblick", name: "Mainblick Offices", street: "Uferzeile 21", zip: "60594", city: "Frankfurt am Main", region: "Frankfurt", floors: 3, perFloor: 2, rent: 1, price: null, from: 2005, taken: 0.5, lat: 50.1055, lon: 8.688 },
  { id: "gallushof", name: "Gallushof", street: "Werkstattgasse 14", zip: "60326", city: "Frankfurt am Main", region: "Frankfurt", floors: 2, perFloor: 2, rent: 0.8, price: 380_000, from: 2005, taken: 0.25, lat: 50.103, lon: 8.645 },
  { id: "ostendkontor", name: "Ostend-Kontor", street: "Lagerhausring 5", zip: "60314", city: "Frankfurt am Main", region: "Frankfurt", floors: 3, perFloor: 3, rent: 0.9, price: 820_000, from: 2005, taken: 0.4, lat: 50.112, lon: 8.712 },
  { id: "fechenhalle", name: "Halle Fechenheim", street: "Industriering 12", zip: "60386", city: "Frankfurt am Main", region: "Frankfurt", floors: 1, perFloor: 1, rent: 1, price: 2_400_000, from: 2012, taken: 0, lat: 50.123, lon: 8.752, kind: "halle" },
  { id: "bockenbogen", name: "Bockenheimer Bogen", street: "Bogenallee 30", zip: "60487", city: "Frankfurt am Main", region: "Frankfurt", floors: 5, perFloor: 4, rent: 1.1, price: null, from: 2012, taken: 0.6, lat: 50.1225, lon: 8.638 },
  { id: "spreehalle", name: "Halle Spreeufer", street: "Werftstraße 3", zip: "12459", city: "Berlin", region: "Berlin", floors: 1, perFloor: 1, rent: 1, price: 2_000_000, from: 2012, taken: 0, lat: 52.4915, lon: 13.5185, kind: "halle" },
  { id: "rheinhalle", name: "Halle Rheinhafen", street: "Hafenstraße 41", zip: "40221", city: "Düsseldorf", region: "Düsseldorf", floors: 1, perFloor: 1, rent: 1, price: 2_200_000, from: 2012, taken: 0, lat: 51.2095, lon: 6.7355, kind: "halle" },
  { id: "amstelhalle", name: "Halle Amstelkade", street: "Industrieweg 9", zip: "1101", city: "Amsterdam", region: "Amsterdam", floors: 1, perFloor: 1, rent: 1, price: 2_600_000, from: 2012, taken: 0, lat: 52.3105, lon: 4.9345, kind: "halle" },
];

// Rent per section per month by the first year it applies.
const RENT_BY_YEAR: [number, number][] = [[2005, 600], [2010, 650], [2015, 750], [2020, 900], [2025, 1000]];
export const DEPOSIT_MONTHS = 3;
export const NOTICE_MONTHS = 3;
export const UPKEEP_PER_SECTION = 150;
export const DESKS_PER_SECTION = 4;
export const RACKS_PER_SERVER_SECTION = 4;
// A closet keeps the section's four desks and adds a cupboard in its corner with one rack on the section's own circuit.
export const CLOSET_KW = 2;
// A hall refit takes a whole floor and costs that once; its positions come from the hall's rows.
export const REFIT = { desks: { cost: 3_000, days: 5 }, servers: { cost: 12_000, days: 14 }, closet: { cost: 4_000, days: 3 }, hall: { cost: 90_000, days: 45 } } as const;
export const FIT_POSITIONS = { desks: 0, servers: RACKS_PER_SERVER_SECTION, closet: 1, hall: 0 } as const;
// Rack positions a floor fitted as a hall holds: an office building's floor, or a Halle's.
export const HALL_POSITIONS = { office: 20, halle: 60 } as const;
// An own hall's power and cooling (economy/properties.md, Own hall): kW per rack position, the transformer's limit per hall
// floor, cooling units on the walls each cooling `positions` positions, and the upgrades with their one-time price and monthly cost.
export const HALL = {
  kwPerPosition: 6, transformerKw: { office: 100, halle: 300 },
  cooling: { price: 18_000, monthly: 150, positions: 8, kw: 40, refund: 0.5 },
  // One extra transformer per hall floor, bought in the transformer room: it adds the floor's base limit again.
  transformer: { price: 80_000, monthly: 400 },
  // Hours a moved rack is dark.
  moveHours: 2,
  // Colocation customers: at the city's going rate a spare position finds a customer in a month with chance `signs`, which
  // falls to nothing at twice the going rate and climbs by half again at half of it; each customer leaves in a month with chance `leaves`.
  // leavesAfterOutage replaces `leaves` in a month the room's breaker tripped; a cage customer pays cageMarkup times the open rate per position.
  // kw is a customer's draw per position, drawn at signing.
  colo: { signs: 0.5, leaves: 0.04, leavesAfterOutage: 0.25, cageMarkup: 1.1, kw: { min: 2, max: 5 } },
  // The player's own hall buys power at powerFactor times the cooling overhead pue, instead of the household factor.
  powerFactor: 1.0, pue: 1.3,
  // Zones: a cage needs the year `from` and 2 to 8 positions; the meet-me zone holds 1 to 4; fences cost per position (meet-me a flat price) and refund half.
  zones: { cage: { from: 2015, min: 2, max: 8, perPosition: 2000 }, meetme: { min: 1, max: 4, price: 5000 }, refund: 0.5 },
  // A customer orders a cross-connect to a built carrier each month with chance `chance`, up to `max`, for `monthly`.
  xconnect: { monthly: 150, chance: 0.15, max: 3 },
  // Busy halls draw carriers (from `carrierAt` customers, chance `carrierChance` a month) and the city's exchange (`exchangeCarriers` carriers and `exchangeCustomers` customers).
  hub: { carrierAt: 8, carrierChance: 0.3, exchangeCarriers: 3, exchangeCustomers: 12 },
  // A carrier's one-time fee to build its fiber into the hall's meet-me room.
  carrierFee: 15_000,
  upgrades: { feedB: { price: 25_000, monthly: 200 }, ups: { price: 40_000, monthly: 300 }, generator: { price: 60_000, monthly: 500 } },
} as const;
export type HallUpgrade = keyof typeof HALL.upgrades;
export const hallKw = (p: Property): number =>
  (new Set(p.sections.filter((x) => x.fit === "hall").map((x) => x.floor)).size + (p.hall?.transformers ?? 0)) * HALL.transformerKw[isHalle(p.buildingId) ? "halle" : "office"];
// Index of a row's first position (0-based over the whole hall).
export const rowStart = (h: Hall, rowId: string): number => h.rows.slice(0, h.rows.findIndex((r) => r.id === rowId)).reduce((n, r) => n + r.length, 0);
// The hall position numbers a zone covers.
export const zonePositions = (h: Hall, z: HallZone): number[] => Array.from({ length: z.length }, (_, i) => rowStart(h, z.rowId) + z.from + i + 1);
// Positions a customer holds: a cage customer holds its whole zone.
export const customerPositions = (h: Hall, c: ColoCustomer): number[] => {
  const z = c.zoneId ? h.zones.find((x) => x.id === c.zoneId) : undefined;
  return z?.kind === "cage" ? zonePositions(h, z) : [c.position];
};
// The row and 0-based index a hall position number lies at.
export const rowOfPosition = (h: Hall, position: number): { rowId: string; index: number } | null => {
  let start = 0;
  for (const r of h.rows) { if (position > start && position <= start + r.length) return { rowId: r.id, index: position - start - 1 }; start += r.length; }
  return null;
};
// kW a customer draws; a cage draws it per position.
export const customerKw = (h: Hall, c: ColoCustomer): number => c.kw * customerPositions(h, c).length;
export const hallCustomerKw = (h: Hall | undefined): number => (h ? h.customers.reduce((n, c) => n + customerKw(h, c), 0) : 0);
export const hallBackup = (h: Hall): "none" | "ups" | "ups+generator" => (h.ups && h.generator ? "ups+generator" : h.ups ? "ups" : "none");
// Default rows a new hall floor gets: rows of HALL_ROW positions, facing each other in pairs.
export const HALL_ROW = 10;
// Business lines from the city's provider into an office server room or closet, by the first year each is sold; the price is fixed when booked.
export const OFFICE_LINES = [
  { from: 2005, name: "SDSL", mbit: 2, monthly: 120 },
  { from: 2010, name: "SDSL", mbit: 20, monthly: 150 },
  { from: 2015, name: "Fiber", mbit: 100, monthly: 200 },
  { from: 2020, name: "Fiber", mbit: 1_000, monthly: 300 },
  { from: 2025, name: "Fiber", mbit: 10_000, monthly: 450 },
] as const;
export const officeLineIn = (year: number) => OFFICE_LINES.filter((l) => l.from <= year).at(-1)!;
export const isHalle = (buildingId: string | null): boolean => !!buildingId && listingById(buildingId)?.kind === "halle";
export const hallCapacity = (p: Property): number =>
  new Set(p.sections.filter((x) => x.fit === "hall").map((x) => x.floor)).size * HALL_POSITIONS[isHalle(p.buildingId) ? "halle" : "office"];
export const hallOf = (s: GameState, locationId: string): Hall | undefined => s.properties.find((p) => p.hall?.locationId === locationId)?.hall;
export const holdsDesks = (fit: string | null): boolean => fit === "desks" || fit === "closet";

export const listingById = (id: string): Listing | undefined => LISTINGS.find((l) => l.id === id);
export const listingsIn = (region: string, year: number): Listing[] => LISTINGS.filter((l) => l.region === region && l.from <= year);
export const rentFor = (l: Listing, year: number): number => Math.round(l.rent * RENT_BY_YEAR.filter(([y]) => y <= year).at(-1)![1]);
// Buy prices follow the rent curve from 2005.
export const priceFor = (l: Listing, year: number): number | null => (l.price === null ? null : Math.round((l.price * rentFor(l, year)) / rentFor(l, 2005)));

export const sectionIds = (l: Listing): { id: string; floor: number }[] =>
  Array.from({ length: l.floors * l.perFloor }, (_, i) => ({ id: `${Math.floor(i / l.perFloor) + 1}.${(i % l.perFloor) + 1}`, floor: Math.floor(i / l.perFloor) + 1 }));

// Sections other tenants hold, fixed by the seed.
export const takenSections = (seed: number, l: Listing): Set<string> =>
  new Set(sectionIds(l).filter((_, i) => rand(hashRng(seed, LISTINGS.indexOf(l), i)) < l.taken).map((x) => x.id));
