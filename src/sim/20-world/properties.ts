import { hashRng, rand } from "../00-core/rng";
import type { Building } from "../50-state";

// Office buildings to rent sections in or buy (GDD, Properties; economy/properties.md). region matches a location's city;
// rent is the factor on the era's rent per section; price is the buy price in 2005 euros, null when not for sale.
export interface Listing extends Building { id: string; region: string; floors: number; perFloor: number; rent: number; price: number | null; from: number; taken: number; lat: number; lon: number }

export const LISTINGS: Listing[] = [
  { id: "zeilwerk", name: "Zeilwerk", street: "Kontorweg 8", zip: "60313", city: "Frankfurt am Main", region: "Frankfurt", floors: 4, perFloor: 3, rent: 1.2, price: null, from: 2005, taken: 0.7, lat: 50.115, lon: 8.682 },
  { id: "mainblick", name: "Mainblick Offices", street: "Uferzeile 21", zip: "60594", city: "Frankfurt am Main", region: "Frankfurt", floors: 3, perFloor: 2, rent: 1, price: null, from: 2005, taken: 0.5, lat: 50.1055, lon: 8.688 },
  { id: "gallushof", name: "Gallushof", street: "Werkstattgasse 14", zip: "60326", city: "Frankfurt am Main", region: "Frankfurt", floors: 2, perFloor: 2, rent: 0.8, price: 380_000, from: 2005, taken: 0.25, lat: 50.103, lon: 8.645 },
  { id: "ostendkontor", name: "Ostend-Kontor", street: "Lagerhausring 5", zip: "60314", city: "Frankfurt am Main", region: "Frankfurt", floors: 3, perFloor: 3, rent: 0.9, price: 820_000, from: 2005, taken: 0.4, lat: 50.112, lon: 8.712 },
  { id: "bockenbogen", name: "Bockenheimer Bogen", street: "Bogenallee 30", zip: "60487", city: "Frankfurt am Main", region: "Frankfurt", floors: 5, perFloor: 4, rent: 1.1, price: null, from: 2012, taken: 0.6, lat: 50.1225, lon: 8.638 },
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
export const REFIT = { desks: { cost: 3_000, days: 5 }, servers: { cost: 12_000, days: 14 }, closet: { cost: 4_000, days: 3 } } as const;
export const FIT_POSITIONS = { desks: 0, servers: RACKS_PER_SERVER_SECTION, closet: 1 } as const;
// Business lines from the city's provider into an office server room or closet, by the first year each is sold; the price is fixed when booked.
export const OFFICE_LINES = [
  { from: 2005, name: "SDSL", mbit: 2, monthly: 120 },
  { from: 2010, name: "SDSL", mbit: 20, monthly: 150 },
  { from: 2015, name: "Fiber", mbit: 100, monthly: 200 },
  { from: 2020, name: "Fiber", mbit: 1_000, monthly: 300 },
  { from: 2025, name: "Fiber", mbit: 10_000, monthly: 450 },
] as const;
export const officeLineIn = (year: number) => OFFICE_LINES.filter((l) => l.from <= year).at(-1)!;
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
