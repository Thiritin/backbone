// CPU makers per generation (economy.md, Prices over time, CPU vendors): two x86 makers that swap the lead and an ARM maker
// from 2020. Anchors: Opteron 2005, Xeon 5500 2009, EPYC 2017, Ampere Altra 2020.
import { GENERATIONS } from "./economy";

export type Vendor = "indel" | "amb" | "ampear";
export const VENDORS: Vendor[] = ["indel", "amb", "ampear"];
export const VENDOR_NAME: Record<Vendor, string> = { indel: "Indel", amb: "AMB", ampear: "Ampear" };
export const VENDOR_ARCH: Record<Vendor, "x86" | "arm"> = { indel: "x86", amb: "x86", ampear: "arm" };
export const defaultVendor = (arch: "x86" | "arm"): Vendor => (arch === "arm" ? "ampear" : "indel");

// gen is 1 for G1. cores per socket of a full socket (the compute-dense line's); smaller lines take a share of it. perCore is
// the speed of one core, ghz its clock, watts the draw of a full socket, price the factor on the per-core CPU price. socket is
// the board socket the CPU fits: a socket carries on through more than one generation, so an older board takes a newer CPU of it.
export interface CpuModel { vendor: Vendor; gen: number; from: number; cores: number; ghz: number; perCore: number; watts: number; price: number; socket: string }

// Clock in GHz per generation: Indel starts high and gives clock back for cores, AMB holds a steadier clock and gains it back late.
const INDEL_GHZ = [3.0, 2.8, 2.9, 2.6, 2.5, 2.4, 2.3];
const AMB_GHZ = [2.4, 2.2, 2.4, 2.3, 2.2, 2.45, 2.5];
const AMPEAR_GHZ = [0, 0, 0, 0, 0, 2.8, 3.0];
// Socket per generation. AMB keeps a socket for longer than Indel, so its boards upgrade further.
const INDEL_SOCKET = ["I1", "I1", "I2", "I2", "I3", "I3", "I4"];
const AMB_SOCKET = ["A1", "A1", "A1", "A2", "A2", "A3", "A3"];
const AMPEAR_SOCKET = ["", "", "", "", "", "P1", "P1"];

const INDEL: [perCore: number, watts: number][] = [[0.9, 110], [1.15, 130], [1.15, 130], [1.15, 165], [1.05, 205], [1.05, 270], [1.05, 320]];
const AMB: [cores: number, perCore: number, watts: number, price: number][] = [
  [1, 1.0, 95, 1], [1, 0.95, 145, 0.8], [1, 0.95, 145, 0.8], [1, 0.95, 180, 0.8],
  // From G5, 1.6 times the cores at 0.8 the price per socket, so 0.5 per core.
  [1.6, 0.95, 180, 0.5], [1.6, 0.95, 225, 0.5], [1.6, 0.95, 360, 0.5],
];
export const CPU_MODELS: CpuModel[] = GENERATIONS.flatMap((g, i): CpuModel[] => {
  const [perCore, watts] = INDEL[i], [k, ambPerCore, ambWatts, ambPrice] = AMB[i];
  return [
    { vendor: "indel", gen: i + 1, from: g.year, cores: g.cores, ghz: INDEL_GHZ[i], perCore, watts, price: 1, socket: INDEL_SOCKET[i] },
    { vendor: "amb", gen: i + 1, from: g.year, cores: Math.round(g.cores * k), ghz: AMB_GHZ[i], perCore: ambPerCore, watts: ambWatts, price: ambPrice, socket: AMB_SOCKET[i] },
    // Half the watts per core of the generation's Indel part, at 0.7 the price per core.
    ...(g.year >= 2020 ? [{ vendor: "ampear" as const, gen: i + 1, from: g.year, cores: g.cores, ghz: AMPEAR_GHZ[i], perCore: 0.8, watts: watts / 2, price: 0.7, socket: AMPEAR_SOCKET[i] }] : []),
  ];
});
export const cpuModel = (vendor: Vendor, gen: number): CpuModel | undefined => CPU_MODELS.find((c) => c.vendor === vendor && c.gen === gen);
// The socket of a vendor's CPUs in a generation; undefined where the vendor builds none.
export const socketOf = (vendor: Vendor, gen: number): string | undefined => cpuModel(vendor, gen)?.socket;
// The generations whose CPUs a board of this vendor and generation takes.
export const socketGens = (vendor: Vendor, gen: number): number[] => CPU_MODELS.filter((c) => c.vendor === vendor && c.socket === socketOf(vendor, gen)).map((c) => c.gen);

// The generation of a server model, 1 for G1.
export const genOfYear = (from: number): number => GENERATIONS.findIndex((g) => g.year === from) + 1;
// The makers that build CPUs for a chassis of this architecture and generation.
export const vendorsAt = (arch: "x86" | "arm", gen: number): Vendor[] => VENDORS.filter((v) => VENDOR_ARCH[v] === arch && !!cpuModel(v, gen));

// Cores of one socket of a vendor for a chassis whose Indel preset has presetCores per socket.
export const socketCores = (presetCores: number, vendor: Vendor, gen: number): number =>
  Math.max(1, Math.round((presetCores * (cpuModel(vendor, gen)?.cores ?? 1)) / (cpuModel("indel", gen)?.cores ?? 1)));
// What one CPU draws: its share of a full socket's watts.
export const cpuWatts = (vendor: Vendor, gen: number, cores: number): number => {
  const c = cpuModel(vendor, gen);
  return c ? (c.watts * cores) / c.cores : 0;
};

// Share of VPS, game server and cloud orders that need x86: 60% in 2020 falling to 30% by 2026. Before 2020 no ARM server
// exists, so no order asks.
export const x86Share = (year: number): number => (year < 2020 ? 0 : Math.max(0.3, Math.round((0.6 - (0.3 * (year - 2020)) / 6) * 100) / 100));
// Compatibility mode masks CPU features so VMs move live across vendors, at this share of every node's vCPU.
export const COMPAT_VCPU = 0.9;

// Every CPU on sale, by socket generation. Parodies of the real lineups: Xenon (Xeon), Opteroni (Opteron), Epyk (EPYC),
// Ultra (Altra). cores and threads per part, base and boost clock in GHz, tdp in watts, price as the factor on the year's
// per-core price, from the year it joins the generation (the generation's year when left out). perCore follows the generation
// row, scaled by the square root of boost over the row's clock, so a fast part gives a game server more and a slow one less.
export interface CpuSku { id: string; vendor: Vendor; gen: number; name: string; cores: number; threads: number; ghz: number; boost: number; tdp: number; price: number; from: number; perCore: number }
type Row = [name: string, cores: number, threads: number, ghz: number, boost: number, tdp: number, price: number, from?: number];
const INDEL_SKUS: Row[][] = [
  [["Xenon 3.6", 1, 2, 3.6, 3.6, 110, 1], ["Xenon 5050", 2, 4, 3.0, 3.0, 95, 0.9], ["Xenon 5060", 2, 4, 3.2, 3.2, 130, 1.05], ["Xenon 5080", 2, 4, 3.73, 3.73, 130, 1.4], ["Xenon 5148 LV", 2, 2, 2.33, 2.33, 40, 1.15, 2006], ["Xenon 5160", 2, 2, 3.0, 3.0, 80, 1.2, 2006]],
  [["Xenon E5205", 2, 2, 1.86, 1.86, 65, 0.6], ["Xenon X5272", 2, 2, 3.4, 3.4, 80, 1.1], ["Xenon E5405", 4, 4, 2.0, 2.0, 80, 0.7], ["Xenon E5420", 4, 4, 2.5, 2.5, 80, 0.9], ["Xenon L5420", 4, 4, 2.5, 2.5, 50, 1.1], ["Xenon X5460", 4, 4, 3.16, 3.16, 120, 1.3], ["Xenon X5492", 4, 4, 3.4, 3.4, 150, 1.6], ["Xenon X5570", 4, 8, 2.93, 3.33, 95, 1.5, 2009], ["Xenon X7560", 8, 16, 2.26, 2.66, 130, 1.8, 2010]],
  [["Xenon E5-2603", 4, 4, 1.8, 1.8, 80, 0.6], ["Xenon E5-2620", 6, 12, 2.0, 2.5, 95, 1], ["Xenon E5-2643", 4, 8, 3.3, 3.5, 130, 1.6], ["Xenon E5-2650", 8, 16, 2.0, 2.8, 95, 1.15], ["Xenon E5-2670", 8, 16, 2.6, 3.3, 115, 1.3], ["Xenon E5-2690", 8, 16, 2.9, 3.8, 135, 1.6], ["Xenon E5-2697 v2", 12, 24, 2.7, 3.5, 130, 1.5, 2013]],
  [["Xenon E5-2609 v3", 6, 6, 1.9, 1.9, 85, 0.6], ["Xenon E5-2620 v3", 6, 12, 2.4, 3.2, 85, 1], ["Xenon E5-2637 v3", 4, 8, 3.5, 3.7, 135, 1.8], ["Xenon E5-2650 v3", 10, 20, 2.3, 3.0, 105, 1.1], ["Xenon E5-2680 v3", 12, 24, 2.5, 3.3, 120, 1.25], ["Xenon E5-2697 v3", 14, 28, 2.6, 3.6, 145, 1.4], ["Xenon E5-2699 v3", 18, 36, 2.3, 3.6, 145, 1.6], ["Xenon E5-2699 v4", 22, 44, 2.2, 3.6, 145, 1.7, 2016], ["Xenon E7-8890 v4", 24, 48, 2.2, 3.4, 165, 2.2, 2016]],
  [["Xenon Silver 4110", 8, 16, 2.1, 3.0, 85, 0.8], ["Xenon Silver 4116", 12, 24, 2.1, 3.0, 85, 0.9], ["Xenon Gold 5118", 12, 24, 2.3, 3.2, 105, 1], ["Xenon Gold 6130", 16, 32, 2.1, 3.7, 125, 1.1], ["Xenon Gold 6144", 8, 16, 3.5, 4.2, 150, 1.8], ["Xenon Gold 6148", 20, 40, 2.4, 3.7, 150, 1.2], ["Xenon Gold 6154", 18, 36, 3.0, 3.7, 200, 1.5], ["Xenon Platinum 8180", 28, 56, 2.5, 3.8, 205, 2], ["Xenon Platinum 8280", 28, 56, 2.7, 4.0, 205, 2, 2019]],
  [["Xenon Silver 4314", 16, 32, 2.4, 3.4, 135, 0.8], ["Xenon Gold 5318Y", 24, 48, 2.1, 3.4, 165, 0.9], ["Xenon Gold 6338", 32, 64, 2.0, 3.2, 205, 1], ["Xenon Gold 6346", 16, 32, 3.1, 3.6, 205, 1.5], ["Xenon Gold 6354", 18, 36, 3.0, 3.6, 205, 1.4], ["Xenon Platinum 8358", 32, 64, 2.6, 3.4, 250, 1.3], ["Xenon Platinum 8380", 40, 80, 2.3, 3.4, 270, 1.6]],
  [["Xenon Silver 4410Y", 12, 24, 2.0, 3.9, 150, 0.8], ["Xenon Gold 5420+", 28, 56, 2.0, 4.1, 205, 0.9], ["Xenon Gold 6444Y", 16, 32, 3.6, 4.0, 270, 1.6], ["Xenon Gold 6448Y", 32, 64, 2.1, 4.1, 225, 1], ["Xenon Gold 6454S", 32, 64, 2.2, 3.4, 270, 1.1], ["Xenon Platinum 8468", 48, 96, 2.1, 3.8, 350, 1.3], ["Xenon Platinum 8480+", 56, 112, 2.0, 3.8, 350, 1.5], ["Xenon 6 6780E", 144, 144, 2.2, 3.0, 330, 0.9, 2024]],
];
const AMB_SKUS: Row[][] = [
  [["Opteroni 246", 1, 1, 2.0, 2.0, 95, 0.7], ["Opteroni 252", 1, 1, 2.6, 2.6, 95, 0.9], ["Opteroni 254", 1, 1, 2.8, 2.8, 95, 1.1], ["Opteroni 270", 2, 2, 2.0, 2.0, 95, 0.8], ["Opteroni 275", 2, 2, 2.2, 2.2, 95, 1], ["Opteroni 285", 2, 2, 2.6, 2.6, 95, 1.3], ["Opteroni 290", 2, 2, 2.8, 2.8, 95, 1.5, 2006]],
  [["Opteroni 2347", 4, 4, 1.9, 1.9, 95, 0.6], ["Opteroni 2356", 4, 4, 2.3, 2.3, 95, 0.8], ["Opteroni 2384", 4, 4, 2.7, 2.7, 75, 1], ["Opteroni 2389", 4, 4, 2.9, 2.9, 75, 1.2], ["Opteroni 2431", 6, 6, 2.4, 2.4, 75, 0.95, 2009], ["Opteroni 2435", 6, 6, 2.6, 2.6, 75, 1.2, 2009]],
  [["Opteroni 4184", 6, 6, 2.8, 2.8, 75, 0.8], ["Opteroni 4284", 8, 8, 3.0, 3.5, 95, 1], ["Opteroni 6174", 12, 12, 2.2, 2.2, 115, 0.9], ["Opteroni 6234", 12, 12, 2.4, 3.0, 115, 0.95], ["Opteroni 6276", 16, 16, 2.3, 3.2, 115, 1], ["Opteroni 6282 SE", 16, 16, 2.6, 3.3, 140, 1.3]],
  // AMB sits out the 2014 generation with two leftover Opteronis.
  [["Opteroni 6338P", 12, 12, 2.3, 2.8, 99, 0.6], ["Opteroni 6386 SE", 16, 16, 2.8, 3.5, 140, 0.8]],
  // From Epyk, AMB sells cores at about half Indel's price per core (the generation rows in AMB above).
  [["Epyk 7251", 8, 16, 2.1, 2.9, 120, 0.4], ["Epyk 7281", 16, 32, 2.1, 2.7, 155, 0.45], ["Epyk 7351", 16, 32, 2.4, 2.9, 155, 0.5], ["Epyk 7401", 24, 48, 2.0, 3.0, 155, 0.55], ["Epyk 7451", 24, 48, 2.3, 3.2, 180, 0.6], ["Epyk 7551", 32, 64, 2.0, 3.0, 180, 0.5], ["Epyk 7601", 32, 64, 2.2, 3.2, 180, 0.65]],
  [["Epyk 7262", 8, 16, 3.2, 3.4, 155, 0.6], ["Epyk 7302", 16, 32, 3.0, 3.3, 155, 0.5], ["Epyk 7402", 24, 48, 2.8, 3.35, 180, 0.5], ["Epyk 7452", 32, 64, 2.35, 3.35, 155, 0.45], ["Epyk 7502", 32, 64, 2.5, 3.35, 180, 0.5], ["Epyk 7F52", 16, 32, 3.5, 3.9, 240, 1.1], ["Epyk 7702", 64, 128, 2.0, 3.35, 200, 0.5], ["Epyk 7742", 64, 128, 2.25, 3.4, 225, 0.6], ["Epyk 74F3", 24, 48, 3.2, 4.0, 240, 1, 2021], ["Epyk 7763", 64, 128, 2.45, 3.5, 280, 0.7, 2021]],
  [["Epyk 9124", 16, 32, 3.0, 3.7, 200, 0.5], ["Epyk 9174F", 16, 32, 4.1, 4.4, 320, 1.4], ["Epyk 9254", 24, 48, 2.9, 4.15, 200, 0.5], ["Epyk 9354", 32, 64, 3.25, 3.8, 280, 0.55], ["Epyk 9374F", 32, 64, 3.85, 4.3, 320, 1], ["Epyk 9454", 48, 96, 2.75, 3.8, 290, 0.55], ["Epyk 9554", 64, 128, 3.1, 3.75, 360, 0.6], ["Epyk 9654", 96, 192, 2.4, 3.7, 360, 0.65], ["Epyk 9754", 128, 256, 2.25, 3.1, 360, 0.5], ["Epyk 9965", 192, 384, 2.25, 3.7, 500, 0.6, 2024]],
];
const AMPEAR_SKUS: Row[][] = [
  [], [], [], [], [],
  [["Ultra Q32-17", 32, 32, 1.7, 1.7, 58, 0.7], ["Ultra Q64-22", 64, 64, 2.2, 2.2, 95, 0.7], ["Ultra Q72-30", 72, 72, 3.0, 3.0, 195, 0.75], ["Ultra Q80-30", 80, 80, 3.0, 3.0, 210, 0.8], ["Ultra Max M128-30", 128, 128, 3.0, 3.0, 250, 0.75, 2021]],
  [["AmpearOne A96-28", 96, 96, 2.8, 2.8, 240, 0.65], ["AmpearOne A144-32", 144, 144, 3.2, 3.2, 300, 0.7], ["AmpearOne A192-32X", 192, 192, 3.2, 3.2, 350, 0.7, 2024]],
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
export const CPU_SKUS: CpuSku[] = ([["indel", INDEL_SKUS], ["amb", AMB_SKUS], ["ampear", AMPEAR_SKUS]] as const).flatMap(([vendor, table]) =>
  table.flatMap((rows, i) => rows.flatMap(([name, cores, threads, ghz, boost, tdp, price, from]): CpuSku[] => {
    const row = cpuModel(vendor, i + 1);
    if (!row) return [];
    return [{ id: `${vendor}-${slug(name)}`, vendor, gen: i + 1, name, cores, threads, ghz, boost, tdp, price, from: from ?? row.from, perCore: Math.round(row.perCore * Math.sqrt(boost / row.ghz) * 100) / 100 }];
  })));
const SKU_INDEX = new Map(CPU_SKUS.map((c) => [c.id, c]));
export const skuById = (id: string): CpuSku | undefined => SKU_INDEX.get(id);
// The parts of a vendor's socket generation on sale in a year (all of them when the year is left out).
export const cpuSkus = (vendor: Vendor, gen: number, year = Infinity): CpuSku[] => CPU_SKUS.filter((c) => c.vendor === vendor && c.gen === gen && c.from <= year);
// The part a preset ships with: the nearest core count to the preset's share, the one priced like the generation row among
// equals; with fast set, the highest boost among parts up to maxCores.
export function defaultSku(vendor: Vendor, gen: number, cores: number, fast = false, maxCores = Infinity): CpuSku | undefined {
  const row = cpuModel(vendor, gen), all = cpuSkus(vendor, gen, row?.from);
  if (fast) return [...all].filter((c) => c.cores <= maxCores).sort((a, b) => b.boost - a.boost || a.price - b.price)[0] ?? all[0];
  const list = row?.price ?? 1;
  return [...all].sort((a, b) => Math.abs(a.cores - cores) - Math.abs(b.cores - cores) || Math.abs(a.price - list) - Math.abs(b.price - list))[0];
}
// The part behind a CPU: its own, or the nearest of its vendor and generation for parts from before parts had names.
export const skuOf = (p: { sku?: string; vendor?: Vendor; gen?: number; size?: number }): CpuSku | undefined =>
  (p.sku && skuById(p.sku)) || (p.vendor && p.gen && p.size !== undefined ? defaultSku(p.vendor, p.gen, p.size) : undefined);
