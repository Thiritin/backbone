// Values come from docs/design/economy.md (Datacenters and space).
import type { RackModel, SpaceKind } from "../50-state";

export interface Provider { id: string; name: string }
export interface Datacenter {
  id: string; name: string; provider: string; city: string; carriers: number;
  exchange: { name: string; onSite: boolean } | null;
  feeds: "single" | "ab"; backup: "none" | "ups" | "ups+generator"; green: boolean;
  kwPerPosition: number; positionPrice: number; powerFactor: number; crossConnect: number;
  remoteHands: { perHour: number; responseHours: number }; certified: boolean; cages: boolean;
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

export const DATACENTERS: Datacenter[] = ROWS.map(([id, name, provider, city, carriers, ex, onSite, ab, backup, green, kw, price, factor, cross, perHour, responseHours, certified, cages]) => ({
  id, name, provider, city, carriers, exchange: ex ? { name: ex, onSite } : null, feeds: ab ? "ab" : "single", backup, green,
  kwPerPosition: kw, positionPrice: price, powerFactor: factor, crossConnect: cross, remoteHands: { perHour, responseHours }, certified, cages,
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

type RentedSpace = Exclude<SpaceKind, "basement">;
export const SPACE_SIZES: Record<RentedSpace, number[]> = { share: [8, 4, 2, 1], positions: [1, 2, 3, 4], cage: [4, 8, 16], suite: [20, 40] };
export const LEAD_DAYS: Record<RentedSpace, number> = { share: 2, positions: 7, cage: 30, suite: 90 };
// Shares, cages and suites cost a multiple of one position, by size; a share of size n is 1/n of a rack.
const MULTIPLIERS: Record<RentedSpace, Record<number, number>> = { share: { 8: 0.2, 4: 0.35, 2: 0.6, 1: 1.1 }, positions: { 1: 1, 2: 2, 3: 3, 4: 4 }, cage: { 4: 3.4, 8: 6.4, 16: 12 }, suite: { 20: 15, 40: 28 } };

export function spacePrice(dc: Datacenter, space: RentedSpace, positions: number): number {
  return Math.round(dc.positionPrice * (MULTIPLIERS[space][positions] ?? positions));
}

export const MOVE = { sameCity: { price: 300, hours: 24 }, otherCity: { price: 1200, hours: 72 } } as const;
