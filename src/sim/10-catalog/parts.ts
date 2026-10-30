// Part prices by year (economy.md, Prices over time, Part prices by year). Enterprise parts are priced in: RDIMM about 1.6 x
// consumer RAM, enterprise SSD about 1.5 x, enterprise HDD about 1.6 x.
import { erodedPrice } from "./lifecycle";
import { cardOf, gpuPrice } from "./gpu";
import { componentParts, manufacturerByName, modelById, type ComponentKind, type DeviceModel, type FormFactor, type PartSpec } from "./hardware";
import { cpuModel, skuById, type Vendor } from "./cpus";

type Keyframes = [year: number, price: number][];

// Straight lines between keyframes; flat before the first and after the last.
function lerp(k: Keyframes, year: number): number {
  if (year <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (year <= k[i][0]) return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (year - k[i - 1][0])) / (k[i][0] - k[i - 1][0]);
  }
  return k[k.length - 1][1];
}

// EUR per GB of RAM, per GB of SSD and NVMe, per TB of HDD, per core of CPU.
const RAM: Keyframes = [[2005, 200], [2008, 40], [2010, 45], [2012, 11], [2013, 8], [2014, 14], [2016, 8], [2018, 13], [2020, 5], [2023, 3.5], [2025, 7], [2026, 22], [2027, 30], [2028, 15]];
const SSD: Keyframes = [[2008, 12], [2010, 3], [2012, 1.5], [2013, 1], [2014, 0.7], [2016, 0.4], [2018, 0.35], [2020, 0.14], [2023, 0.07], [2025, 0.12], [2026, 0.3], [2027, 0.35], [2028, 0.2]];
const NVME: Keyframes = [[2014, 1.2], [2016, 0.65], [2018, 0.5], [2020, 0.18], [2023, 0.09], [2025, 0.14], [2026, 0.33], [2027, 0.38], [2028, 0.22]];
const HDD: Keyframes = [[2005, 500], [2008, 200], [2010, 100], [2012, 60], [2013, 50], [2014, 42], [2016, 40], [2018, 35], [2020, 25], [2023, 18], [2025, 16], [2026, 15], [2027, 15], [2028, 14]];
const CPU: Keyframes = [[2005, 200], [2008, 120], [2010, 90], [2012, 70], [2013, 65], [2014, 60], [2016, 50], [2018, 45], [2020, 35], [2023, 30], [2025, 28], [2026, 28], [2027, 28], [2028, 27]];
const PSU: Keyframes = [[2005, 150], [2015, 90]];
const BOARD: Keyframes = [[2005, 600], [2015, 400]];
const NIC: Keyframes = [[2005, 80], [2015, 40]];
const FAN = 25;

// First year a kind is sold.
const SOLD_FROM: Partial<Record<ComponentKind, number>> = { ssd: 2009, nvme: 2014, gpu: 2007 };
export const partSold = (kind: ComponentKind, year: number): boolean => year >= (SOLD_FROM[kind] ?? 0);

// A part of unknown size counts as one unit (1 GB, 1 GB of HDD, 1 core). The price is a whole euro; a CPU's follows its part's
// price factor, or its vendor's generation factor for a part without a name (cpus.ts).
export const partPrice = (kind: ComponentKind, size: number | undefined, _ff: FormFactor | undefined, year: number, cpu?: Pick<PartSpec, "vendor" | "gen" | "sku">): number =>
  Math.round(rawPrice(kind, size ?? 1, year) * (kind === "cpu" ? (cpu?.sku && skuById(cpu.sku)?.price) || (cpu?.vendor && cpu.gen ? cpuModel(cpu.vendor, cpu.gen)?.price ?? 1 : 1) : 1));
function rawPrice(kind: ComponentKind, n: number, year: number): number {
  switch (kind) {
    case "ram": return n * lerp(RAM, year);
    case "ssd": return n * lerp(SSD, year);
    case "nvme": return n * lerp(NVME, year);
    case "hdd": return (n / 1000) * lerp(HDD, year);
    case "cpu": return n * lerp(CPU, year);
    case "psu": return lerp(PSU, year);
    case "board": return lerp(BOARD, year);
    case "fan": return FAN;
    // 10G ports were fitted at 4 x until 2017, then 2 x.
    case "nic": return lerp(NIC, year) * (year >= 2017 ? 2 : year >= 2011 ? 4 : 1);
    // A GPU card's size is its launch year; the price rule is in gpu.ts.
    case "gpu": return gpuPrice(cardOf(n), year);
  }
}
export const partsPrice = (parts: PartSpec[], year: number): number => parts.reduce((n, p) => n + partPrice(p.kind, p.size, p.ff, year, p), 0);

// A chassis never costs less than this share of the preset's list price.
export const CHASSIS_FLOOR = 0.25;

// The preset's list price minus its parts at its generation's launch year prices.
export function chassisPrice(m: DeviceModel): number {
  return Math.max(Math.round(m.price * CHASSIS_FLOOR), Math.round(m.price - partsPrice(componentParts(m), m.from)));
}

// Where the floor binds the parts cost more than the list price leaves for them, so the preset buys them at a share of
// their price; the launch year price stays the list price.
const partShare = (m: DeviceModel): number => (m.price - chassisPrice(m)) / partsPrice(componentParts(m), m.from);

// A whole server never costs more than this share of its parts bought one by one.
export const BUNDLE = 0.9;

// What a preset costs in a year: its chassis plus its parts with the vendor's CPUs (the cpu part when named) at that year's
// prices, but at most BUNDLE of the parts alone, times the brand's price factor.
export function presetPrice(m: DeviceModel, year: number, brand?: string, vendor?: Vendor, cpu?: string): number {
  if (m.nodes) return m.nodes.count * presetPrice(modelById(m.nodes.model), year, brand, vendor, cpu);
  const factor = (!m.brand && brand && manufacturerByName(brand)?.priceFactor) || 1;
  if (!m.server) return Math.round(erodedPrice(m, m.price, year) * factor);
  const parts = partsPrice(componentParts(m, vendor, cpu), year);
  return Math.round(Math.min(chassisPrice(m) + partShare(m) * parts, BUNDLE * parts) * factor);
}
