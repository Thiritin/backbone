// docs/design/gdd/connectivity.md and docs/design/economy/connectivity.md: uplink speeds by year band and their monthly line price.
// Speeds are Gbit/s. A band holds from its year until the next band's year.
export interface UplinkBand { year: number; floor: number; standard: number; ceiling: number; prices: Record<number, number> }

export const UPLINK_BANDS: UplinkBand[] = [
  { year: 2005, floor: 0.01, standard: 0.1, ceiling: 1, prices: { 0.01: 60, 0.1: 150, 1: 400 } },
  { year: 2010, floor: 0.1, standard: 1, ceiling: 10, prices: { 0.1: 100, 1: 250, 10: 900 } },
  { year: 2015, floor: 0.1, standard: 1, ceiling: 40, prices: { 0.1: 80, 1: 200, 10: 650, 40: 1500 } },
  { year: 2020, floor: 1, standard: 10, ceiling: 100, prices: { 1: 150, 10: 450, 25: 800, 40: 1100, 100: 2200 } },
  { year: 2025, floor: 1, standard: 10, ceiling: 400, prices: { 1: 120, 10: 350, 25: 600, 100: 1600, 400: 5000 } },
  { year: 2030, floor: 10, standard: 100, ceiling: 1600, prices: { 10: 300, 25: 500, 100: 1200, 400: 3500, 800: 6000, 1600: 10000 } },
];

export const uplinkBand = (year: number): UplinkBand => UPLINK_BANDS.filter((b) => b.year <= year).at(-1) ?? UPLINK_BANDS[0];
// The speeds that can be booked in the year, slowest first.
export const uplinkOffers = (year: number): number[] => Object.keys(uplinkBand(year).prices).map(Number).sort((a, b) => a - b);
// The monthly price of one line; a speed the band does not sell keeps the price of the band that last sold it.
export function uplinkPrice(gbit: number, year: number): number {
  for (const b of UPLINK_BANDS.filter((x) => x.year <= year).reverse()) if (b.prices[gbit] !== undefined) return b.prices[gbit];
  return UPLINK_BANDS.find((b) => b.prices[gbit] !== undefined)?.prices[gbit] ?? 0;
}

// Pluggable port kinds above 10 Gbit/s, the fastest speed each takes, the year its module is sold and the module's price.
export type OpticKind = "sfp+" | "qsfp28" | "qsfp-dd" | "osfp" | "ib";
export const OPTICS: { kind: OpticKind; gbit: number; from: number; price: number }[] = [
  { kind: "sfp+", gbit: 10, from: 2005, price: 120 },
  { kind: "qsfp28", gbit: 100, from: 2015, price: 400 },
  { kind: "qsfp-dd", gbit: 400, from: 2020, price: 900 },
  { kind: "osfp", gbit: 800, from: 2025, price: 1500 },
  { kind: "ib", gbit: 1600, from: 2030, price: 2500 },
];
// The port kind a line of this speed needs, null up to 10 Gbit/s where any port of the speed takes it.
export const opticFor = (gbit: number): (typeof OPTICS)[number] | null => (gbit <= 10 ? null : OPTICS.find((o) => o.gbit >= gbit) ?? null);
// The port kind of a router or switch port of this speed: a module part's size is the port speed it fits.
export const portOptic = (portGbit: number, media?: string): (typeof OPTICS)[number] | null =>
  media === "ib" ? OPTICS.find((o) => o.kind === "ib")! : portGbit <= 10 ? null : OPTICS.find((o) => o.kind !== "ib" && o.gbit >= portGbit) ?? null;
export const opticsOn = (year: number) => OPTICS.filter((o) => o.from <= year);

// Provider cable between two racks of the same building: one-time fee in euros, billed on completion, and its lead time.
export const PROVIDER_CABLE = { fee: 150, leadHours: 2 * 24 } as const;
export const PROVIDER_PANEL = "panel-provider";
export const PANEL_JACKS = 24;
