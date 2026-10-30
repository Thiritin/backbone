import { brandFrom, brandWatts, MANUFACTURERS, presetCores, vendorsOf, type DeviceModel, type PartSpec } from "../../../sim/10-catalog/hardware";
import { unitPrice } from "../../../sim/90-actions/hardware";
import { VENDOR_NAME, VENDORS, type Vendor } from "../../../sim/10-catalog/cpus";
import { lineOf } from "../../art/fronts";

const LINE_NAME: Record<string, string> = {
  compute: "Balanced", "compute-2psu": "Balanced", value: "Balanced", micro: "Clock", dense: "Compute dense", memory: "Memory optimized", bigmem: "Memory optimized", quad: "Four socket",
  storage: "Storage", "storage-24": "Storage", backup: "Backup", archive: "Archive", gpu: "GPU", "gpu-8": "GPU", arm: "ARM",
};
export const classOf = (m: DeviceModel) =>
  m.kind === "part" ? "Parts" : m.kind === "chassis" ? "Multi-node" : m.kind === "server" ? LINE_NAME[lineOf(m)!] : m.kind === "switch" ? `Layer ${m.layer ?? 2}` : m.kind === "firewall" ? "Security" : m.kind === "gateway" ? "Routers" : m.kind === "ups" || m.kind === "pdu" ? "Power" : m.kind === "kvm" || m.kind === "console" || m.kind === "oob" ? "Remote access" : "Patch panels";

// Sidebar classes in order, each with the classes it groups.
export const CLASS_TREE: [string, string[]][] = [
  ["Servers", [...new Set(Object.values(LINE_NAME)), "Multi-node"]], ["Switches", ["Layer 2", "Layer 3"]],
  ["Routers", []], ["Security", []], ["Patch panels", []], ["Remote access", []], ["Power", []], ["Parts", []],
];
export const inClass = (sel: string | null, cls: string) => !sel || sel === cls || !!CLASS_TREE.find(([p]) => p === sel)?.[1].includes(cls);

// Who made an item: the device's brand, a CPU or board's vendor, or the GPU maker; other parts have none.
export const makerOf = (brand: string, part?: PartSpec): string | null =>
  !part ? brand : part.vendor ? VENDOR_NAME[part.vendor] : part.kind === "gpu" ? "nVidea" : null;
export const MAKERS = [...MANUFACTURERS.filter((m) => m.id !== "generic").map((m) => m.name), ...VENDORS.map((v) => VENDOR_NAME[v]), "nVidea"];

export interface Filter { form: string | null; cores: number; ram: number; disk: string | null; vendor: Vendor | null }
export const NO_FILTER: Filter = { form: null, cores: 0, ram: 0, disk: null, vendor: null };
export const FORMS = ["1U", "2U", "4U"];
export const DISKS = ["HDD", "SSD", "NVMe"];
export const CORES = [0, 4, 8, 16, 32, 64];
export const RAMS = [0, 16, 64, 256, 1024];

export const formOf = (m: DeviceModel) => `${m.height}U`;
export const isSet = (f: Filter) => f.form !== null || f.cores > 0 || f.ram > 0 || f.disk !== null || f.vendor !== null;

// Form factor applies to every device; cores, RAM and disk drop anything that is not a server; a vendor keeps the servers sold
// with it and its parts.
export const matchesFilter = (m: DeviceModel, f: Filter, part?: PartSpec): boolean => {
  const s = m.server;
  if (f.form && formOf(m) !== f.form) return false;
  if (!s) return !f.cores && !f.ram && !f.disk && (!f.vendor || part?.vendor === f.vendor);
  return presetCores(m) >= f.cores && s.ramGb >= f.ram && (!f.disk || s.disk === f.disk) && (!f.vendor || vendorsOf(m).includes(f.vendor));
};

export type Sort = "default" | "priceLow" | "priceHigh" | "newest" | "power";
export const SORTS: [Sort, string][] = [["default", "Default"], ["priceLow", "Price low to high"], ["priceHigh", "Price high to low"], ["newest", "Newest"], ["power", "Lowest power"]];

// Orders a copy of the list; ties keep the list's order, and a model without a power rating sorts last by power.
export function sortItems<T extends { model: DeviceModel; brand: string; part?: PartSpec }>(items: T[], sort: Sort, year: number): T[] {
  const price = (it: T) => unitPrice({ model: it.model.id, brand: it.brand, qty: 1, ...(it.model.server ? { vendor: vendorsOf(it.model)[0] } : {}), ...(it.part ? { part: it.part } : {}) }, year);
  const key: Record<Sort, (it: T) => number> = {
    default: () => 0,
    priceLow: price,
    priceHigh: (it) => -price(it),
    newest: (it) => -brandFrom(it.model, it.brand),
    power: (it) => brandWatts(it.model, it.brand) || Infinity,
  };
  return items.map((it) => [it, key[sort](it)] as const).sort((a, b) => a[1] - b[1]).map(([it]) => it);
}
