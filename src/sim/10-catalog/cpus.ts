// CPU makers per generation (economy.md, Prices over time, CPU vendors): two x86 makers that swap the lead and an ARM maker
// from 2020. Anchors: Opteron 2005, Xeon 5500 2009, EPYC 2017, Ampere Altra 2020.
import { GENERATIONS } from "./economy";

export type Vendor = "indel" | "amb" | "ampear";
export const VENDORS: Vendor[] = ["indel", "amb", "ampear"];
export const VENDOR_NAME: Record<Vendor, string> = { indel: "Indel", amb: "AMB", ampear: "Ampear" };
export const VENDOR_ARCH: Record<Vendor, "x86" | "arm"> = { indel: "x86", amb: "x86", ampear: "arm" };
export const defaultVendor = (arch: "x86" | "arm"): Vendor => (arch === "arm" ? "ampear" : "indel");

// gen is 1 for G1. cores per socket of a full socket (the compute-dense line's); smaller lines take a share of it. perCore is
// the speed of one core, watts the draw of a full socket, price the factor on the per-core CPU price.
export interface CpuModel { vendor: Vendor; gen: number; from: number; cores: number; perCore: number; watts: number; price: number }

const INDEL: [perCore: number, watts: number][] = [[0.9, 110], [1.15, 130], [1.15, 130], [1.15, 165], [1.05, 205], [1.05, 270], [1.05, 320]];
const AMB: [cores: number, perCore: number, watts: number, price: number][] = [
  [1, 1.0, 95, 1], [1, 0.95, 145, 0.8], [1, 0.95, 145, 0.8], [1, 0.95, 180, 0.8],
  // From G5, 1.6 times the cores at 0.8 the price per socket, so 0.5 per core.
  [1.6, 0.95, 180, 0.5], [1.6, 0.95, 225, 0.5], [1.6, 0.95, 360, 0.5],
];
export const CPU_MODELS: CpuModel[] = GENERATIONS.flatMap((g, i): CpuModel[] => {
  const [perCore, watts] = INDEL[i], [k, ambPerCore, ambWatts, ambPrice] = AMB[i];
  return [
    { vendor: "indel", gen: i + 1, from: g.year, cores: g.cores, perCore, watts, price: 1 },
    { vendor: "amb", gen: i + 1, from: g.year, cores: Math.round(g.cores * k), perCore: ambPerCore, watts: ambWatts, price: ambPrice },
    // Half the watts per core of the generation's Indel part, at 0.7 the price per core.
    ...(g.year >= 2020 ? [{ vendor: "ampear" as const, gen: i + 1, from: g.year, cores: g.cores, perCore: 0.8, watts: watts / 2, price: 0.7 }] : []),
  ];
});
export const cpuModel = (vendor: Vendor, gen: number): CpuModel | undefined => CPU_MODELS.find((c) => c.vendor === vendor && c.gen === gen);

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
