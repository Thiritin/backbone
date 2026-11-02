import { t } from "../../i18n/en";
// Values come from docs/design/economy.md (Datacenters and space).
import { hashRng, rand } from "../00-core/rng";
import { businessPowerPrice } from "../10-catalog/economy";
import type { RackModel, SpaceKind } from "../50-state";

// host is bare; the Browser also takes it with www.
export interface Provider { id: string; name: string; host: string }
export interface Datacenter {
  id: string; name: string; provider: string; city: string; carriers: number;
  exchange: { name: string; onSite: boolean } | null;
  feeds: "single" | "ab"; backup: "none" | "ups" | "ups+generator"; green: boolean;
  kwPerPosition: number; positionPrice: number; powerFactor: number; crossConnect: number;
  remoteHands: { perHour: number; responseHours: number }; certified: boolean; cages: boolean;
  size: "large" | "medium" | "small";
  // Premium rooms of a city (the highest position price, with a rival in town) only let a visitor in on a booked slot.
  visitBooking: boolean;
  // How a rack position bills power: per kWh, as a flat-rate contract, or either.
  power: "metered" | "flat" | "both";
}

export const PROVIDERS: Provider[] = [
  { id: "equinox", name: "Equinox", host: "equinox.com" },
  { id: "interaction", name: "Interaction", host: "interaction.com" },
  { id: "mainqubes", name: "mainqubes", host: "mainqubes.de" },
  { id: "hetzler", name: "Hetzler", host: "hetzler.de" },
  { id: "tellyhouse", name: "Tellyhouse", host: "tellyhouse.co.uk" },
  { id: "globalsnitch", name: "Global Snitch", host: "globalsnitch.com" },
  { id: "docklands", name: "Docklands Data", host: "docklandsdata.co.uk" },
  { id: "ironmolehill", name: "Iron Molehill", host: "ironmolehill.com" },
  { id: "data5", name: "Data5", host: "data5group.com" },
  { id: "ntd", name: "NTD", host: "ntd-global.com" },
  { id: "spree", name: "Spree Colo", host: "spreecolo.de" },
  { id: "arubaba", name: "Arubaba", host: "arubaba.it" },
  { id: "nextlair", name: "Next Lair", host: "nextlair.at" },
  { id: "greenchz", name: "Green.chz", host: "greenchz.ch" },
  { id: "skyblink", name: "SkyBlink", host: "skyblink.nl" },
  { id: "borisnet", name: "Boris Network", host: "boris.de" },
  { id: "digitalreality", name: "Digital Reality", host: "digitalreality.com" },
  { id: "corespite", name: "CoreSpite", host: "corespite.com" },
  { id: "telex", name: "Telex", host: "telex.com" },
  { id: "myloch", name: "myLoch", host: "myloch.de" },
];

type Row = [id: string, name: string, provider: string, city: string, carriers: number, exchange: string | null, onSite: boolean,
  ab: boolean, backup: Datacenter["backup"], green: boolean, kw: number, price: number, factor: number, cross: number,
  handsPerHour: number, handsHours: number, certified: boolean, cages: boolean, power: Datacenter["power"]];

const ROWS: Row[] = [
  ["equinox-fr5", "Equinox FR5", "equinox", "Frankfurt", 30, "DE-KICKS", true, true, "ups+generator", true, 8, 750, 1.4, 250, 150, 1, true, true, "metered"],
  ["interaction-fra", "Interaction FRA", "interaction", "Frankfurt", 25, "DE-KICKS", true, true, "ups+generator", false, 6, 600, 1.3, 200, 120, 2, true, true, "metered"],
  ["mainqubes-fra", "mainqubes FRA", "mainqubes", "Frankfurt", 12, "DE-KICKS", false, true, "ups+generator", true, 6, 450, 1.3, 150, 100, 4, true, true, "metered"],
  ["hetzler-park", "Hetzler Park", "hetzler", "Frankfurt", 1, null, false, false, "ups+generator", true, 4, 180, 1.1, 80, 60, 8, false, false, "both"],
  ["tellyhouse-north", "Tellyhouse North", "tellyhouse", "London", 30, "LYNX", true, true, "ups+generator", false, 6, 800, 1.5, 300, 160, 1, true, true, "metered"],
  ["globalsnitch-lon", "Global Snitch LON", "globalsnitch", "London", 20, "LYNX", false, true, "ups+generator", true, 8, 700, 1.4, 250, 140, 2, true, true, "metered"],
  ["docklands-data", "Docklands Data", "docklands", "London", 3, null, false, false, "ups", false, 4, 350, 1.2, 100, 80, 8, false, false, "both"],
  ["equinox-am3", "Equinox AM3", "equinox", "Amsterdam", 25, "HAMS-IX", true, true, "ups+generator", true, 8, 650, 1.3, 220, 140, 1, true, true, "metered"],
  ["ironmolehill-ams", "Iron Molehill AMS", "ironmolehill", "Amsterdam", 10, "HAMS-IX", false, true, "ups+generator", true, 10, 500, 1.2, 180, 110, 4, true, true, "metered"],
  ["tellyhouse-voltaire", "Tellyhouse Voltaire", "tellyhouse", "Paris", 25, "Franz-IX", true, true, "ups+generator", false, 6, 650, 1.3, 220, 140, 2, true, true, "metered"],
  ["data5-marcoussis", "Data5 Marcoussis", "data5", "Paris", 8, "Franz-IX", false, true, "ups+generator", true, 10, 450, 1.2, 150, 100, 4, true, true, "metered"],
  ["ntd-berlin1", "NTD Berlin 1", "ntd", "Berlin", 12, "BeCIX", true, true, "ups+generator", true, 6, 500, 1.3, 150, 110, 2, true, true, "metered"],
  ["spree-colo", "Spree Colo", "spree", "Berlin", 3, null, false, false, "ups", true, 4, 250, 1.2, 90, 70, 8, false, false, "both"],
  ["data5-milano", "Data5 Milano", "data5", "Milan", 10, "MIXup", true, true, "ups+generator", false, 6, 500, 1.3, 160, 110, 2, true, true, "metered"],
  ["arubaba-hub", "Arubaba Hub", "arubaba", "Milan", 4, null, false, true, "ups+generator", true, 6, 350, 1.2, 100, 80, 4, true, false, "both"],
  ["interaction-vie", "Interaction VIE", "interaction", "Vienna", 15, "VieX", true, true, "ups+generator", false, 6, 500, 1.3, 160, 120, 2, true, true, "metered"],
  ["nextlair-vie", "Next Lair VIE", "nextlair", "Vienna", 4, "VieX", false, false, "ups+generator", false, 4, 300, 1.2, 100, 80, 4, false, false, "both"],
  ["equinox-zh4", "Equinox ZH4", "equinox", "Zurich", 15, "SwizzIX", true, true, "ups+generator", true, 8, 800, 1.5, 250, 160, 1, true, true, "metered"],
  ["greenchz-lupfig", "Green.chz Lupfig", "greenchz", "Zurich", 6, "SwizzIX", false, true, "ups+generator", true, 6, 550, 1.3, 180, 120, 4, true, true, "metered"],
  ["equinox-du1", "Equinox DU1", "equinox", "Düsseldorf", 18, "ECKS-IX", true, true, "ups+generator", true, 8, 650, 1.35, 220, 140, 1, true, true, "metered"],
  ["interaction-dus", "Interaction DUS", "interaction", "Düsseldorf", 14, "ECKS-IX", false, true, "ups+generator", false, 6, 520, 1.3, 180, 110, 2, true, true, "metered"],
  ["ntd-dus1", "NTD Düsseldorf 1", "ntd", "Düsseldorf", 10, "ECKS-IX", false, true, "ups+generator", true, 6, 430, 1.25, 140, 100, 2, true, true, "metered"],
  ["myloch-dus", "myLoch DUS", "myloch", "Düsseldorf", 8, "ECKS-IX", false, true, "ups+generator", false, 6, 380, 1.2, 120, 80, 4, true, true, "both"],
  ["skyblink-eygelshoven", "SkyBlink Eygelshoven", "skyblink", "Kerkrade", 20, null, false, true, "ups+generator", true, 6, 300, 1.15, 60, 60, 2, true, false, "both"],
  ["hetzler-nbg", "Hetzler NBG", "hetzler", "Nuremberg", 1, null, false, false, "ups+generator", true, 4, 170, 1.1, 80, 60, 8, false, false, "flat"],
  ["boris-nbg", "Boris Network NBG", "borisnet", "Nuremberg", 10, "N-ICKS", true, true, "ups+generator", true, 6, 420, 1.25, 150, 100, 2, true, true, "metered"],
  ["hetzler-fsn", "Hetzler FSN", "hetzler", "Falkenstein", 1, null, false, false, "ups+generator", true, 4, 160, 1.1, 80, 60, 8, false, false, "both"],
  ["equinox-mu1", "Equinox MU1", "equinox", "Munich", 15, "IN-EXCESS", true, true, "ups+generator", true, 8, 700, 1.4, 230, 150, 1, true, true, "metered"],
  ["interaction-muc", "Interaction MUC", "interaction", "Munich", 10, "IN-EXCESS", false, true, "ups+generator", false, 6, 550, 1.3, 180, 120, 2, true, true, "metered"],
  ["equinox-dc2", "Equinox DC2", "equinox", "Ashburn", 60, "Equinox IX", true, true, "ups+generator", false, 8, 650, 1.15, 200, 130, 1, true, true, "metered"],
  ["digitalreality-ash", "Digital Reality ACC", "digitalreality", "Ashburn", 25, "Equinox IX", false, true, "ups+generator", false, 10, 480, 1.1, 150, 100, 2, true, true, "metered"],
  ["corespite-va1", "CoreSpite VA1", "corespite", "Ashburn", 15, "Equinox IX", false, true, "ups+generator", false, 8, 420, 1.1, 120, 90, 4, true, true, "both"],
  ["equinox-ny4", "Equinox NY4", "equinox", "New York", 45, "NYIKES", true, true, "ups+generator", false, 8, 800, 1.4, 250, 160, 1, true, true, "metered"],
  ["telex-60hudson", "Telex 60 Hudson", "telex", "New York", 35, "NYIKES", false, true, "ups+generator", false, 5, 700, 1.45, 220, 150, 2, true, true, "metered"],
  ["digitalreality-cermak", "Digital Reality 350 Cermak", "digitalreality", "Chicago", 40, "CHI-KICKS", true, true, "ups+generator", false, 8, 550, 1.2, 180, 120, 2, true, true, "metered"],
  ["corespite-ch1", "CoreSpite CH1", "corespite", "Chicago", 15, "CHI-KICKS", false, true, "ups+generator", false, 8, 450, 1.15, 140, 100, 4, true, true, "both"],
  ["equinox-da1", "Equinox DA1", "equinox", "Dallas", 30, "Y'ALL-IX", true, true, "ups+generator", false, 8, 500, 1.1, 170, 120, 2, true, true, "metered"],
  ["digitalreality-dfw", "Digital Reality DFW", "digitalreality", "Dallas", 12, "Y'ALL-IX", false, true, "ups+generator", false, 10, 400, 1.05, 130, 90, 4, true, true, "metered"],
  ["corespite-la1", "CoreSpite One Wilshire", "corespite", "Los Angeles", 60, "Any3", true, true, "ups+generator", false, 6, 750, 1.45, 230, 150, 1, true, true, "metered"],
  ["equinox-la1", "Equinox LA1", "equinox", "Los Angeles", 30, "Any3", false, true, "ups+generator", false, 8, 650, 1.4, 210, 140, 2, true, true, "metered"],
];

const SIZE_OF: Record<string, Datacenter["size"]> = {
  equinox: "large", interaction: "large", globalsnitch: "large", tellyhouse: "large", data5: "large",
  hetzler: "medium", ironmolehill: "medium", ntd: "medium", nextlair: "medium", arubaba: "medium",
  mainqubes: "small", spree: "small", docklands: "small", greenchz: "small",
  digitalreality: "large", borisnet: "medium", corespite: "medium", telex: "medium", skyblink: "small", myloch: "small",
};

const topPrice = (city: string) => Math.max(...ROWS.filter((r) => r[3] === city).map((r) => r[11]));
const rivals = (city: string) => ROWS.filter((r) => r[3] === city).length > 1;

export const DATACENTERS: Datacenter[] = ROWS.map(([id, name, provider, city, carriers, ex, onSite, ab, backup, green, kw, price, factor, cross, perHour, responseHours, certified, cages, power]) => ({
  id, name, provider, city, carriers, exchange: ex ? { name: ex, onSite } : null, feeds: ab ? "ab" : "single", backup, green,
  kwPerPosition: kw, positionPrice: price, powerFactor: factor, crossConnect: cross, remoteHands: { perHour, responseHours }, certified, cages, power,
  size: SIZE_OF[provider], visitBooking: rivals(city) && price === topPrice(city),
}));

export const dcProvider = (id: string): Provider => PROVIDERS.find((p) => p.id === id)!;
export const datacenterById = (id: string): Datacenter => {
  const dc = DATACENTERS.find((d) => d.id === id);
  if (!dc) throw new Error(`unknown datacenter ${id}`);
  return dc;
};

// us marks the North American regions; links and moves across the Atlantic cost more.
export const REGIONS: { id: string; name: string; city: string; us?: true }[] = [
  { id: "fra", name: "Frankfurt", city: "Frankfurt" },
  { id: "ams", name: "Amsterdam", city: "Amsterdam" },
  { id: "lon", name: "London", city: "London" },
  { id: "par", name: "Paris", city: "Paris" },
  { id: "ber", name: "Berlin", city: "Berlin" },
  { id: "mil", name: "Milan", city: "Milan" },
  { id: "vie", name: "Vienna", city: "Vienna" },
  { id: "zrh", name: "Zurich", city: "Zurich" },
  { id: "dus", name: "Düsseldorf", city: "Düsseldorf" },
  { id: "ker", name: "Kerkrade", city: "Kerkrade" },
  { id: "nue", name: "Nuremberg", city: "Nuremberg" },
  { id: "fsn", name: "Falkenstein", city: "Falkenstein" },
  { id: "muc", name: "Munich", city: "Munich" },
  { id: "ash", name: "Ashburn", city: "Ashburn", us: true },
  { id: "nyc", name: "New York", city: "New York", us: true },
  { id: "chi", name: "Chicago", city: "Chicago", us: true },
  { id: "dfw", name: "Dallas", city: "Dallas", us: true },
  { id: "lax", name: "Los Angeles", city: "Los Angeles", us: true },
];
export const COUNTRY: Record<string, string> = {
  Frankfurt: "DE", Berlin: "DE", "Düsseldorf": "DE", Nuremberg: "DE", Falkenstein: "DE", Munich: "DE", Amsterdam: "NL", Kerkrade: "NL",
  London: "GB", Paris: "FR", Milan: "IT", Vienna: "AT", Zurich: "CH",
  Ashburn: "US", "New York": "US", Chicago: "US", Dallas: "US", "Los Angeles": "US",
};
export const regionOf =(loc: { city: string }) => REGIONS.find((r) => r.city === loc.city)!;
export const inUs = (city: string): boolean => REGIONS.some((r) => r.city === city && r.us);
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
// A circuit carries 80% of its limit continuously; a draw above that for three hours trips its breaker.
export const CONTINUOUS = { share: 0.8, hours: 3 } as const;
export const HOUSEHOLD_FACTOR = 1.6;

// Internet lines the basement can get, in Mbit/s and euros a month (docs/design/economy.md, Home line).
export interface HomeLine { id: string; isp: string; name: string; down: number; up: number; monthly: number; from: number; installDays: number; staticIp: boolean }
export const HOME_LINES: HomeLine[] = [
  { id: "dsl-16", isp: "Deutsche Telekomm", name: "DSL 16000", down: 16, up: 1, monthly: 45, from: 2005, installDays: 7, staticIp: false },
  { id: "dsl-16-biz", isp: "Deutsche Telekomm", name: "DSL 16000 Business", down: 16, up: 1, monthly: 59, from: 2005, installDays: 14, staticIp: true },
  { id: "sdsl-2", isp: "1&2", name: "SDSL 2048", down: 2, up: 2, monthly: 129, from: 2005, installDays: 14, staticIp: true },
  { id: "vdsl-50", isp: "Deutsche Telekomm", name: "VDSL 50", down: 50, up: 10, monthly: 45, from: 2007, installDays: 14, staticIp: false },
  { id: "vdsl-50-biz", isp: "Deutsche Telekomm", name: "VDSL 50 Business", down: 50, up: 10, monthly: 99, from: 2008, installDays: 14, staticIp: true },
  { id: "vdsl-100-biz", isp: "Deutsche Telekomm", name: "VDSL 100 Business", down: 100, up: 40, monthly: 129, from: 2014, installDays: 14, staticIp: true },
  { id: "cable-100", isp: "Vodafoam", name: "Cable 100", down: 100, up: 6, monthly: 40, from: 2010, installDays: 10, staticIp: false },
  { id: "vdsl-100", isp: "Deutsche Telekomm", name: "VDSL 100", down: 100, up: 40, monthly: 50, from: 2014, installDays: 14, staticIp: false },
  { id: "cable-400", isp: "Vodafoam", name: "Cable 400", down: 400, up: 25, monthly: 60, from: 2016, installDays: 10, staticIp: false },
  { id: "biz-fiber-1000", isp: "1&2", name: "Business Fiber 1000", down: 1000, up: 1000, monthly: 350, from: 2018, installDays: 30, staticIp: true },
  { id: "fiber-1000", isp: "Deutsche Glasfasel", name: "Fiber 1000", down: 1000, up: 500, monthly: 90, from: 2019, installDays: 30, staticIp: false },
  { id: "cable-1000", isp: "Vodafoam", name: "Cable 1000", down: 1000, up: 50, monthly: 80, from: 2019, installDays: 10, staticIp: false },
];
export const DEFAULT_HOME_LINE = "dsl-16";
// The basement before its first line goes live.
export const NO_LINE: HomeLine = { id: "", isp: "", get name() { return t("sim.line.none"); }, down: 0, up: 0, monthly: 0, from: 2005, installDays: 0, staticIp: false };
// The private line at Mom's that a new game starts on. Mom pays for it, so it never shows up on the ledger, and it cannot be ordered back.
export const MOMS_DSL: HomeLine = { id: "moms-dsl", isp: "Deutsche Telekomm", name: "Mom's DSL", down: 6, up: 0.5, monthly: 0, from: 2005, installDays: 0, staticIp: false };
export const homeLineById = (id: string): HomeLine => (id === MOMS_DSL.id ? MOMS_DSL : HOME_LINES.find((l) => l.id === id) ?? NO_LINE);

type RentedSpace = Exclude<SpaceKind, "basement">;
export const SPACE_SIZES: Record<RentedSpace, number[]> = { share: [8, 4, 2, 1], cage: [4, 8, 16], suite: [20, 40] };
export const LEAD_DAYS: Record<RentedSpace, number> = { share: 2, cage: 30, suite: 90 };
// Months of notice to the end of a month before a rented space is handed back.
export const NOTICE_MONTHS: Record<RentedSpace, number> = { share: 1, cage: 3, suite: 6 };
// The large carrier-neutral providers offer a cancelled contract one free month for staying, once per contract.
export const RETENTION_PROVIDERS = ["equinox", "digitalreality", "interaction", "ntd", "telex", "corespite"];
// Shares, cages and suites cost a multiple of one position, by size; a share of size n is 1/n of a rack.
const MULTIPLIERS: Record<RentedSpace, Record<number, number>> = { share: { 8: 0.2, 4: 0.35, 2: 0.6, 1: 1.1 }, cage: { 4: 3.4, 8: 6.4, 16: 12 }, suite: { 20: 15, 40: 28 } };

// prices is GameState.providerPrices; without it the list price applies.
export function spacePrice(dc: Datacenter, space: RentedSpace, positions: number, prices?: Record<string, number>): number {
  return Math.round(dc.positionPrice * (prices?.[dc.provider] ?? 1) * (MULTIPLIERS[space][positions] ?? positions));
}
// A cross-connect's one-off setup fee, two months of its monthly price.
export const crossConnectSetup = (dc: Datacenter): number => 2 * dc.crossConnect;

// Extra power on a provided share: steps of 0.25 kW up to the share's base limit again, billed monthly with the rent.
export const EXTRA_STEP_KW = 0.25;
export const EXTRA_POWER_LEAD_DAYS = 3;
export const shareBaseKw = (dc: Datacenter, size: number): number => dc.kwPerPosition / size;
export const maxExtraKw = (dc: Datacenter, size: number): number => Math.floor(shareBaseKw(dc, size) / EXTRA_STEP_KW) * EXTRA_STEP_KW;
export const extraStepPrice = (dc: Datacenter): number => Math.round(dc.positionPrice * dc.powerFactor * 0.15);

// Flat-rate power on a rack position: two feeds of 10 A or 16 A at 230 V, the contract's kW as the breaker limit, billed monthly at
// the metered cost of drawing FLAT_LOAD of it.
export const FLAT_CONTRACTS = [{ amps: 10, kw: 4.4 }, { amps: 16, kw: 7 }] as const;
export const FLAT_LOAD = 0.6;
const HOURS_PER_MONTH = 730;
export const flatMonthly = (dc: Datacenter, kw: number, year: number): number =>
  Math.round(kw * FLAT_LOAD * HOURS_PER_MONTH * businessPowerPrice(year) * dc.powerFactor);

export const MOVE = { sameCity: { price: 300, hours: 24 }, otherCity: { price: 1200, hours: 72 }, overseas: { price: 4000, hours: 240 } } as const;
