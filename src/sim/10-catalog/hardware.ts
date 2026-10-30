// Values come from docs/design/economy.md (Server generations, Server lines, Manufacturers, Switches, Security appliances, Patch panels and gateways).
import { GENERATIONS, generationAt } from "./economy";
import { cardAt, cardOf, gpuOffers, gpuPrice } from "./gpu";
import { cpuModel, cpuSkus, cpuWatts, defaultSku, defaultVendor, genOfYear, skuById, skuOf, socketCores, socketOf, VENDOR_ARCH, VENDOR_NAME, VENDORS, vendorsAt, type Vendor } from "./cpus";

// A chassis holds the nodes of a multi-node server with their shared power supplies and fans; the nodes are servers.
export type DeviceKind = "server" | "switch" | "firewall" | "gateway" | "patch" | "ups" | "pdu" | "part" | "kvm" | "console" | "oob" | "chassis";
export interface PortSpec { media: "rj45" | "sfp"; gbit: number }
// Management ports outside the data plane, numbered from OOB_PORT: a server's console end, a switch or router's mgmt and RS-232
// console ports, a KVM's outputs, a console server's serial ports, and the network jack of every management device.
export type OobPort = "console" | "mgmt" | "kvm" | "serial" | "net";
export const OOB_PORT = 100;
// Form factor of a drive and of a bay group. A "nvme" bay is a 2.5" bay that takes SATA/SAS and NVMe drives; a "2.5" bay takes
// SATA/SAS only; a "3.5" bay takes 3.5" drives only.
export type FormFactor = "3.5" | "2.5" | "nvme";
export interface BayGroup { ff: FormFactor; count: number }
export interface ServerSpec {
  arch: "x86" | "arm";
  // The CPU makers whose boards this line is sold with.
  makers: Vendor[];
  sockets: number;
  cores: number;
  ramGb: number;
  maxRamGb: number;
  dimmSlots: number;
  bays: BayGroup[];
  pcie: number;
  psuBays: number;
  diskGb: number;
  disk: "HDD" | "SSD" | "NVMe";
  gpus: number;
  // Drives fitted at purchase; every drive has diskGb / drives.
  drives: number;
  ramSticks: number;
  // The line ships the fastest CPU of its socket, not the biggest.
  fast?: boolean;
}
// Values from economy.md (Components): life in years, yearly failure rates before and after it, part price, and when a swap
// can happen with the device running: in a RAID array, with a second working power supply, always, or never.
export type ComponentKind = "hdd" | "ssd" | "nvme" | "psu" | "fan" | "ram" | "board" | "cpu" | "nic" | "gpu";
export const COMPONENT_KINDS: ComponentKind[] = ["hdd", "ssd", "nvme", "psu", "fan", "ram", "board", "cpu", "nic", "gpu"];
export const COMPONENTS: Record<ComponentKind, { life: number; before: number; after: number; price: number; hotSwap: "raid" | "dual" | "yes" | "no" }> = {
  hdd: { life: 5, before: 0.015, after: 0.08, price: 120, hotSwap: "raid" },
  ssd: { life: 5, before: 0.008, after: 0.04, price: 150, hotSwap: "raid" },
  nvme: { life: 5, before: 0.006, after: 0.03, price: 200, hotSwap: "raid" },
  psu: { life: 7, before: 0.01, after: 0.06, price: 150, hotSwap: "dual" },
  fan: { life: 6, before: 0.01, after: 0.07, price: 25, hotSwap: "yes" },
  ram: { life: 12, before: 0.002, after: 0.006, price: 60, hotSwap: "no" },
  board: { life: 12, before: 0.003, after: 0.01, price: 600, hotSwap: "no" },
  cpu: { life: 7, before: 0.0005, after: 0.002, price: 400, hotSwap: "no" },
  nic: { life: 10, before: 0.003, after: 0.01, price: 80, hotSwap: "no" },
  gpu: { life: 5, before: 0.015, after: 0.08, price: 9000, hotSwap: "no" },
};
const COMPONENT_NAMES: Record<ComponentKind, string> = {
  hdd: "HDD", ssd: "SSD", nvme: "NVMe drive", psu: "power supply", fan: "fan", ram: "RAM stick", board: "mainboard", cpu: "CPU", nic: "network card", gpu: "GPU card",
};
const DRIVE_KIND = { HDD: "hdd", SSD: "ssd", NVMe: "nvme" } as const;

export const bayCount = (v: ServerSpec): number => v.bays.reduce((n, b) => n + b.count, 0);
// Whether a drive of this form factor goes into a bay group.
export const bayTakes = (bay: FormFactor, drive: FormFactor): boolean => (drive === "3.5" ? bay === "3.5" : drive === "2.5" ? bay !== "3.5" : bay === "nvme");
// The form factor of the drives a server ships with.
const presetFf = (v: ServerSpec): FormFactor => (v.disk === "NVMe" ? "nvme" : v.bays[0].ff === "3.5" ? "3.5" : "2.5");

// A part of a model as it ships: size in GB for RAM sticks and drives, in cores for CPUs. CPUs and boards carry their vendor,
// CPUs their generation (1 for G1) and the part they are (cpus.ts); a spare without them fits any board.
export interface PartSpec { kind: ComponentKind; size?: number; ff?: FormFactor; vendor?: Vendor; gen?: number; sku?: string }
export const specOf = (c: PartSpec): PartSpec => ({
  kind: c.kind, ...(c.size !== undefined ? { size: c.size } : {}), ...(c.ff ? { ff: c.ff } : {}), ...(c.vendor ? { vendor: c.vendor } : {}), ...(c.gen ? { gen: c.gen } : {}), ...(c.sku ? { sku: c.sku } : {}),
});

// The parts a model is built from: drives, power supplies, fans, RAM, board, CPUs and a NIC for a server, with the board
// and CPUs of vendor (Indel, or Ampear for ARM, when left out) and the CPU part named by sku (the line's default when left
// out); power supplies, 2 fans and a board for a switch or firewall; nothing for patch panels, gateways and parts.
export function componentParts(m: DeviceModel, vendor?: Vendor, sku?: string): PartSpec[] {
  const n = (k: ComponentKind, count: number, size?: (i: number) => number, ff?: FormFactor): PartSpec[] =>
    Array.from({ length: count }, (_, i) => ({ kind: k, ...(size ? { size: size(i) } : {}), ...(ff ? { ff } : {}) }));
  if (m.kind === "chassis") return [...n("psu", m.psus), ...n("fan", FAN_SLOTS)];
  if (m.server) {
    const v = m.server, maker = vendor ?? vendorsOf(m)[0] ?? defaultVendor(v.arch), gen = genOf(m);
    const part = (sku && skuById(sku)) || presetSku(m, maker);
    const cpu = (): PartSpec => ({ kind: "cpu", size: part?.cores ?? socketCores(v.cores / v.sockets, maker, gen), vendor: maker, gen, ...(part ? { sku: part.id } : {}) });
    return [
      // A node runs on its chassis's power supplies and fans.
      ...n(DRIVE_KIND[v.disk], v.drives, () => v.diskGb / v.drives, presetFf(v)), ...(m.chassis ? [] : [...n("psu", m.psus), ...n("fan", 4)]),
      ...n("ram", v.ramSticks, () => v.ramGb / v.ramSticks), { kind: "board", vendor: maker, gen, size: boardSpec(m, maker)?.maxCores }, ...Array.from({ length: v.sockets }, cpu), ...n("nic", 1),
      // A GPU line ships with the newest card of its generation; a part names its card by launch year.
      ...n("gpu", v.gpus, () => cardAt(m.from)?.year ?? 0),
    ];
  }
  if (m.kind === "switch" || m.kind === "firewall") return [...n("psu", m.psus), ...n("fan", 2), ...n("board", 1)];
  if (m.kind === "kvm" || m.kind === "console" || m.kind === "oob") return n("board", 1);
  return [];
}
// A server's mainboard: its maker's socket of the chassis's generation, the sockets it has, and the biggest CPU it takes as a
// share of a full socket of that CPU's generation (twice the preset's share, at most a full socket).
export interface BoardSpec { name: string; vendor: Vendor; socket: string; sockets: number; maxCores: number }
export const boardMaxShare = (m: DeviceModel): number => {
  const v = m.server, full = cpuModel("indel", genOf(m))?.cores;
  return v && full ? Math.min(1, (2 * v.cores) / v.sockets / full) : 0;
};
export function boardSpec(m: DeviceModel, vendor: Vendor): BoardSpec | undefined {
  const v = m.server, c = cpuModel(vendor, genOf(m));
  if (!v || !c) return undefined;
  const maxCores = Math.max(1, Math.round(c.cores * boardMaxShare(m)));
  return { name: `${VENDOR_NAME[vendor]} ${c.socket}-${maxCores}, ${SOCKETS[v.sockets] ?? v.sockets} socket`, vendor, socket: c.socket, sockets: v.sockets, maxCores };
}
const SOCKETS: Record<number, string> = { 1: "single", 2: "dual", 4: "quad" };
// The CPU part a line ships with from a maker: the nearest to its share of a full socket, or a fast line's fastest part.
export const presetSku = (m: DeviceModel, vendor: Vendor) => {
  const v = m.server, gen = genOf(m);
  if (!v) return undefined;
  return defaultSku(vendor, gen, socketCores(v.cores / v.sockets, vendor, gen), v.fast, boardSpec(m, vendor)?.maxCores);
};
// The CPU parts a chassis takes from a maker in a year: the socket's parts up to the board's biggest.
export const cpuOptions = (m: DeviceModel, vendor: Vendor, year: number) => {
  const max = boardSpec(m, vendor)?.maxCores ?? 0;
  return cpuSkus(vendor, genOf(m), year).filter((c) => c.cores <= max);
};
// The cores a server model ships with: ServerSpec.cores counts them at the Indel row, a line sold with AMB only has more from G5.
export const presetCores = (m: DeviceModel): number => componentParts(m).reduce((n, p) => n + (p.kind === "cpu" ? p.size ?? 0 : 0), 0);
export const componentKinds = (m: DeviceModel): ComponentKind[] => componentParts(m).map((p) => p.kind);

export const isDriveKind = (k: ComponentKind): boolean => k === "hdd" || k === "ssd" || k === "nvme";
// Fans in the fan wall; a chassis takes no more.
export const FAN_SLOTS = 4;

// The form factor of a drive part; one without says the chassis preset's.
const driveFf = (m: DeviceModel, p: PartSpec): FormFactor => p.ff ?? (m.server ? presetFf(m.server) : "2.5");

// Cards a chassis takes: the GPU 4U line four, a 2U up to the 2014 generation one single-width card (later PSUs cannot feed it), a 1U none.
const gpuSlots = (m: DeviceModel): number => (m.server && m.server.gpus > 0 ? m.server.gpus : m.server && m.height === 2 && m.from <= 2016 ? 1 : 0);

const fanSlots = (m: DeviceModel): number =>
  m.chassis ? 0 : m.kind === "server" || m.kind === "chassis" ? FAN_SLOTS : m.kind === "switch" || m.kind === "firewall" ? 2 : 0;

// How many slots a model has for a kind of part (all drive kinds share the bays).
export function slotsOf(m: DeviceModel, kind: ComponentKind): number {
  const v = m.server;
  if (kind === "cpu") return v?.sockets ?? 0;
  if (kind === "ram") return v?.dimmSlots ?? 0;
  if (isDriveKind(kind)) return v ? bayCount(v) : 0;
  if (kind === "psu") return m.chassis ? 0 : v?.psuBays ?? m.psus;
  if (kind === "gpu") return gpuSlots(m);
  if (kind === "fan") return fanSlots(m);
  return m.kind === "server" || m.kind === "switch" || m.kind === "firewall" ? 1 : 0;
}

// Whether a chassis can carry these parts together; returns an error key, or null when they fit.
export function fits(m: DeviceModel, parts: PartSpec[]): string | null {
  const v = m.server, count = (k: ComponentKind) => parts.filter((p) => p.kind === k).length;
  const fans = fanSlots(m);
  const boards = m.kind === "server" || m.kind === "switch" || m.kind === "firewall" ? 1 : 0;
  // Network ports come with the model, so a server takes its onboard NIC and no more.
  if (count("cpu") > (v?.sockets ?? 0) || count("ram") > (v?.dimmSlots ?? 0) || count("psu") > slotsOf(m, "psu")
    || count("fan") > fans || count("board") > boards || count("nic") > (v ? 1 : 0)) return "error.noSlot";
  const cards = parts.filter((p) => p.kind === "gpu");
  if (cards.length > gpuSlots(m) || (m.height < 4 && cards.some((p) => cardOf(p.size).wide))) return "error.noSlot";
  if (v && parts.filter((p) => p.kind === "ram").reduce((n, p) => n + (p.size ?? 0), 0) > v.maxRamGb) return "error.tooMuchRam";
  const cpus = v ? cpuError(m, v.arch, parts) : null;
  if (cpus) return cpus;
  const drives = parts.filter((p) => isDriveKind(p.kind)).map((p) => driveFf(m, p));
  if (!drives.length) return null;
  const bays = v?.bays ?? [], cap = (ff: FormFactor) => bays.filter((b) => b.ff === ff).reduce((n, b) => n + b.count, 0);
  const n = (ff: FormFactor) => drives.filter((f) => f === ff).length;
  if (drives.some((f) => !bays.some((b) => bayTakes(b.ff, f)))) return "error.wrongFormFactor";
  // NVMe drives take NVMe bays; 2.5" drives take the rest of the 2.5" and NVMe bays.
  if (n("3.5") > cap("3.5") || n("nvme") > cap("nvme") || n("2.5") > cap("2.5") + cap("nvme") - n("nvme")) return "error.noSlot";
  return null;
}

// A board and CPUs of the chassis's architecture, CPUs of the board's vendor that fit its socket, every socket alike.
function cpuError(m: DeviceModel, arch: "x86" | "arm", parts: PartSpec[]): string | null {
  const board = parts.find((p) => p.kind === "board")?.vendor, cpus = parts.filter((p) => p.kind === "cpu");
  if ([board, ...cpus.map((c) => c.vendor)].some((x) => x && (VENDOR_ARCH[x] !== arch || (board && x !== board)))) return "error.wrongVendor";
  const socket = boardSocket(m, board ?? defaultVendor(arch));
  if (cpus.some((c) => c.gen !== undefined && socketOf(c.vendor ?? board ?? defaultVendor(arch), c.gen) !== socket)) return "error.wrongSocket";
  const cap = boardMaxShare(m) + 1e-9;
  if (cpus.some((c) => c.size !== undefined && c.gen !== undefined && c.size / (cpuModel(c.vendor ?? board ?? defaultVendor(arch), c.gen)?.cores ?? Infinity) > cap)) return "error.cpuTooBig";
  const alike = (a: PartSpec, b: PartSpec) => a.size === b.size && (!a.vendor || !b.vendor || a.vendor === b.vendor) && (!a.sku || !b.sku || a.sku === b.sku);
  return cpus.every((c) => alike(c, cpus[0])) ? null : "error.mixedCpus";
}

// The generation of a server model, 1 for G1; 0 for other models.
export const genOf = (m: DeviceModel): number => (m.server ? genOfYear(m.from) : 0);
// The CPU makers a server model is sold with: the line's, among those that build CPUs for its generation.
export const vendorsOf = (m: DeviceModel): Vendor[] => (m.server ? m.server.makers.filter((v) => vendorsAt(m.server!.arch, genOf(m)).includes(v)) : []);
// The socket a server's board has: its maker's socket of the chassis's generation.
export const boardSocket = (m: DeviceModel, vendor: Vendor): string | undefined => socketOf(vendor, genOf(m));
// The vendor of a device's board, or of its preset's.
export const boardVendor = (m: DeviceModel, parts: PartSpec[]): Vendor =>
  parts.find((p) => p.kind === "board")?.vendor ?? defaultVendor(m.server?.arch ?? "x86");
// What the CPUs among these parts draw.
export const cpuWattsOf = (m: DeviceModel, parts: PartSpec[]): number =>
  parts.reduce((n, p) => n + (p.kind === "cpu" ? skuOf(p)?.tdp ?? cpuWatts(p.vendor ?? boardVendor(m, parts), p.gen ?? genOf(m), p.size ?? 0) : 0), 0);
// Saves from before CPU vendors: the board and CPUs take the preset's vendor and the chassis's generation, and every socket
// the largest CPU so no server runs a mixed pair.
export function fillCpus<T extends PartSpec>(m: DeviceModel, parts: T[]): T[] {
  if (!m.server) return parts;
  const vendor = boardVendor(m, parts), top = Math.max(0, ...parts.map((p) => (p.kind === "cpu" ? p.size ?? 0 : 0)));
  return parts.map((p) => (p.kind === "board" ? { ...p, vendor: p.vendor ?? vendor }
    : p.kind === "cpu" ? { ...p, ...(top ? { size: top } : {}), vendor: p.vendor ?? vendor, gen: p.gen ?? genOf(m) } : p));
}
const presetCpuWatts = new Map<string, number>();
// How far these parts' CPUs draw above the preset's, below it when negative: a server's watts less its preset's CPUs are the
// rest of the chassis.
export function cpuWattsShift(m: DeviceModel, parts: PartSpec[]): number {
  if (!m.server) return 0;
  if (!presetCpuWatts.has(m.id)) presetCpuWatts.set(m.id, cpuWattsOf(m, componentParts(m)));
  return cpuWattsOf(m, parts) - presetCpuWatts.get(m.id)!;
}

export interface DeviceModel {
  id: string;
  name: string;
  kind: DeviceKind;
  // Rack units; panel gateways are 0 and live on a carrier panel, edge routers mount in a rack.
  height: number;
  ports: PortSpec[];
  watts: number;
  idleWatts: number;
  psus: 1 | 2;
  price: number;
  from: number;
  // Last year on sale, null for a model that stays on sale (patch panels, the newest server generations) or is not sold.
  until: number | null;
  // Years of support after the last year on sale; the model is out of support once the year passes until + supportYears.
  supportYears: number;
  server?: ServerSpec;
  layer?: 2 | 3;
  // Firewalls cap every link through them at this speed.
  throughputGbit?: number;
  // A UPS carries its location through a grid outage for batteryWh ÷ load.
  batteryWh?: number;
  // A model only one manufacturer builds, sold at its list price; models without one come from every manufacturer of the kind.
  brand?: string;
  // The manufacturers that build a server line; every manufacturer of the kind builds a model without one.
  brands?: string[];
  // A server line and its generation (1 for G1); the makers name them in LINEUP.
  line?: string;
  gen?: number;
  // Routers: can hold a full BGP table and run an own AS (needed to announce a block), and how many BGP sessions it takes.
  fullTable?: boolean;
  bgpSessions?: number;
  // A switched PDU's outlets; a rack with one lets the player cut or cycle the power of every device in it.
  outlets?: number;
  // Management ports; servers, switches and rack routers get theirs from oobPorts.
  oob?: OobPort[];
  // A KVM that switches its server's power through its own ATX adapter.
  atx?: boolean;
  // A yearly failure rate in place of the component rates.
  failYearly?: number;
  // A multi-node chassis: the node model and how many nodes one purchase brings. A node names its chassis model.
  nodes?: { model: string; count: number };
  chassis?: string;
}

// Within a class, manufacturers differ in price, failure rate, release month, end of sale and power draw, never in specs.
// fromShift moves a model's release in months, untilShift its last year on sale in years, wattsFactor scales its draw; the
// defaults are 0, 0 and 1.
export interface Manufacturer { id: string; name: string; kinds: DeviceKind[]; priceFactor: number; failureFactor: number; fromShift?: number; untilShift?: number; wattsFactor?: number }
export const MANUFACTURERS: Manufacturer[] = [
  { id: "dwell", name: "Dwell", kinds: ["server", "chassis"], priceFactor: 1, failureFactor: 1 },
  { id: "hewlett-packet", name: "Hewlett-Packet", kinds: ["server"], priceFactor: 1.08, failureFactor: 0.8, fromShift: 3, untilShift: -1, wattsFactor: 0.95 },
  { id: "supermacro", name: "SuperMacro", kinds: ["server", "chassis"], priceFactor: 0.9, failureFactor: 1.3, fromShift: -4, untilShift: 1, wattsFactor: 1.05 },
  { id: "lenovoid", name: "Lenovoid", kinds: ["server", "chassis"], priceFactor: 0.95, failureFactor: 1.1, fromShift: 6 },
  { id: "gigabutt", name: "Gigabutt", kinds: ["server", "chassis"], priceFactor: 0.9, failureFactor: 1.25, fromShift: -1, wattsFactor: 1.04 },
  { id: "sysko", name: "Sysko", kinds: ["switch", "firewall", "gateway"], priceFactor: 1, failureFactor: 1 },
  { id: "junipurr", name: "Junipurr", kinds: ["switch", "gateway"], priceFactor: 1.1, failureFactor: 0.7 },
  { id: "aristotle", name: "Aristotle", kinds: ["switch"], priceFactor: 0.93, failureFactor: 1.2 },
  { id: "fortinope", name: "Fortinope", kinds: ["firewall"], priceFactor: 0.9, failureFactor: 1.25 },
  { id: "pablo-alto", name: "Pablo Alto", kinds: ["firewall"], priceFactor: 1.1, failureFactor: 0.75 },
  { id: "pandoot", name: "Pandoot", kinds: ["patch"], priceFactor: 1, failureFactor: 1 },
  { id: "avn", name: "AVN", kinds: ["gateway"], priceFactor: 1, failureFactor: 0.9 },
  { id: "microtick", name: "MicroTick", kinds: ["gateway"], priceFactor: 1, failureFactor: 1.2 },
  { id: "eatin", name: "Eatin", kinds: ["ups", "pdu"], priceFactor: 1, failureFactor: 1 },
  { id: "generic", name: "Generic", kinds: ["part"], priceFactor: 1, failureFactor: 1 },
];
export const brandsFor = (kind: DeviceKind): string[] => MANUFACTURERS.filter((m) => m.kinds.includes(kind)).map((m) => m.name);
// Hours from an order to the stockroom: 3 days in 2005 falling in a straight line to 1 day in 2015.
export const deliveryHours = (year: number): number => Math.round(72 - 48 * Math.min(1, Math.max(0, (year - 2005) / 10)));
// The manufacturers that sell this model.
export const brandsOf = (m: DeviceModel): string[] => (m.brand ? [m.brand] : m.brands ?? brandsFor(m.kind));
export const SERVER_BRANDS = brandsFor("server");
export const SWITCH_BRAND = "Sysko";
export const PATCH_BRAND = "Pandoot";

const portGbit = (year: number): number => (year >= 2023 ? 100 : year >= 2017 ? 25 : year >= 2011 ? 10 : 1);
const ports = (n: number, gbit: number, media: PortSpec["media"] = gbit === 1 ? "rj45" : "sfp"): PortSpec[] =>
  Array.from({ length: n }, () => ({ media, gbit }));

// Capacity of one large (backup) and one densest (archive) HDD per generation, in GB.
export const LARGE_HDD_GB = [500, 1000, 3000, 6000, 10000, 16000, 22000];
export const DENSE_HDD_GB = [750, 2000, 4000, 8000, 14000, 20000, 28000];

// RAM stick size per generation, in GB.
export const RAM_STICK_GB = [2, 4, 8, 16, 32, 32, 64];

// Multipliers on the generation row. disk picks the drive: the generation's disk, or a large or dense HDD.
// dimms: DIMM slots at G1, G3, G5 and G7; generations in between share the value of the older one. bays: the drive bays at a generation index.
const BAYS_SMALL = (i: number): BayGroup[] => (i <= 1 ? [{ ff: "3.5", count: 4 }] : i === 2 ? [{ ff: "2.5", count: 8 }] : [{ ff: "nvme", count: 10 }]);
const BAYS_8 = (i: number): BayGroup[] => [{ ff: i <= 2 ? "2.5" : "nvme", count: 8 }];
const BAYS_SFF_24 = (i: number): BayGroup[] => [{ ff: i <= 3 ? "2.5" : "nvme", count: 24 }];
const BAYS_3_5 = (count: number) => (): BayGroup[] => [{ ff: "3.5", count }];
// The storage line ships NVMe drives from G6; those need NVMe-capable bays.
const BAYS_STORAGE = (i: number): BayGroup[] => [{ ff: i >= 5 ? "nvme" : "3.5", count: 12 }];
// A Twin node's share of the chassis front: three 3.5" bays, six 2.5" bays from the 2014 generation, NVMe from G4.
const BAYS_TWIN = (i: number): BayGroup[] => (i <= 1 ? [{ ff: "3.5", count: 3 }] : [{ ff: i === 2 ? "2.5" : "nvme", count: 6 }]);
export const SERVER_LINES = [
  { id: "compute", name: "Balanced 1U", arch: "x86", makers: ["indel", "amb"], height: 1, sockets: 2, cores: 1, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 1, price: 1, from: 2005 },
  { id: "compute-2psu", name: "Balanced 1U, 2 PSU", arch: "x86", makers: ["indel"], height: 1, sockets: 2, cores: 1, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 2, gpus: 0, watts: 1.05, price: 1.1, from: 2005 },
  { id: "value", name: "Value 1U", bayN: [2, 2, 4, 4, 4, 4, 4], driveN: [1, 1, 1, 1, 1, 1, 1], driveGb: [160, 500, 1000, 0, 0, 0, 0], arch: "x86", makers: ["indel", "amb"], height: 1, sockets: 1, cores: 0.5, ram: 0.5, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 1, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 0.55, price: 0.5, from: 2005 },
  // The clock line ships the fastest CPU of its socket for game servers and other single-thread work.
  { id: "micro", name: "Clock 1U", bayN: [2, 2, 4, 4, 4, 4, 4], driveN: [1, 1, 1, 1, 1, 1, 1], driveGb: [160, 500, 1000, 0, 0, 0, 0], arch: "x86", makers: ["indel", "amb"], height: 1, sockets: 1, cores: 0.5, ram: 0.5, bays: BAYS_SMALL, dimms: [4, 4, 8, 8], pcie: 1, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 0.6, price: 0.6, from: 2005, fast: true },
  { id: "dense", name: "Compute-dense 1U", arch: "x86", makers: ["amb", "indel"], height: 1, sockets: 2, cores: 2, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 1.5, price: 1.6, from: 2005 },
  { id: "memory", name: "Memory-optimized 2U", arch: "x86", makers: ["indel", "amb"], height: 2, sockets: 2, cores: 1, ram: 4, bays: BAYS_8, dimms: [16, 24, 32, 48], pcie: 4, drives: 1, disk: "gen", ports: 4, psus: 2, gpus: 0, watts: 1.6, price: 1.8, from: 2005 },
  { id: "bigmem", name: "Large-memory 2U", arch: "x86", makers: ["indel", "amb"], height: 2, sockets: 2, cores: 1, ram: 8, bays: BAYS_8, dimms: [32, 48, 64, 96], pcie: 4, drives: 1, disk: "gen", ports: 4, psus: 2, gpus: 0, watts: 1.9, price: 2.8, from: 2005 },
  { id: "quad", name: "Four-socket 2U", arch: "x86", makers: ["indel"], height: 2, sockets: 4, cores: 2, ram: 8, bays: BAYS_8, dimms: [32, 48, 64, 96], pcie: 6, drives: 2, disk: "gen", ports: 4, psus: 2, gpus: 0, watts: 1.95, price: 4, from: 2005 },
  { id: "storage", name: "Storage 2U", bayN: [8, 12, 12, 12, 12, 12, 12], driveN: [4, 8, 12, 12, 12, 12, 12], driveGb: [160, 500, 1000, 0, 0, 0, 0], arch: "x86", makers: ["indel", "amb"], height: 2, sockets: 2, cores: 1, ram: 1, bays: BAYS_STORAGE, dimms: [8, 12, 16, 24], pcie: 4, drives: 12, disk: "gen", ports: 2, psus: 2, gpus: 0, watts: 1.7, price: 2, from: 2005 },
  { id: "storage-24", name: "Storage 2U, 24 bays", bayN: [24, 24, 24, 24, 24, 24, 24], driveN: [8, 12, 24, 24, 24, 24, 24], driveGb: [73, 146, 300, 0, 0, 0, 0], arch: "x86", makers: ["indel", "amb"], height: 2, sockets: 2, cores: 1, ram: 1, bays: BAYS_SFF_24, dimms: [16, 24, 32, 48], pcie: 4, drives: 24, disk: "gen", ports: 2, psus: 2, gpus: 0, watts: 1.8, price: 2.2, from: 2005 },
  { id: "backup", name: "Backup storage 4U", bayN: [12, 16, 24, 36, 36, 36, 36], driveN: [6, 12, 16, 36, 36, 36, 36], driveGb: [160, 500, 2000, 0, 0, 0, 0], arch: "x86", makers: ["amb", "indel"], height: 4, sockets: 1, cores: 0.5, ram: 0.5, bays: BAYS_3_5(36), dimms: [8, 12, 16, 24], pcie: 4, drives: 36, disk: "large", ports: 2, psus: 2, gpus: 0, watts: 2, price: 2.4, from: 2005 },
  { id: "archive", name: "Archive storage 4U", bayN: [24, 36, 48, 60, 60, 60, 60], driveN: [12, 24, 36, 60, 60, 60, 60], driveGb: [500, 1000, 3000, 0, 0, 0, 0], arch: "x86", makers: ["amb", "indel"], height: 4, sockets: 1, cores: 0.25, ram: 0.25, bays: BAYS_3_5(60), dimms: [8, 8, 16, 16], pcie: 2, drives: 60, disk: "dense", ports: 2, psus: 2, gpus: 0, watts: 2.2, price: 3.2, from: 2005 },
  { id: "gpu", name: "GPU 4U", arch: "x86", makers: ["indel", "amb"], height: 4, sockets: 2, cores: 1, ram: 2, bays: BAYS_8, dimms: [16, 24, 32, 48], pcie: 8, drives: 1, disk: "gen", ports: 2, psus: 2, gpus: 4, watts: 2, price: 3, from: 2011 },
  { id: "gpu-8", name: "GPU 4U, 8 cards", arch: "x86", makers: ["indel", "amb"], height: 4, sockets: 2, cores: 1, ram: 4, bays: BAYS_8, dimms: [16, 24, 32, 48], pcie: 16, drives: 2, disk: "gen", ports: 4, psus: 2, gpus: 8, watts: 2.5, price: 4, from: 2017 },
  // Four nodes in a shared 2U chassis (Twin 2U below); a node has no height of its own.
  { id: "twin-node", name: "Twin node", arch: "x86", makers: ["indel", "amb"], height: 0, sockets: 2, cores: 1, ram: 1, bays: BAYS_TWIN, dimms: [8, 12, 16, 16], pcie: 1, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 0.8, price: 0.6, from: 2008 },
  { id: "arm", name: "ARM 1U", arch: "arm", makers: ["ampear"], height: 1, sockets: 1, cores: 1.5, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 0.6, price: 0.9, from: 2020 },
] as const;

// What each manufacturer calls a line in each generation, in the maker's own numbering; a line a maker does not build has
// null. Parodies of the real lineups: PowerEdgy (PowerEdge), ProLight (ProLiant), SuperSaver (SuperServer), System x and
// ThinkSystem, Gigabutt's letter-number boards. Lenovoid starts with the 2011 generation, Gigabutt with 2014.
type Names = readonly (string | null)[];
const _ = null;
export const LINEUP: Record<string, { family: string; lines: Record<string, Names> }> = {
  Dwell: { family: "PowerEdgy", lines: {
    compute: ["1850", "R610", "R620", "R630", "R640", "R650", "R660"],
    "compute-2psu": ["1850 DP", "R610 DP", "R620 DP", "R630 DP", "R640 DP", "R650 DP", "R660 DP"],
    value: ["R200", "R210", "R220", "R230", "R240", "R250", "R260"],
    memory: ["2850", "R710", "R720", "R730", "R740", "R750", "R760"],
    quad: ["R900", "R910", "R920", "R930", "R940", "R950", "R960"],
    storage: ["2900", "R510", "R720xd", "R730xd", "R740xd", "R750xd", "R760xd"],
    "storage-24": ["2950 SFF", "R710 SFF", "R720xd SFF", "R730xd SFF", "R740xd SFF", "R750xd SFF", "R760xd SFF"],
    archive: ["NX1950", "NX3000", "NX3200", "NX3230", "NX3240", "NX3340", "NX3440"],
    gpu: [_, _, "C410x", "C4130", "C4140", "XE8545", "XE8640"],
    "gpu-8": [_, _, _, _, _, _, "XE9680"],
    "twin-node": [_, "C6100", "C6220", "C6320", "C6420", "C6520", "C6620"],
  } },
  "Hewlett-Packet": { family: "ProLight", lines: {
    compute: ["DL360 G5", "DL360 G6", "DL360p Gen8", "DL360 Gen9", "DL360 Gen10", "DL360 Gen10 Plus", "DL360 Gen11"],
    micro: ["DL120 G5", "DL120 G6", "DL120 Gen8", "DL120 Gen9", "DL20 Gen10", "DL20 Gen10 Plus", "DL20 Gen11"],
    memory: ["DL380 G5", "DL380 G6", "DL380p Gen8", "DL380 Gen9", "DL380 Gen10", "DL380 Gen10 Plus", "DL380 Gen11"],
    bigmem: ["DL385 G5", "DL385 G6", "DL385p Gen8", "DL385 Gen9", "DL385 Gen10", "DL385 Gen10 Plus", "DL385 Gen11"],
    quad: ["DL580 G5", "DL580 G7", "DL580 Gen8", "DL580 Gen9", "DL580 Gen10", "DL560 Gen10 Plus", "DL560 Gen11"],
    storage: ["DL180 G5", "DL180 G6", "DL180 Gen8", "DL180 Gen9", "DL180 Gen10", "DL180 Gen10 Plus", "DL180 Gen11"],
    "gpu-8": [_, _, _, _, "Apollo 6500 Gen10", "Apollo 6500 Gen10 Plus", "Apollo 6500 Gen11"],
    "twin-node": [_, _, _, "Apollo 2000 Gen9", "Apollo 2000 Gen10", "Apollo 2000 Gen10 Plus", "Apollo 2000 Gen11"],
    arm: [_, _, _, _, _, "RL300 Gen11", "RL300 Gen12"],
  } },
  SuperMacro: { family: "SuperSaver", lines: {
    compute: ["6015P-TR", "6016T-URF", "6017R-WRF", "6018R-WTR", "6019P-WT", "1029P-WTR", "SYS-121C-TN10R"],
    value: ["5015M-T", "5016I-T", "5017R-MTF", "5018R-WR", "5019P-MTR", "1019P-WTR", "SYS-111E-WR"],
    micro: ["5015M-MT", "5016T-MTF", "5017C-MTF", "5018D-MTF", "5019S-MR", "5019C-MR", "SYS-511E-WR"],
    dense: ["6015T-TB", "6016T-NTF", "6017R-NTF", "6018R-TDW", "6019P-WTR", "1029U-TRTP", "SYS-121H-TNR"],
    memory: ["6025B-TR+", "6026T-URF", "6027R-72RFTP", "6028R-WTR", "6029P-WTR", "2029U-TRT", "SYS-221H-TNR"],
    quad: [_, _, _, _, "8049U-E1CR4T", "SYS-240P-TNRT", "SYS-241H-TNRTTP"],
    storage: ["6025W-NTR", "6026T-RFT+", "6027R-E1R12L", "6028R-E1CR12L", "6029P-E1CR12L", "2029P-E1CR12L", "SSG-221P-C9R"],
    "storage-24": ["6025W-URB", "6026T-6RF+", "6027R-E1R24N", "6028R-E1CR24N", "6029P-E1CR24L", "2029U-E1CR25M", "SYS-221H-TN24R"],
    backup: ["SC847E1", "847E16-R1400", "6047R-E1R36L", "6048R-E1CR36L", "6049P-E1CR36L", "6049P-E1CR36H", "SSG-641E-E1CR36L"],
    archive: [_, _, "6047R-E1R72L", "6048R-E1CR60L", "6049P-E1CR60L", "6049P-E1CR60H", "SSG-640SP-E1CR60"],
    gpu: [_, _, "7047GR-TRF", "7048GR-TR", "7049GP-TRT", "SYS-420GP-TNR", "SYS-421GE-TNRT"],
    "gpu-8": [_, _, _, _, "4029GP-TRT2", "AS-4124GS-TNR", "SYS-421GU-TNXR"],
    "twin-node": [_, "6026TT-HTRF", "6027TR-HTRF", "6028TP-HTR", "6029TP-HTR", "2029TP-HTR", "SYS-221BT-HNTR"],
    arm: [_, _, _, _, _, "ARS-110M-NR", "ARS-210M-NR"],
  } },
  Lenovoid: { family: "", lines: {
    compute: [_, _, "System x3550 M4", "System x3550 M5", "ThinkSystem SR630", "ThinkSystem SR630 V2", "ThinkSystem SR630 V3"],
    value: [_, _, "System x3250 M4", "System x3250 M5", "ThinkSystem SR250", "ThinkSystem SR250 V2", "ThinkSystem SR250 V3"],
    memory: [_, _, "System x3650 M4", "System x3650 M5", "ThinkSystem SR650", "ThinkSystem SR650 V2", "ThinkSystem SR650 V3"],
    bigmem: [_, _, "System x3750 M4", _, "ThinkSystem SR590", "ThinkSystem SR590 V2", "ThinkSystem SR655 V3"],
    quad: [_, _, "System x3850 X5", "System x3850 X6", "ThinkSystem SR850", "ThinkSystem SR850 V2", "ThinkSystem SR850 V3"],
    gpu: [_, _, _, _, "ThinkSystem SR670", "ThinkSystem SR670 V2", "ThinkSystem SR675 V3"],
    "twin-node": [_, _, _, _, "ThinkSystem SD530", "ThinkSystem SD630 V2", "ThinkSystem SD650 V3"],
  } },
  Gigabutt: { family: "", lines: {
    compute: [_, _, _, "R180-F28", "R181-2A0", "R182-Z90", "R183-Z90"],
    micro: [_, _, _, "R121-X30", "R121-340", "R163-S30", "R163-Z30"],
    dense: [_, _, _, _, "R181-NA0", "R182-NA1", "R183-S90"],
    memory: [_, _, _, "R280-F3C", "R281-3C2", "R282-Z93", "R283-Z93"],
    storage: [_, _, _, _, "S251-3O0", "S252-ZC0", "S253-Z40"],
    gpu: [_, _, _, _, "G191-H44", "G242-Z10", "G293-S40"],
    "gpu-8": [_, _, _, _, "G291-281", "G492-ZD2", "G593-SD0"],
    "twin-node": [_, _, _, _, "H261-H60", "H262-Z62", "H263-S62"],
    arm: [_, _, _, _, _, "R272-P30", "R263-P33"],
  } },
};
// The manufacturers that build a line in a generation (index 0 for G1).
const lineBrands = (line: string, i: number): string[] => Object.keys(LINEUP).filter((b) => LINEUP[b].lines[line]?.[i]);
// The maker's own name for a server, chassis or node ("PowerEdgy R620", "SuperSaver 6027TR-HTRF node"); other models keep
// their catalog name.
export function modelName(m: DeviceModel, brand: string): string {
  if (!m.line || m.gen === undefined) return m.name;
  const lineup = LINEUP[brand], name = lineup?.lines[m.line]?.[m.gen - 1];
  if (!name) return m.name;
  return `${lineup.family} ${name}`.trim() + (m.chassis ? " node" : "");
}

// A generation stays in the shop until the one two steps newer arrives.
const SERVERS: DeviceModel[] = GENERATIONS.flatMap((g, i) =>
  SERVER_LINES.filter((v) => v.from <= g.year && lineBrands(v.id, i).length).map((v) => {
    const off = GENERATIONS[i + 2];
    // A line may ship fewer drives than it has bays and smaller drives in the early generations (0 takes the generation's).
    const own = v as { bayN?: readonly number[]; driveN?: readonly number[]; driveGb?: readonly number[] };
    const driveGb = own.driveGb?.[i] || (v.disk === "large" ? LARGE_HDD_GB[i] : v.disk === "dense" ? DENSE_HDD_GB[i] : g.diskGb);
    const driveN = own.driveN?.[i] ?? v.drives, bays = v.bays(i).map((b) => ({ ...b, count: own.bayN?.[i] ?? b.count }));
    const ramGb = g.ramGb * v.ram, dimmSlots = v.dimms[Math.floor(i / 2)];
    // Sticks double in size until they fit the slots (the memory line outgrows the generation's standard stick).
    let stickGb = RAM_STICK_GB[i];
    while (ramGb / stickGb > dimmSlots) stickGb *= 2;
    return {
      id: `g${i + 1}-${v.id}`,
      name: `${v.name} G${i + 1}`,
      kind: "server" as const,
      brands: lineBrands(v.id, i),
      line: v.id,
      gen: i + 1,
      height: v.height,
      ports: ports(v.ports, portGbit(g.year)),
      watts: Math.round(g.watts * v.watts),
      idleWatts: Math.round(g.watts * v.watts * 0.4),
      psus: v.psus,
      price: Math.round(g.price * v.price) + (v.gpus ? v.gpus * Math.round(gpuPrice(cardAt(g.year)!, g.year)) : 0),
      from: g.year,
      until: off ? off.year - 1 : null,
      supportYears: 5,
      server: {
        arch: v.arch, makers: [...v.makers], sockets: v.sockets, cores: Math.round(g.cores * v.cores), ramGb, maxRamGb: 2 * ramGb,
        dimmSlots, bays, pcie: v.pcie, psuBays: 2, diskGb: driveGb * driveN, disk: v.disk === "gen" ? g.disk : "HDD", gpus: v.gpus,
        drives: driveN, ramSticks: Math.max(1, Math.round(ramGb / stickGb)), ...("fast" in v && v.fast ? { fast: true } : {}),
      },
    };
  }),
);

// The Twin 2U chassis of each generation: two shared power supplies, the fan wall and four nodes, priced as the four nodes.
export const TWIN_NODES = 4;
const TWINS: DeviceModel[] = SERVERS.filter((m) => m.id.endsWith("-twin-node")).map((node) => {
  const id = node.id.replace(/-node$/, "");
  node.chassis = id;
  return {
    id, name: node.name.replace("Twin node", "Twin 2U"), kind: "chassis", brands: node.brands, line: node.line, gen: node.gen, height: 2, ports: [], watts: 0, idleWatts: 0, psus: 2, price: node.price * TWIN_NODES,
    from: node.from, until: node.until, supportYears: node.supportYears, nodes: { model: node.id, count: TWIN_NODES },
  };
});

type Extra = Partial<Pick<DeviceModel, "layer" | "throughputGbit" | "batteryWh" | "brand" | "fullTable" | "bgpSessions" | "outlets" | "psus" | "oob" | "atx" | "failYearly">>;
// Years on sale after launch and years of support after that (economy.md, Hardware lifecycle); other kinds never end.
const LIFE: Partial<Record<DeviceKind, { sale: number; support: number }>> = {
  switch: { sale: 6, support: 5 }, firewall: { sale: 6, support: 5 }, gateway: { sale: 6, support: 5 }, ups: { sale: 8, support: 3 }, pdu: { sale: 8, support: 3 },
};
// The newest model of each line stays on sale until a successor row exists (economy.md, Routers, UPS and PDUs).
const NEWEST = new Set(["sw-32e", "fw-400g", "edge-xxl", "ups-10k", "pdu-24", "fb-5690", "isr-8300", "ccr2216", "mx304"]);
const other = (id: string, name: string, kind: DeviceKind, height: number, p: PortSpec[], watts: number, price: number, from = 2005, extra: Extra = {}): DeviceModel => {
  const life = price > 0 ? LIFE[kind] : undefined;
  return { id, name, kind, height, ports: p, watts, idleWatts: watts, psus: 1, price, from, until: life && !NEWEST.has(id) ? from + life.sale : null, supportYears: life?.support ?? 0, ...extra };
};
// Routers: throughput in Gbit, a full BGP table or not, and the BGP sessions they take.
const router = (tp: number, bgp: number, full = false): Extra => ({ throughputGbit: tp, bgpSessions: bgp, fullTable: full });
const oobs = (n: number, p: OobPort): OobPort[] => Array.from({ length: n }, () => p);
const L2 = { layer: 2 } as const, L3 = { layer: 3 } as const;

export const MODELS: DeviceModel[] = [
  ...SERVERS,
  ...TWINS,
  other("sw-8", "L2 switch 8", "switch", 1, ports(8, 1), 8, 60, 2005, L2),
  other("sw-24", "L2 switch 24", "switch", 1, [...ports(24, 1), ...ports(2, 1, "sfp")], 40, 900, 2005, L2),
  other("sw-48", "L2 switch 48", "switch", 1, [...ports(48, 1), ...ports(4, 10)], 70, 2800, 2008, L2),
  other("sw-48x", "L2 switch 48 SFP", "switch", 1, ports(48, 10), 200, 8000, 2011, L2),
  other("sw-48-l3", "L3 switch 48", "switch", 1, [...ports(48, 1), ...ports(4, 10)], 110, 5500, 2008, L3),
  other("sw-48q", "L3 switch 48 SFP, 40G", "switch", 1, [...ports(48, 10), ...ports(6, 40)], 280, 14000, 2014, L3),
  other("sw-48y", "L3 switch 48 SFP, 100G", "switch", 1, [...ports(48, 25), ...ports(8, 100)], 400, 18000, 2017, L3),
  other("sw-32c", "L3 spine 32 × 100G", "switch", 1, ports(32, 100), 450, 20000, 2017, L3),
  other("sw-32d", "L3 spine 32 × 400G", "switch", 1, ports(32, 400), 900, 45000, 2022, L3),
  other("sw-32e", "L3 spine 32 × 800G", "switch", 1, ports(32, 800), 1400, 60000, 2027, L3),
  other("fw-1g", "Firewall 1G", "firewall", 1, ports(4, 1), 40, 1500, 2005, { throughputGbit: 1 }),
  other("fw-10g", "Firewall 10G", "firewall", 1, [...ports(8, 1), ...ports(4, 10)], 120, 6000, 2011, { throughputGbit: 10 }),
  other("fw-40g", "Firewall 40G", "firewall", 1, [...ports(8, 10), ...ports(4, 40)], 250, 18000, 2017, { throughputGbit: 40 }),
  other("fw-100g", "Firewall 100G", "firewall", 1, [...ports(8, 25), ...ports(4, 100)], 450, 40000, 2022, { throughputGbit: 100 }),
  other("fw-400g", "Firewall 400G", "firewall", 1, [...ports(8, 100), ...ports(4, 400)], 700, 70000, 2027, { throughputGbit: 400 }),
  // The first half of the ports are the front jacks, the second half the back; front i is wired to back jacks + i.
  other("patch-24", "Patch panel 24, copper", "patch", 1, ports(48, 1), 0, 80),
  other("patch-24f", "Patch panel 24, fiber", "patch", 1, ports(48, 400, "sfp"), 0, 250),
  other("patch-48", "Patch panel 48, copper", "patch", 1, ports(96, 1), 0, 140),
  other("patch-48f", "Patch panel 48, fiber", "patch", 1, ports(96, 400, "sfp"), 0, 450),
  // Edge routers mount in a rack; every uplink link takes one of their ports.
  other("edge-s", "Edge router S", "gateway", 1, ports(4, 1), 100, 3000, 2005, { brand: "Sysko", ...router(4, 4) }),
  other("edge-m", "Edge router M", "gateway", 1, [...ports(8, 10), ...ports(4, 1)], 200, 12000, 2008, { brand: "Sysko", ...router(40, 128, true) }),
  other("edge-l", "Edge router L", "gateway", 2, ports(32, 100), 600, 40000, 2014, { brand: "Sysko", ...router(400, 512, true) }),
  other("edge-xl", "Edge router XL", "gateway", 2, ports(36, 400), 900, 90000, 2021, { brand: "Sysko", ...router(800, 2048, true) }),
  other("edge-xxl", "Edge router XXL", "gateway", 2, ports(36, 400), 1200, 150000, 2027, { brand: "Sysko", ...router(1600, 4096, true) }),
  // Small-office routers replace the basement's carrier panel router; the routed speed caps the home line.
  other("fb-7050", "Fritz!Bocks 7050", "gateway", 0, ports(4, 1), 8, 150, 2006, { brand: "AVN", ...router(0.1, 0) }),
  other("fb-7390", "Fritz!Bocks 7390", "gateway", 0, ports(4, 1), 9, 220, 2010, { brand: "AVN", ...router(0.3, 0) }),
  other("fb-7590", "Fritz!Bocks 7590", "gateway", 0, ports(4, 1), 12, 249, 2018, { brand: "AVN", ...router(1, 0) }),
  other("fb-5690", "Fritz!Bocks 5690", "gateway", 0, ports(4, 1), 14, 330, 2024, { brand: "AVN", ...router(2.5, 0) }),
  // Business and branch routers mount in a rack; only the ones with a full table can run an own AS.
  other("isr-1841", "Router 1841", "gateway", 1, ports(2, 1), 40, 1300, 2005, { brand: "Sysko", ...router(0.1, 2) }),
  other("isr-2811", "Router 2811", "gateway", 2, ports(4, 1), 120, 2500, 2005, { brand: "Sysko", ...router(0.3, 4) }),
  other("isr-2911", "Router 2911", "gateway", 2, ports(3, 1), 130, 2800, 2009, { brand: "Sysko", ...router(1, 8) }),
  other("isr-4451", "Router 4451", "gateway", 2, ports(4, 1), 250, 8000, 2013, { brand: "Sysko", ...router(2, 64, true) }),
  other("isr-8300", "Router 8300", "gateway", 2, [...ports(4, 10), ...ports(4, 1)], 300, 9000, 2020, { brand: "Sysko", ...router(10, 256, true) }),
  other("rb1100", "RB1100", "gateway", 1, ports(13, 1), 30, 300, 2010, { brand: "MicroTick", ...router(1, 4) }),
  other("ccr1036", "CCR1036", "gateway", 1, [...ports(12, 1), ...ports(4, 10)], 40, 1000, 2013, { brand: "MicroTick", ...router(10, 128, true) }),
  other("ccr2004", "CCR2004", "gateway", 1, [...ports(16, 1), ...ports(2, 10)], 40, 450, 2020, { brand: "MicroTick", ...router(10, 128, true) }),
  other("ccr2216", "CCR2216", "gateway", 1, [...ports(16, 25), ...ports(2, 100)], 120, 2500, 2022, { brand: "MicroTick", ...router(100, 512, true) }),
  other("mx80", "MX80", "gateway", 2, [...ports(4, 10), ...ports(8, 1)], 350, 25000, 2010, { brand: "Junipurr", ...router(80, 512, true) }),
  other("mx204", "MX204", "gateway", 1, [...ports(4, 100), ...ports(8, 10)], 400, 40000, 2017, { brand: "Junipurr", ...router(400, 2048, true) }),
  other("mx304", "MX304", "gateway", 2, ports(16, 100), 1000, 80000, 2022, { brand: "Junipurr", ...router(1600, 8192, true) }),
  // economy.md, Power outages: the small UPS carries a 0.2 kW basement rack for about 3 hours.
  other("ups-1500", "UPS 1500 VA", "ups", 1, [], 10, 180, 2005, { batteryWh: 600 }),
  other("ups-3000", "UPS 3000 VA", "ups", 2, [], 25, 900, 2005, { batteryWh: 1800 }),
  other("ups-5k", "UPS 5 kVA", "ups", 3, [], 50, 2500, 2005, { batteryWh: 3500 }),
  other("ups-10k", "UPS 10 kVA", "ups", 6, [], 100, 6000, 2008, { batteryWh: 8000, psus: 2 }),
  // A switched PDU cuts or cycles any device in its rack; a 0U one hangs on the rack's side rail.
  other("pdu-8", "Switched PDU 8", "pdu", 1, [], 15, 700, 2005, { outlets: 8 }),
  other("pdu-24", "Switched PDU 24", "pdu", 0, [], 20, 1200, 2008, { outlets: 24 }),
  // Remote access (economy.md, Hardware, power and failures): KVMs over IP, serial console servers and an OOB management switch.
  other("pikvn", "PiKVN", "kvm", 0, [], 5, 60, 2019, { brand: "Pear Street Electronics", oob: ["net", "kvm"], atx: true, failYearly: 0.04 }),
  other("ipkvn-8", "IP-KVN 8", "kvm", 1, [], 25, 1200, 2005, { brand: "Avoscent", oob: ["net", ...oobs(8, "kvm")], failYearly: 0.04 }),
  other("ogb-8", "OpenGearbox 8", "console", 1, [], 15, 1500, 2005, { brand: "OpenGearbox", oob: ["net", ...oobs(8, "serial")] }),
  other("ogb-16", "OpenGearbox 16", "console", 1, [], 18, 2500, 2005, { brand: "OpenGearbox", oob: ["net", ...oobs(16, "serial")] }),
  other("ogb-48", "OpenGearbox 48", "console", 1, [], 30, 6000, 2005, { brand: "OpenGearbox", oob: ["net", ...oobs(48, "serial")] }),
  other("oob-8", "OOB switch 8", "oob", 1, [], 8, 150, 2005, { brand: "Rarytan", oob: oobs(8, "net") }),
  // Price 0 keeps gateways out of the shop; they come with the basement and with every datacenter location.
  other("home-router", "Home router", "gateway", 0, ports(4, 1), 10, 0, 2005, router(0.1, 0)),
  other("handoff", "Datacenter handoff", "gateway", 0, ports(2, 1), 0, 0),
  ...COMPONENT_KINDS.map((k) => other(`part-${k}`, `Spare ${COMPONENT_NAMES[k]}`, "part", 0, [], 0, COMPONENTS[k].price)),
];
// Model ids from older saves.
export const RENAMED_MODELS: Record<string, string> = Object.fromEntries(GENERATIONS.flatMap((_, i) => [
  [`g${i + 1}-compute-1s`, `g${i + 1}-compute`],
  [`g${i + 1}-highmem`, `g${i + 1}-memory`],
]));
// Whether a server model carries a baseboard management controller: Dwell and Hewlett-Packet from the 2008 generation,
// SuperMacro and Lenovoid from 2011, the ARM line always. The 2005 generation and models outside the generation line never do.
const BMC_FROM: Record<string, number> = { Dwell: 2, "Hewlett-Packet": 2, SuperMacro: 3, Lenovoid: 3, Gigabutt: 4 };
// What each brand calls its management controller.
export const BMC_NAME: Record<string, string> = { Dwell: "iDRAQ", "Hewlett-Packet": "iLOL", SuperMacro: "IPMI", Lenovoid: "XClarify", Gigabutt: "MegaRAQ" };
export function hasBmc(modelId: string, brand: string): boolean {
  const m = /^g(\d+)-(.+)$/.exec(modelId);
  return !!m && (m[2] === "arm" || Number(m[1]) >= (BMC_FROM[brand] ?? 3));
}
// A model's management ports: a server's console end, a switch or rack router's mgmt and console ports, or the model's own.
export const oobPorts = (m: DeviceModel): OobPort[] =>
  m.oob ?? (m.kind === "server" ? ["console"] : m.kind === "switch" || (m.kind === "gateway" && m.height > 0) ? ["mgmt", "console"] : []);
export const isOobPort = (port: number): boolean => port >= OOB_PORT;
// Whether a cable may join these two ends when one is a management port: a KVM output or a serial port to a console port
// (a KVM only to a server's), a mgmt port to the OOB switch, and a management device's network jack to the OOB switch or to
// a data switch's copper port.
export function oobFits(ma: DeviceModel, a: OobPort | PortSpec, mb: DeviceModel, b: OobPort | PortSpec): boolean {
  const one = (x: OobPort | PortSpec, mx: DeviceModel, y: OobPort | PortSpec, my: DeviceModel): boolean => {
    if (x === "kvm") return y === "console" && my.kind === "server";
    if (x === "serial") return y === "console";
    if (x !== "net") return false;
    if (typeof y !== "string") return y.media === "rj45" && my.kind === "switch";
    return mx.kind === "oob" ? y === "mgmt" || y === "net" : y === "net" && my.kind === "oob";
  };
  return one(a, ma, b, mb) || one(b, mb, a, ma);
}
// Network and management gear runs firmware with a yearly release (oob.ts).
export const hasFirmware = (m: DeviceModel): boolean => m.kind !== "server" && oobPorts(m).length > 0;
// The kind of a management port; undefined for a data port or one the model does not have.
export const oobPortOf = (m: DeviceModel, port: number): OobPort | undefined => (isOobPort(port) ? oobPorts(m)[port - OOB_PORT] : undefined);
// A bought router that sits on the carrier panel in place of the location's provided one.
export const isOfficeRouter = (m: DeviceModel): boolean => m.kind === "gateway" && m.height === 0 && m.price > 0;
export const jacksOf =(m: DeviceModel): number => m.ports.length / 2;
// Jacks on a 24-port panel; use jacksOf for the 48-port panels.
export const PATCH_JACKS = 24;
const MODEL_INDEX = new Map(MODELS.map((m) => [m.id, m]));
export const modelById = (id: string): DeviceModel => {
  const m = MODEL_INDEX.get(id);
  if (!m) throw new Error(`unknown model ${id}`);
  return m;
};
// The same server with its second power supply bay filled, for models sold in both builds.
export const dualPsuModel = (id: string): DeviceModel | undefined => MODELS.find((x) => x.id === `${id}-2psu`);
export const manufacturerByName = (name: string): Manufacturer | undefined => MANUFACTURERS.find((m) => m.name === name);
// What a unit of this model costs from this manufacturer.
export const priceOf = (model: DeviceModel, brand: string): number => Math.round(model.price * (model.brand ? 1 : manufacturerByName(brand)?.priceFactor ?? 1));
// What a brand's variant of a model does: the release as a month count (year * 12 + month, January 0), the last year on
// sale (null while it stays on sale) and the draw in watts. A model fixed to one brand has no variants.
const shifted = (m: DeviceModel, brand: string) => (m.brand ? undefined : manufacturerByName(brand));
export const brandFrom = (m: DeviceModel, brand: string): number => m.from * 12 + (shifted(m, brand)?.fromShift ?? 0);
export const brandUntil = (m: DeviceModel, brand: string): number | null => (m.until === null ? null : m.until + (shifted(m, brand)?.untilShift ?? 0));
export const wattsFactorOf = (m: DeviceModel, brand: string): number => shifted(m, brand)?.wattsFactor ?? 1;
export const brandWatts = (m: DeviceModel, brand: string): number => m.watts * wattsFactorOf(m, brand);
// Whether the brand sells the model in this month (year * 12 + month); the end of sale is the last month of its last year.
export const brandOnSale = (m: DeviceModel, brand: string, month: number): boolean => {
  const until = brandUntil(m, brand);
  return brandFrom(m, brand) <= month && (until === null || month < (until + 1) * 12);
};
// The models some brand sells during the year. Nodes come with their chassis and are not sold alone.
export const shopModels = (year: number): DeviceModel[] =>
  MODELS.filter((m) => m.price > 0 && !m.chassis && brandsOf(m).some((b) => brandFrom(m, b) < (year + 1) * 12 && (brandUntil(m, b) ?? year) >= year));

// NVMe drive size per generation in GB; NVMe-capable bays come with G4, so the drives do too.
const NVME_GB = [0, 0, 0, 1000, 2000, 8000, 15000];
// HDD sizes on sale in GB with their first and last year, on top of the sizes the presets ship with.
const HDD_SIZES: [gb: number, from: number, until: number][] = [
  [80, 2005, 2008], [160, 2005, 2009], [500, 2005, 2014], [1000, 2008, 2018],
  [2000, 2010, 2022], [3000, 2012, 2022], [4000, 2014, 2030], [6000, 2015, 2030], [8000, 2017, 2030], [10000, 2018, 2030], [12000, 2019, 2030],
];
export const samePart = (a: PartSpec, b: PartSpec): boolean => a.kind === b.kind && a.size === b.size && a.ff === b.ff && a.vendor === b.vendor && a.gen === b.gen && a.sku === b.sku;
// Whether an offer covers a wanted part: the same part, or the same size of a CPU wanted without a name.
export const offersPart = (offer: PartSpec, want: PartSpec): boolean => samePart(offer, want) || (want.sku === undefined && samePart({ ...offer, sku: undefined }, want));
// The sized parts the Parts tab sells: whatever the presets in the shop are built from with each CPU maker of the generation, which is
// the current generation's sizes and the one before, plus NVMe drives.
export function partOffers(year: number): PartSpec[] {
  const out: PartSpec[] = [], add = (p: PartSpec) => { if (!out.some((o) => samePart(o, p))) out.push(p); };
  for (const m of MODELS.filter((x) => x.from <= year && (x.until === null || year <= x.until) && x.price > 0)) for (const v of m.server ? vendorsAt(m.server.arch, genOf(m)) : []) {
    componentParts(m, v).forEach(add);
    for (const c of cpuSkus(v, genOf(m), year)) add({ kind: "cpu", size: c.cores, vendor: v, gen: c.gen, sku: c.id });
  }
  const g = generationAt(year);
  for (const [gb, from, until] of HDD_SIZES) if (year >= from && year <= until) for (const ff of year >= 2008 && gb <= 2000 ? (["3.5", "2.5"] as const) : (["3.5"] as const)) add({ kind: "hdd", size: gb, ff });
  for (const i of [g - 1, g]) if (NVME_GB[i]) add({ kind: "nvme", size: NVME_GB[i], ff: "nvme" });
  for (const c of gpuOffers(year)) add({ kind: "gpu", size: c.year });
  const maker = (p: PartSpec) => (p.vendor ? VENDORS.indexOf(p.vendor) : -1);
  return out.sort((a, b) => COMPONENT_KINDS.indexOf(a.kind) - COMPONENT_KINDS.indexOf(b.kind) || maker(a) - maker(b) || (a.size ?? 0) - (b.size ?? 0));
}
