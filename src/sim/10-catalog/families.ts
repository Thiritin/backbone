// Memory sticks and drives by maker (economy.md, Prices over time, Memory and drive parts). A family is one maker's line of
// one kind: a RAM part names its DDR type, speed and stick kind, a drive its interface and class; the sizes a family sells
// are listed per year window. A part's sku names its family, its size stays on the part.
import type { ComponentKind, FormFactor } from "./hardware";

export type Ddr = "DDR2" | "DDR3" | "DDR4" | "DDR5";
// Board memory type per generation (index 0 for G1).
export const DDR_BY_GEN: Ddr[] = ["DDR2", "DDR3", "DDR3", "DDR4", "DDR4", "DDR4", "DDR5"];

export interface PartMaker { id: string; name: string; price: number; failure: number }
export const PART_MAKERS: PartMaker[] = [
  { id: "kingstown", name: "Kingstown", price: 0.95, failure: 1.0 },
  { id: "sumsang", name: "Sumsang", price: 1.0, failure: 0.8 },
  { id: "mikron", name: "Mikron", price: 0.97, failure: 0.9 },
  { id: "hyenix", name: "SK Hyenix", price: 0.92, failure: 1.0 },
  { id: "crucible", name: "Crucible", price: 0.9, failure: 1.2 },
  { id: "seagull", name: "Seagull", price: 0.92, failure: 1.2 },
  { id: "wd", name: "Western Digitail", price: 1.0, failure: 0.8 },
  { id: "toshibark", name: "Toshibark", price: 0.95, failure: 1.0 },
  { id: "hitachee", name: "Hitachee", price: 1.05, failure: 0.7 },
  { id: "indel", name: "Indel", price: 1.1, failure: 0.7 },
  { id: "kioxiaa", name: "Kioxiaa", price: 0.93, failure: 0.9 },
  { id: "solidigum", name: "Solidigum", price: 0.9, failure: 1.0 },
  { id: "nvidea", name: "nVidea", price: 1, failure: 1 },
  { id: "amb", name: "AMB", price: 0.8, failure: 1.1 },
];
export const partMaker = (id: string): PartMaker => PART_MAKERS.find((m) => m.id === id)!;

// kind factor scales the per-GB price on top of the maker's; mts is the speed; sizes are the GB on sale with their first year.
export interface RamFamily { id: string; kind: "ram"; maker: string; ddr: Ddr; mts: number; stick: "RDIMM" | "LRDIMM" | "UDIMM"; from: number; until: number; price: number; sizes: [gb: number, from: number][] }
type RamRow = [maker: string, ddr: Ddr, mts: number, stick: RamFamily["stick"], from: number, until: number, price: number, sizes: [number, number][]];
const DDR2: [number, number][] = [[1, 2005], [2, 2005], [4, 2007]];
const DDR3: [number, number][] = [[2, 2008], [4, 2008], [8, 2009], [16, 2011], [32, 2012]];
const DDR4: [number, number][] = [[8, 2014], [16, 2014], [32, 2015], [64, 2016], [128, 2019]];
const DDR5: [number, number][] = [[16, 2023], [32, 2023], [64, 2023], [128, 2023], [256, 2024]];
const RAM_ROWS: RamRow[] = [
  ["kingstown", "DDR2", 667, "RDIMM", 2005, 2010, 1, DDR2],
  ["sumsang", "DDR2", 667, "RDIMM", 2005, 2010, 1, DDR2],
  ["kingstown", "DDR3", 1333, "RDIMM", 2008, 2016, 1, DDR3],
  ["sumsang", "DDR3", 1600, "RDIMM", 2008, 2016, 1, DDR3],
  ["mikron", "DDR3", 1333, "RDIMM", 2008, 2016, 1, DDR3],
  ["hyenix", "DDR3", 1600, "RDIMM", 2012, 2016, 1, DDR3.filter(([gb]) => gb >= 8)],
  ["kingstown", "DDR4", 2400, "RDIMM", 2014, 2022, 1, DDR4],
  ["sumsang", "DDR4", 2933, "RDIMM", 2014, 2022, 1, DDR4],
  ["mikron", "DDR4", 2666, "RDIMM", 2014, 2022, 1, DDR4],
  ["hyenix", "DDR4", 3200, "RDIMM", 2014, 2022, 1, DDR4],
  ["sumsang", "DDR4", 2666, "LRDIMM", 2016, 2022, 1.3, [[64, 2016], [128, 2017]]],
  ["crucible", "DDR4", 2666, "UDIMM", 2015, 2022, 0.85, [[8, 2015], [16, 2015], [32, 2018]]],
  ["kingstown", "DDR5", 4800, "RDIMM", 2023, 2032, 1, DDR5.filter(([gb]) => gb <= 128)],
  ["sumsang", "DDR5", 5600, "RDIMM", 2023, 2032, 1, DDR5],
  ["mikron", "DDR5", 4800, "RDIMM", 2023, 2032, 1, DDR5.filter(([gb]) => gb <= 128)],
  ["hyenix", "DDR5", 5600, "RDIMM", 2023, 2032, 1, DDR5.filter(([gb]) => gb <= 128)],
];
export const RAM_FAMILIES: RamFamily[] = RAM_ROWS.map(([maker, ddr, mts, stick, from, until, price, sizes]) => ({ id: `${maker}-${ddr.toLowerCase()}-${stick.toLowerCase()}`, kind: "ram", maker, ddr, mts, stick, from, until, price, sizes }));

// A drive family: its class sets the price factor per GB and the flavour on the spec sheet. rpm for HDDs, dwpd (drive
// writes per day) for flash; mbps and iops are the spec sheet's figures.
export interface DriveFamily { id: string; kind: "hdd" | "ssd" | "nvme"; maker: string; name: string; ff: FormFactor; iface: "SATA" | "SAS" | "NVMe"; rpm?: number; dwpd?: number; mbps: number; iops: number; from: number; until: number; price: number; sizes: number[] }
type DriveRow = [maker: string, name: string, kind: DriveFamily["kind"], ff: FormFactor, iface: DriveFamily["iface"], rpmOrDwpd: number, mbps: number, iops: number, from: number, until: number, price: number, sizes: number[]];
const DRIVE_ROWS: DriveRow[] = [
  // 3.5" 7.2k SATA and SAS, the bulk drives.
  ["seagull", "Barracuda ES", "hdd", "3.5", "SATA", 7200, 80, 80, 2005, 2009, 1, [160, 250, 500, 750]],
  ["seagull", "Constellation ES", "hdd", "3.5", "SAS", 7200, 150, 90, 2009, 2014, 1.1, [1000, 2000, 3000, 4000]],
  ["seagull", "Exos", "hdd", "3.5", "SAS", 7200, 260, 170, 2014, 2032, 1.1, [4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 28000]],
  ["wd", "RE", "hdd", "3.5", "SATA", 7200, 90, 80, 2005, 2012, 1, [250, 500, 750]],
  ["wd", "RE4", "hdd", "3.5", "SATA", 7200, 130, 85, 2009, 2013, 1, [1000, 2000]],
  ["wd", "Ultrastar 7K", "hdd", "3.5", "SATA", 7200, 170, 100, 2012, 2017, 1, [2000, 3000, 4000, 6000]],
  ["wd", "Ultrastar DC HC", "hdd", "3.5", "SATA", 7200, 270, 180, 2017, 2032, 1, [8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 26000]],
  ["toshibark", "MG", "hdd", "3.5", "SATA", 7200, 160, 90, 2010, 2017, 1, [1000, 2000, 3000, 4000, 5000]],
  ["toshibark", "MG08", "hdd", "3.5", "SAS", 7200, 250, 160, 2017, 2032, 1.05, [6000, 8000, 10000, 14000, 16000, 18000, 20000]],
  ["hitachee", "Deskstar", "hdd", "3.5", "SATA", 7200, 85, 80, 2005, 2012, 1, [250, 500, 750]],
  ["hitachee", "Ultrastar A7K2000", "hdd", "3.5", "SATA", 7200, 130, 85, 2009, 2012, 1, [1000, 2000]],
  // 10k and 15k SAS, the database drives before flash.
  ["seagull", "Cheetah 15K", "hdd", "3.5", "SAS", 15000, 170, 200, 2005, 2012, 2, [73, 146, 300, 450, 600]],
  ["hitachee", "Ultrastar 15K", "hdd", "3.5", "SAS", 15000, 160, 190, 2005, 2012, 2, [73, 147, 300]],
  ["seagull", "Savvio 10K", "hdd", "2.5", "SAS", 10000, 120, 150, 2005, 2014, 1.5, [73, 146, 300, 600, 900]],
  ["toshibark", "AL13SX", "hdd", "2.5", "SAS", 10000, 200, 160, 2012, 2018, 1.4, [300, 600, 900, 1200, 1800]],
  ["wd", "Ultrastar C10K", "hdd", "2.5", "SAS", 10000, 190, 160, 2010, 2018, 1.5, [300, 600, 900, 1200]],
  // SATA SSDs.
  ["indel", "X25-E", "ssd", "2.5", "SATA", 10, 250, 35000, 2009, 2011, 1.5, [32, 64]],
  ["indel", "DC S3500", "ssd", "2.5", "SATA", 0.3, 500, 75000, 2013, 2017, 1, [120, 240, 480, 800]],
  ["indel", "DC S4510", "ssd", "2.5", "SATA", 2, 560, 97000, 2018, 2023, 1, [480, 960, 1920, 3840]],
  ["sumsang", "SM825", "ssd", "2.5", "SATA", 10, 250, 40000, 2011, 2013, 1.3, [100, 200, 400]],
  ["sumsang", "PM863", "ssd", "2.5", "SATA", 1.3, 520, 99000, 2015, 2018, 1, [240, 480, 960, 1920, 3840]],
  ["sumsang", "PM883", "ssd", "2.5", "SATA", 1.3, 550, 98000, 2018, 2022, 1, [480, 960, 1920, 3840, 7680]],
  ["sumsang", "PM893", "ssd", "2.5", "SATA", 1, 560, 98000, 2021, 2032, 1, [960, 1920, 3840, 7680]],
  ["mikron", "5100", "ssd", "2.5", "SATA", 1, 540, 93000, 2016, 2019, 1, [240, 480, 960, 1920]],
  ["mikron", "5300", "ssd", "2.5", "SATA", 1.5, 540, 95000, 2019, 2032, 1, [480, 960, 1920, 3840, 7680]],
  ["kioxiaa", "HK6", "ssd", "2.5", "SATA", 1, 550, 90000, 2019, 2032, 1, [480, 960, 1920, 3840]],
  ["seagull", "Nytro 1351", "ssd", "2.5", "SATA", 1, 560, 90000, 2018, 2025, 0.95, [480, 960, 1920, 3840]],
  // NVMe drives.
  ["indel", "DC P3700", "nvme", "nvme", "NVMe", 10, 2800, 460000, 2014, 2017, 1.3, [400, 800, 1600, 2000]],
  ["indel", "DC P4510", "nvme", "nvme", "NVMe", 1, 3200, 640000, 2018, 2022, 1, [1000, 2000, 4000, 8000]],
  ["indel", "Optane DC P4800X", "nvme", "nvme", "NVMe", 30, 2500, 550000, 2017, 2024, 4, [375, 750, 1500]],
  ["sumsang", "PM983", "nvme", "nvme", "NVMe", 1.3, 3200, 540000, 2018, 2021, 1, [960, 1920, 3840, 7680]],
  ["sumsang", "PM9A3", "nvme", "nvme", "NVMe", 1, 6900, 1100000, 2021, 2032, 1, [1920, 3840, 7680, 15360]],
  ["sumsang", "PM1733", "nvme", "nvme", "NVMe", 1, 7000, 1500000, 2020, 2025, 1.1, [1920, 3840, 7680, 15360]],
  ["mikron", "9200", "nvme", "nvme", "NVMe", 1, 3500, 800000, 2017, 2020, 1, [1600, 3200, 6400]],
  ["mikron", "7450", "nvme", "nvme", "NVMe", 1, 6800, 1000000, 2022, 2032, 1, [960, 1920, 3840, 7680, 15360]],
  ["kioxiaa", "CD6", "nvme", "nvme", "NVMe", 1, 6200, 1000000, 2020, 2032, 1, [960, 1920, 3840, 7680, 15360]],
  ["wd", "Ultrastar SN640", "nvme", "nvme", "NVMe", 0.8, 3300, 470000, 2019, 2024, 1, [960, 1920, 3840, 7680]],
  ["solidigum", "D5-P5316", "nvme", "nvme", "NVMe", 0.4, 7000, 800000, 2022, 2032, 0.7, [15360, 30720]],
  ["solidigum", "D7-P5520", "nvme", "nvme", "NVMe", 1, 7100, 1100000, 2022, 2032, 1, [1920, 3840, 7680, 15360]],
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
export const DRIVE_FAMILIES: DriveFamily[] = DRIVE_ROWS.map(([maker, name, kind, ff, iface, x, mbps, iops, from, until, price, sizes]) => ({
  id: `${maker}-${slug(name)}`, kind, maker, name, ff, iface, ...(kind === "hdd" ? { rpm: x } : { dwpd: x }), mbps, iops, from, until, price, sizes,
}));

export type Family = RamFamily | DriveFamily;
const INDEX = new Map<string, Family>([...RAM_FAMILIES, ...DRIVE_FAMILIES].map((f) => [f.id, f]));
export const familyById = (id: string | undefined): Family | undefined => (id ? INDEX.get(id) : undefined);
export const isRamFamily = (f: Family): f is RamFamily => f.kind === "ram";
// The maker's name and the family's name on a label: "Sumsang DDR4-2933 RDIMM", "Seagull Exos".
export const familyName = (f: Family): string => `${partMaker(f.maker).name} ${isRamFamily(f) ? `${f.ddr}-${f.mts} ${f.stick}` : f.name}`;
// Price factor per GB: the maker's times the family's.
export const familyPrice = (f: Family): number => partMaker(f.maker).price * f.price;
export const familyFailure = (f: Family): number => partMaker(f.maker).failure;

// The families of a kind on sale in a year, in catalog order.
export const familiesOn = (kind: ComponentKind, year: number): Family[] => [...RAM_FAMILIES, ...DRIVE_FAMILIES].filter((f) => f.kind === kind && f.from <= year && year <= f.until);
// The sizes a family sells in a year.
export const familySizes = (f: Family, year: number): number[] => (isRamFamily(f) ? f.sizes.filter(([, from]) => from <= year).map(([gb]) => gb) : f.sizes);
// The family a preset ships: of its kind on sale in the year, of the form factor or DDR type when any has it, the one whose
// sizes come closest to the preset's, the first in the catalog among equals. Presets name their DDR type by generation
// (DDR_BY_GEN); a drive preset takes any interface of its form factor.
export function defaultFamily(kind: ComponentKind, year: number, size: number, ff?: FormFactor, ddr?: Ddr): Family | undefined {
  const on = familiesOn(kind, year), fitting = on.filter((f) => (isRamFamily(f) ? !ddr || f.ddr === ddr : !ff || f.ff === ff));
  const all = fitting.length ? fitting : on;
  const gap = (f: Family) => Math.min(Infinity, ...familySizes(f, year).map((gb) => Math.abs(gb - size) / Math.max(1, size)));
  return [...all].sort((a, b) => gap(a) - gap(b))[0];
}
// A part's family: its own, or the default of its kind for parts from before parts had makers (gen is the chassis's, 1 for G1).
export const familyOf = (p: { kind: ComponentKind; sku?: string; size?: number; ff?: FormFactor }, year: number, gen?: number): Family | undefined =>
  familyById(p.sku) ?? (p.kind === "ram" || p.kind === "hdd" || p.kind === "ssd" || p.kind === "nvme" ? defaultFamily(p.kind, year, p.size ?? 0, p.ff, gen ? DDR_BY_GEN[gen - 1] : undefined) : undefined);
