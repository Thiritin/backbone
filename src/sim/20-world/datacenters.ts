// Values come from docs/design/economy.md (Datacenters and space).
import { hashRng, rand } from "../00-core/rng";
import type { RackModel, SpaceKind } from "../50-state";

export interface Provider { id: string; name: string }
export interface Datacenter {
  id: string; name: string; provider: string; city: string; carriers: number;
  exchange: { name: string; onSite: boolean } | null;
  feeds: "single" | "ab"; backup: "none" | "ups" | "ups+generator"; green: boolean;
  kwPerPosition: number; positionPrice: number; powerFactor: number; crossConnect: number;
  remoteHands: { perHour: number; responseHours: number }; certified: boolean; cages: boolean;
  size: "large" | "medium" | "small";
}

export const PROVIDERS: Provider[] = [
  { id: "equinox", name: "Equinox" },
  { id: "interaction", name: "Interaction" },
  { id: "mainqubes", name: "mainqubes" },
  { id: "hetzler", name: "Hetzler" },
  { id: "tellyhouse", name: "Tellyhouse" },
  { id: "globalsnitch", name: "Global Snitch" },
  { id: "docklands", name: "Docklands Data" },
  { id: "ironmolehill", name: "Iron Molehill" },
  { id: "data5", name: "Data5" },
  { id: "ntd", name: "NTD" },
  { id: "spree", name: "Spree Colo" },
  { id: "arubaba", name: "Arubaba" },
  { id: "nextlair", name: "Next Lair" },
  { id: "greenchz", name: "Green.chz" },
];

type Row = [id: string, name: string, provider: string, city: string, carriers: number, exchange: string | null, onSite: boolean,
  ab: boolean, backup: Datacenter["backup"], green: boolean, kw: number, price: number, factor: number, cross: number,
  handsPerHour: number, handsHours: number, certified: boolean, cages: boolean];

const ROWS: Row[] = [
  ["equinox-fr5", "Equinox FR5", "equinox", "Frankfurt", 30, "DE-KICKS", true, true, "ups+generator", true, 8, 750, 1.4, 250, 150, 1, true, true],
  ["interaction-fra", "Interaction FRA", "interaction", "Frankfurt", 25, "DE-KICKS", true, true, "ups+generator", false, 6, 600, 1.3, 200, 120, 2, true, true],
  ["mainqubes-fra", "mainqubes FRA", "mainqubes", "Frankfurt", 12, "DE-KICKS", false, true, "ups+generator", true, 6, 450, 1.3, 150, 100, 4, true, true],
  ["hetzler-park", "Hetzler Park", "hetzler", "Frankfurt", 1, null, false, false, "ups+generator", true, 4, 180, 1.1, 80, 60, 8, false, false],
  ["tellyhouse-north", "Tellyhouse North", "tellyhouse", "London", 30, "LYNX", true, true, "ups+generator", false, 6, 800, 1.5, 300, 160, 1, true, true],
  ["globalsnitch-lon", "Global Snitch LON", "globalsnitch", "London", 20, "LYNX", false, true, "ups+generator", true, 8, 700, 1.4, 250, 140, 2, true, true],
  ["docklands-data", "Docklands Data", "docklands", "London", 3, null, false, false, "ups", false, 4, 350, 1.2, 100, 80, 8, false, false],
  ["equinox-am3", "Equinox AM3", "equinox", "Amsterdam", 25, "HAMS-IX", true, true, "ups+generator", true, 8, 650, 1.3, 220, 140, 1, true, true],
  ["ironmolehill-ams", "Iron Molehill AMS", "ironmolehill", "Amsterdam", 10, "HAMS-IX", false, true, "ups+generator", true, 10, 500, 1.2, 180, 110, 4, true, true],
  ["tellyhouse-voltaire", "Tellyhouse Voltaire", "tellyhouse", "Paris", 25, "Franz-IX", true, true, "ups+generator", false, 6, 650, 1.3, 220, 140, 2, true, true],
  ["data5-marcoussis", "Data5 Marcoussis", "data5", "Paris", 8, "Franz-IX", false, true, "ups+generator", true, 10, 450, 1.2, 150, 100, 4, true, true],
  ["ntd-berlin1", "NTD Berlin 1", "ntd", "Berlin", 12, "BeCIX", true, true, "ups+generator", true, 6, 500, 1.3, 150, 110, 2, true, true],
  ["spree-colo", "Spree Colo", "spree", "Berlin", 3, null, false, false, "ups", true, 4, 250, 1.2, 90, 70, 8, false, false],
  ["data5-milano", "Data5 Milano", "data5", "Milan", 10, "MIXup", true, true, "ups+generator", false, 6, 500, 1.3, 160, 110, 2, true, true],
  ["arubaba-hub", "Arubaba Hub", "arubaba", "Milan", 4, null, false, true, "ups+generator", true, 6, 350, 1.2, 100, 80, 4, true, false],
  ["interaction-vie", "Interaction VIE", "interaction", "Vienna", 15, "VieX", true, true, "ups+generator", false, 6, 500, 1.3, 160, 120, 2, true, true],
  ["nextlair-vie", "Next Lair VIE", "nextlair", "Vienna", 4, "VieX", false, false, "ups+generator", false, 4, 300, 1.2, 100, 80, 4, false, false],
  ["equinox-zh4", "Equinox ZH4", "equinox", "Zurich", 15, "SwizzIX", true, true, "ups+generator", true, 8, 800, 1.5, 250, 160, 1, true, true],
  ["greenchz-lupfig", "Green.chz Lupfig", "greenchz", "Zurich", 6, "SwizzIX", false, true, "ups+generator", true, 6, 550, 1.3, 180, 120, 4, true, true],
];

const SIZE_OF: Record<string, Datacenter["size"]> = {
  equinox: "large", interaction: "large", globalsnitch: "large", tellyhouse: "large", data5: "large",
  hetzler: "medium", ironmolehill: "medium", ntd: "medium", nextlair: "medium", arubaba: "medium",
  mainqubes: "small", spree: "small", docklands: "small", greenchz: "small",
};

export const DATACENTERS: Datacenter[] = ROWS.map(([id, name, provider, city, carriers, ex, onSite, ab, backup, green, kw, price, factor, cross, perHour, responseHours, certified, cages]) => ({
  id, name, provider, city, carriers, exchange: ex ? { name: ex, onSite } : null, feeds: ab ? "ab" : "single", backup, green,
  kwPerPosition: kw, positionPrice: price, powerFactor: factor, crossConnect: cross, remoteHands: { perHour, responseHours }, certified, cages,
  size: SIZE_OF[provider],
}));

export const datacenterById = (id: string): Datacenter => {
  const dc = DATACENTERS.find((d) => d.id === id);
  if (!dc) throw new Error(`unknown datacenter ${id}`);
  return dc;
};

export const REGIONS: { id: string; name: string; city: string }[] = [
  { id: "fra", name: "Frankfurt", city: "Frankfurt" },
  { id: "ams", name: "Amsterdam", city: "Amsterdam" },
  { id: "lon", name: "London", city: "London" },
  { id: "par", name: "Paris", city: "Paris" },
  { id: "ber", name: "Berlin", city: "Berlin" },
  { id: "mil", name: "Milan", city: "Milan" },
  { id: "vie", name: "Vienna", city: "Vienna" },
  { id: "zrh", name: "Zurich", city: "Zurich" },
];
export const regionOf = (loc: { city: string }) => REGIONS.find((r) => r.city === loc.city)!;
// The region code plus the next free number in that region: fra1, fra2, ams1.
export function nextAz(locations: { city: string; az?: string }[], city: string): string {
  const code = regionOf({ city }).id;
  const taken = locations.filter((l) => l.az?.startsWith(code)).map((l) => Number(l.az!.slice(code.length)) || 0);
  return `${code}${Math.max(0, ...taken) + 1}`;
}

// Floor capacity in positions: the opening size, then a phase every few years from 2005 up to the final size.
export const SIZE_PLANS: Record<Datacenter["size"], { open: number; phase: number; everyYears: number; final: number }> = {
  large: { open: 300, phase: 150, everyYears: 3, final: 1200 },
  medium: { open: 120, phase: 60, everyYears: 4, final: 400 },
  small: { open: 40, phase: 20, everyYears: 5, final: 120 },
};
export function capacityAt(dc: Datacenter, year: number): number {
  const p = SIZE_PLANS[dc.size];
  return Math.min(p.final, p.open + p.phase * Math.floor(Math.max(0, year - 2005) / p.everyYears));
}
export const COMPETITOR_START = { min: 0.85, max: 0.97 } as const;
// Competitors' positions per datacenter, drawn from the seed without touching the game's rng.
export const seedDcs = (seed: number, year: number): Record<string, { others: number }> => Object.fromEntries(DATACENTERS.map((dc, i) => {
  const share = COMPETITOR_START.min + rand(hashRng(seed, i, 0xdc)) * (COMPETITOR_START.max - COMPETITOR_START.min);
  return [dc.id, { others: Math.round(capacityAt(dc, year) * share) }];
}));

export const RACK_MODELS: { id: RackModel; units: number; price: number }[] = [
  { id: "rack-24", units: 24, price: 350 },
  { id: "rack-42", units: 42, price: 800 },
  { id: "rack-47", units: 47, price: 1000 },
];

// The provider's rack that comes with a rack share of 1/size of a rack.
export const SHARE_RACKS: { id: RackModel; units: number; size: number }[] = [
  { id: "share-5", units: 5, size: 8 },
  { id: "share-10", units: 10, size: 4 },
  { id: "share-21", units: 21, size: 2 },
  { id: "share-42", units: 42, size: 1 },
];
export const rackUnits = (model: RackModel): number => [...RACK_MODELS, ...SHARE_RACKS].find((m) => m.id === model)!.units;

export const BASEMENT = { positions: 1, maxUnits: 24, kw: 3 } as const;
export const HOUSEHOLD_FACTOR = 1.6;

// Internet lines the basement can get, in Mbit/s and euros a month (docs/design/economy.md, Home line).
export interface HomeLine { id: string; isp: string; name: string; down: number; up: number; monthly: number; from: number; installDays: number; staticIp: boolean }
export const HOME_LINES: HomeLine[] = [
  { id: "dsl-16", isp: "Deutsche Telekomm", name: "DSL 16000", down: 16, up: 1, monthly: 0, from: 2005, installDays: 7, staticIp: false },
  { id: "sdsl-2", isp: "1&2", name: "SDSL 2048", down: 2, up: 2, monthly: 129, from: 2005, installDays: 14, staticIp: true },
  { id: "vdsl-50", isp: "Deutsche Telekomm", name: "VDSL 50", down: 50, up: 10, monthly: 45, from: 2007, installDays: 14, staticIp: false },
  { id: "cable-100", isp: "Vodafoam", name: "Cable 100", down: 100, up: 6, monthly: 40, from: 2010, installDays: 10, staticIp: false },
  { id: "vdsl-100", isp: "Deutsche Telekomm", name: "VDSL 100", down: 100, up: 40, monthly: 50, from: 2014, installDays: 14, staticIp: false },
  { id: "cable-400", isp: "Vodafoam", name: "Cable 400", down: 400, up: 25, monthly: 60, from: 2016, installDays: 10, staticIp: false },
  { id: "biz-fiber-1000", isp: "1&2", name: "Business Fiber 1000", down: 1000, up: 1000, monthly: 350, from: 2018, installDays: 30, staticIp: true },
  { id: "fiber-1000", isp: "Deutsche Glasfasel", name: "Fiber 1000", down: 1000, up: 500, monthly: 90, from: 2019, installDays: 30, staticIp: false },
  { id: "cable-1000", isp: "Vodafoam", name: "Cable 1000", down: 1000, up: 50, monthly: 80, from: 2019, installDays: 10, staticIp: false },
];
export const DEFAULT_HOME_LINE = "dsl-16";
export const homeLineById = (id: string): HomeLine => HOME_LINES.find((l) => l.id === id)!;

type RentedSpace = Exclude<SpaceKind, "basement">;
export const SPACE_SIZES: Record<RentedSpace, number[]> = { share: [8, 4, 2, 1], positions: [1, 2, 3, 4], cage: [4, 8, 16], suite: [20, 40] };
export const LEAD_DAYS: Record<RentedSpace, number> = { share: 2, positions: 7, cage: 30, suite: 90 };
// Shares, cages and suites cost a multiple of one position, by size; a share of size n is 1/n of a rack.
const MULTIPLIERS: Record<RentedSpace, Record<number, number>> = { share: { 8: 0.2, 4: 0.35, 2: 0.6, 1: 1.1 }, positions: { 1: 1, 2: 2, 3: 3, 4: 4 }, cage: { 4: 3.4, 8: 6.4, 16: 12 }, suite: { 20: 15, 40: 28 } };

export function spacePrice(dc: Datacenter, space: RentedSpace, positions: number): number {
  return Math.round(dc.positionPrice * (MULTIPLIERS[space][positions] ?? positions));
}

export const MOVE = { sameCity: { price: 300, hours: 24 }, otherCity: { price: 1200, hours: 72 } } as const;
