// Values come from docs/design/economy.md (Server generations, Server lines, Manufacturers, Switches, Security appliances, Patch panels and gateways).
import { GENERATIONS } from "./economy";
import { cardAt, cardOf, gpuOffers, gpuPrice } from "./gpu";
import { DDR_BY_GEN, defaultFamily, familiesOn, familyById, familySizes, isRamFamily, PART_MAKERS } from "./families";
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
    // Drives and sticks come from the first family of the year that sells the size (families.ts), cards from the Tezla line.
    const drive = defaultFamily(DRIVE_KIND[v.disk], m.from, v.diskGb / v.drives, presetFf(v)), stick = defaultFamily("ram", m.from, v.ramGb / v.ramSticks, undefined, DDR_BY_GEN[gen - 1]), card = cardAt(m.from);
    const named = (parts: PartSpec[], f?: { id: string }): PartSpec[] => (f ? parts.map((p) => ({ ...p, sku: f.id })) : parts);
    return [
      // A node runs on its chassis's power supplies and fans.
      ...named(n(DRIVE_KIND[v.disk], v.drives, () => v.diskGb / v.drives, presetFf(v)), drive), ...(m.chassis ? [] : [...n("psu", m.psus), ...n("fan", 4)]),
      ...named(n("ram", v.ramSticks, () => v.ramGb / v.ramSticks), stick), { kind: "board", vendor: maker, gen, size: boardSpec(m, maker)?.maxCores }, ...Array.from({ length: v.sockets }, cpu), ...n("nic", 1),
      // A GPU line ships with the newest card of its generation; a part names its card by launch year.
      ...named(n("gpu", v.gpus, () => card?.year ?? 0), card ?? undefined),
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
  if (cards.length > gpuSlots(m) || (m.height < 4 && cards.some((p) => cardOf(p.size, p.sku).wide))) return "error.noSlot";
  if (v && parts.filter((p) => p.kind === "ram").reduce((n, p) => n + (p.size ?? 0), 0) > v.maxRamGb) return "error.tooMuchRam";
  // A stick with a maker names its DDR type, which must be the board's; a stick without one fits any board.
  const ddr = DDR_BY_GEN[genOf(m) - 1];
  if (v && parts.some((p) => { const f = p.kind === "ram" ? familyById(p.sku) : undefined; return f && isRamFamily(f) && f.ddr !== ddr; })) return "error.wrongRam";
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
  // Firewalls cap every link through them at this speed; ipsGbit is what they inspect, sessions the connections they track.
  throughputGbit?: number;
  ipsGbit?: number;
  sessions?: number;
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
  { id: "hewlett-packet", name: "Hewlett-Packet", kinds: ["server", "switch"], priceFactor: 1.08, failureFactor: 0.8, fromShift: 3, untilShift: -1, wattsFactor: 0.95 },
  { id: "supermacro", name: "SuperMacro", kinds: ["server", "chassis"], priceFactor: 0.9, failureFactor: 1.3, fromShift: -4, untilShift: 1, wattsFactor: 1.05 },
  { id: "lenovoid", name: "Lenovoid", kinds: ["server", "chassis"], priceFactor: 0.95, failureFactor: 1.1, fromShift: 6 },
  { id: "gigabutt", name: "Gigabutt", kinds: ["server", "chassis"], priceFactor: 0.9, failureFactor: 1.25, fromShift: -1, wattsFactor: 1.04 },
  { id: "sysko", name: "Sysko", kinds: ["switch", "firewall", "gateway"], priceFactor: 1, failureFactor: 1 },
  { id: "junipurr", name: "Junipurr", kinds: ["switch", "firewall", "gateway"], priceFactor: 1.1, failureFactor: 0.7 },
  { id: "aristotle", name: "Aristotle", kinds: ["switch"], priceFactor: 0.93, failureFactor: 1.2 },
  { id: "fortinope", name: "Fortinope", kinds: ["firewall"], priceFactor: 0.9, failureFactor: 1.25 },
  { id: "pablo-alto", name: "Pablo Alto", kinds: ["firewall"], priceFactor: 1.1, failureFactor: 0.75 },
  { id: "netgoat", name: "Netgoat", kinds: ["firewall"], priceFactor: 0.9, failureFactor: 1 },
  { id: "sophosphate", name: "SoPhosphate", kinds: ["firewall"], priceFactor: 0.95, failureFactor: 1.1 },
  { id: "pandoot", name: "Pandoot", kinds: ["patch"], priceFactor: 1, failureFactor: 1 },
  { id: "avn", name: "AVN", kinds: ["gateway"], priceFactor: 1, failureFactor: 0.9 },
  { id: "microtick", name: "MicroTick", kinds: ["switch", "gateway"], priceFactor: 1, failureFactor: 1.2 },
  { id: "nettgear", name: "Nettgear", kinds: ["switch"], priceFactor: 0.9, failureFactor: 1.2 },
  { id: "ubiquitea", name: "Ubiquitea", kinds: ["switch"], priceFactor: 0.9, failureFactor: 1.15 },
  { id: "d-lunk", name: "D-Lunk", kinds: ["switch"], priceFactor: 0.9, failureFactor: 1.3 },
  { id: "eatin", name: "Eatin", kinds: ["ups", "pdu"], priceFactor: 1, failureFactor: 1 },
  { id: "apcee", name: "APCee", kinds: ["ups", "pdu"], priceFactor: 1.05, failureFactor: 0.85 },
  { id: "vertivo", name: "Vertivo", kinds: ["ups"], priceFactor: 1.1, failureFactor: 0.8 },
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

type Extra = Partial<Pick<DeviceModel, "layer" | "throughputGbit" | "ipsGbit" | "sessions" | "batteryWh" | "brand" | "fullTable" | "bgpSessions" | "outlets" | "psus" | "oob" | "atx" | "failYearly" | "until" | "supportYears">>;
// Years on sale after launch and years of support after that (economy.md, Hardware lifecycle); other kinds never end.
const LIFE: Partial<Record<DeviceKind, { sale: number; support: number }>> = {
  switch: { sale: 6, support: 5 }, firewall: { sale: 6, support: 5 }, gateway: { sale: 6, support: 5 }, ups: { sale: 8, support: 3 }, pdu: { sale: 8, support: 3 },
};
// The newest model of each line stays on sale until a successor row exists (economy.md, Routers, UPS and PDUs).
export const NEWEST = new Set(["sw-32e", "fw-400g", "edge-xxl", "ups-10k", "pdu-24", "fb-5690", "isr-8300", "ccr2216", "mx304", "qfx5240", "ar-7060x6", "cat9300x-48", "mt-crs518", "ng-m4350-48", "ub-usw-ent-48", "dl-dgs1510-52x", "fg-4800f", "pa-7500", "srx4600", "nt-8200", "sp-xgs4500", "ar-7050sx3", "fg-90g", "sp-xgs87", "cat1000-8", "mt-crs310-8g", "ub-usw-lite-8", "ng-gs724tp", "hp-6100-24g"]);
const other = (id: string, name: string, kind: DeviceKind, height: number, p: PortSpec[], watts: number, price: number, from = 2005, extra: Extra = {}): DeviceModel => {
  const life = price > 0 ? LIFE[kind] : undefined;
  return { id, name, kind, height, ports: p, watts, idleWatts: watts, psus: 1, price, from, until: life && !NEWEST.has(id) ? from + life.sale : null, supportYears: life?.support ?? 0, ...extra };
};
// Routers: throughput in Gbit, a full BGP table or not, and the BGP sessions they take.
const router = (tp: number, bgp: number, full = false): Extra => ({ throughputGbit: tp, bgpSessions: bgp, fullTable: full });
const oobs = (n: number, p: OobPort): OobPort[] => Array.from({ length: n }, () => p);
// Switch and firewall makers: years on sale after launch and years of support after that. Hewlett-Packet's lifetime warranty
// never runs out, the budget makers drop a model fast.
export const NET_LIFE: Record<string, { sale: number; support: number }> = {
  Sysko: { sale: 6, support: 5 }, Junipurr: { sale: 6, support: 5 }, Aristotle: { sale: 5, support: 5 }, "Hewlett-Packet": { sale: 7, support: 99 },
  MicroTick: { sale: 6, support: 3 }, Nettgear: { sale: 5, support: 3 }, Ubiquitea: { sale: 5, support: 3 }, "D-Lunk": { sale: 4, support: 2 },
  Fortinope: { sale: 6, support: 5 }, "Pablo Alto": { sale: 6, support: 5 }, Netgoat: { sale: 5, support: 3 }, SoPhosphate: { sale: 6, support: 5 },
};
// A switch or firewall of one maker, in the maker's own numbering (economy.md, Switches; Security appliances).
const net = (brand: string, kind: "switch" | "firewall", id: string, name: string, from: number, p: PortSpec[], watts: number, price: number, extra: Extra = {}): DeviceModel => {
  const life = NET_LIFE[brand];
  return other(id, name, kind, 1, p, watts, price, from, { brand, until: NEWEST.has(id) ? null : from + life.sale, supportYears: life.support, ...extra });
};
const sw = (brand: string, id: string, name: string, from: number, p: PortSpec[], watts: number, price: number, layer: 2 | 3 = 2): DeviceModel => net(brand, "switch", id, name, from, p, watts, price, { layer });
// A firewall caps every link at its throughput; ipsGbit is what it inspects, sessions the connections it tracks.
const fw = (brand: string, id: string, name: string, from: number, p: PortSpec[], watts: number, price: number, tp: number, ips: number, sessions: number): DeviceModel =>
  net(brand, "firewall", id, name, from, p, watts, price, { throughputGbit: tp, ipsGbit: ips, sessions });
const copper = (n: number, up = 0, upGbit = 10): PortSpec[] => [...ports(n, 1), ...(up ? ports(up, upGbit, upGbit === 1 ? "sfp" : undefined) : [])];
// Parodies of the real lineups: Catalust and Nexxus (Catalyst, Nexus), EX and QFX, Aristotle 7000, ProCurvy and Arugula
// (ProCurve, Aruba), CRS, ProSafe and M4300, EdgeSwitch and UniFee (UniFi), DGS. Every year sells an 8, a 24 and a 48 port
// copper switch, one of them under 500 euro. The old generic ids stay as Sysko's models so saves keep their switches.
const SWITCHES: DeviceModel[] = [
  sw("Sysko", "sw-8", "Catalust 2960-8TC", 2005, ports(8, 1), 8, 60),
  sw("Sysko", "sw-24", "Catalust 2960-24TT", 2005, copper(24, 2, 1), 40, 900),
  sw("Sysko", "sw-48", "Catalust 2960S-48TD", 2008, copper(48, 4), 70, 2800),
  sw("Sysko", "sw-48-l3", "Catalust 3750X-48", 2008, copper(48, 4), 110, 5500, 3),
  sw("Sysko", "cat2960x-24", "Catalust 2960X-24TS", 2013, copper(24, 2), 30, 1100),
  sw("Sysko", "cat2960x-48", "Catalust 2960X-48TS", 2013, copper(48, 4), 60, 2400),
  sw("Sysko", "cat2960l-8", "Catalust 2960L-8TS", 2016, copper(8, 2, 1), 10, 300),
  sw("Sysko", "cat9300-48", "Catalust 9300-48T", 2017, copper(48, 4), 110, 5500, 3),
  sw("Sysko", "cat9200l-24", "Catalust 9200L-24T", 2018, copper(24, 4), 40, 1500),
  sw("Sysko", "cat9200l-48", "Catalust 9200L-48T", 2018, copper(48, 4), 70, 2800),
  sw("Sysko", "cat1000-8", "Catalust 1000-8T", 2020, ports(8, 1), 10, 300),
  sw("Sysko", "cat9300x-48", "Catalust 9300X-48TX", 2023, copper(48, 4, 25), 120, 6500, 3),
  sw("Sysko", "nx5010", "Nexxus 5010", 2008, ports(20, 10), 300, 12000),
  sw("Sysko", "sw-48x", "Nexxus 3064", 2011, ports(48, 10), 200, 8000),
  sw("Sysko", "sw-48q", "Nexxus 9372PX", 2014, [...ports(48, 10), ...ports(6, 40)], 280, 14000, 3),
  sw("Sysko", "sw-48y", "Nexxus 93180YC-EX", 2017, [...ports(48, 25), ...ports(8, 100)], 400, 18000, 3),
  sw("Sysko", "sw-32c", "Nexxus 9336C-FX2", 2017, ports(32, 100), 450, 20000, 3),
  sw("Sysko", "sw-32d", "Nexxus 9364D-GX2", 2022, ports(32, 400), 900, 45000, 3),
  sw("Sysko", "sw-32e", "Nexxus 9808", 2027, ports(32, 800), 1400, 60000, 3),
  sw("Junipurr", "ex4200-48t", "EX4200-48T", 2008, copper(48, 2), 190, 6500, 3),
  sw("Junipurr", "ex2200-24t", "EX2200-24T", 2010, copper(24, 4, 1), 40, 1200),
  sw("Junipurr", "ex2200-48t", "EX2200-48T", 2010, copper(48, 4, 1), 60, 2200),
  sw("Junipurr", "ex3300-48t", "EX3300-48T", 2011, copper(48, 4), 90, 4000, 3),
  sw("Junipurr", "ex4300-48t", "EX4300-48T", 2013, copper(48, 4, 40), 150, 7000, 3),
  sw("Junipurr", "qfx5100-48s", "QFX5100-48S", 2014, [...ports(48, 10), ...ports(6, 40)], 300, 15000, 3),
  sw("Junipurr", "ex2300-24t", "EX2300-24T", 2016, copper(24, 4), 40, 1400),
  sw("Junipurr", "ex2300-48t", "EX2300-48T", 2016, copper(48, 4), 60, 2500),
  sw("Junipurr", "qfx5200-32c", "QFX5200-32C", 2016, ports(32, 100), 500, 24000, 3),
  sw("Junipurr", "qfx5120-48y", "QFX5120-48Y", 2018, [...ports(48, 25), ...ports(8, 100)], 400, 20000, 3),
  sw("Junipurr", "qfx5220-32cd", "QFX5220-32CD", 2019, ports(32, 400), 900, 50000, 3),
  sw("Junipurr", "ex4100-24t", "EX4100-24T", 2022, copper(24, 4, 25), 60, 3200, 3),
  sw("Junipurr", "ex4100-48t", "EX4100-48T", 2022, copper(48, 4, 25), 90, 5200, 3),
  sw("Junipurr", "qfx5240", "QFX5240-64OD", 2024, ports(32, 800), 1400, 65000, 3),
  sw("Aristotle", "ar-7048t", "7048T-A", 2009, copper(48, 4), 120, 5000, 3),
  sw("Aristotle", "ar-7050s", "7050S-64", 2011, [...ports(48, 10), ...ports(4, 40)], 240, 9000, 3),
  sw("Aristotle", "ar-7010t", "7010T-48", 2013, copper(48, 4), 50, 3000, 3),
  sw("Aristotle", "ar-7050sx", "7050SX-72", 2013, [...ports(48, 10), ...ports(6, 40)], 200, 10000, 3),
  sw("Aristotle", "ar-7050tx", "7050TX-48", 2014, [...ports(48, 10, "rj45"), ...ports(4, 40)], 280, 9000, 3),
  sw("Aristotle", "ar-7060cx", "7060CX-32S", 2016, ports(32, 100), 400, 17000, 3),
  sw("Aristotle", "ar-7020tr", "7020TR-48", 2017, copper(48, 6), 60, 3200, 3),
  sw("Aristotle", "ar-7050sx3", "7050SX3-48YC8", 2018, [...ports(48, 25), ...ports(8, 100)], 350, 15000, 3),
  sw("Aristotle", "ar-7060dx4", "7060DX4-32", 2020, ports(32, 400), 800, 38000, 3),
  sw("Aristotle", "ar-7060x6", "7060X6-64PE", 2024, ports(32, 800), 1300, 52000, 3),
  sw("Hewlett-Packet", "hp-1800-8g", "ProCurvy 1800-8G", 2006, ports(8, 1), 8, 150),
  sw("Hewlett-Packet", "hp-2510-24", "ProCurvy 2510-24", 2007, copper(24, 2, 1), 30, 700),
  sw("Hewlett-Packet", "hp-2810-48g", "ProCurvy 2810-48G", 2008, copper(48, 4, 1), 60, 2000),
  sw("Hewlett-Packet", "hp-2920-48g", "ProCurvy 2920-48G", 2013, copper(48, 4), 70, 2600, 3),
  sw("Hewlett-Packet", "hp-2930f-24g", "Arugula 2930F-24G", 2016, copper(24, 4), 40, 1500, 3),
  sw("Hewlett-Packet", "hp-2930f-48g", "Arugula 2930F-48G", 2016, copper(48, 4), 65, 2700, 3),
  sw("Hewlett-Packet", "hp-8325-48y8c", "Arugula 8325-48Y8C", 2019, [...ports(48, 25), ...ports(8, 100)], 400, 22000, 3),
  sw("Hewlett-Packet", "hp-6300m-48g", "Arugula 6300M-48G", 2020, copper(48, 4, 25), 100, 5000, 3),
  sw("Hewlett-Packet", "hp-6100-24g", "Arugula 6100-24G", 2021, copper(24, 4), 35, 1100),
  sw("MicroTick", "mt-crs326-24g", "CRS326-24G-2S+", 2017, copper(24, 2), 20, 200),
  sw("MicroTick", "mt-crs317", "CRS317-16S+", 2017, ports(16, 10), 45, 400),
  sw("MicroTick", "mt-crs309", "CRS309-1G-8S+", 2018, ports(8, 10), 20, 250),
  sw("MicroTick", "mt-crs354", "CRS354-48G-4S+2Q+", 2019, [...copper(48, 4), ...ports(2, 40)], 60, 450),
  sw("MicroTick", "mt-crs326-24s", "CRS326-24S+2Q+", 2019, [...ports(24, 10), ...ports(2, 40)], 40, 500),
  sw("MicroTick", "mt-crs504", "CRS504-4XQ", 2021, ports(4, 100), 50, 650),
  sw("MicroTick", "mt-crs310-8g", "CRS310-8G+2S+", 2022, copper(8, 2), 15, 200),
  sw("MicroTick", "mt-crs518", "CRS518-16XS-2XQ", 2022, [...ports(16, 25), ...ports(2, 100)], 60, 1300),
  sw("Nettgear", "ng-gs108t", "ProSafe GS108T", 2005, ports(8, 1), 6, 60),
  sw("Nettgear", "ng-gs724t", "ProSafe GS724T", 2006, copper(24, 2, 1), 25, 250),
  sw("Nettgear", "ng-gs748t", "ProSafe GS748T", 2007, copper(48, 4, 1), 45, 500),
  sw("Nettgear", "ng-gs108tv2", "ProSafe GS108Tv2", 2011, ports(8, 1), 5, 65),
  sw("Nettgear", "ng-m4300-48x", "M4300-48X", 2016, [...ports(48, 10, "rj45"), ...ports(4, 10)], 150, 4500, 3),
  sw("Nettgear", "ng-gs308t", "GS308T", 2019, ports(8, 1), 5, 70),
  sw("Nettgear", "ng-gs724tp", "GS724Tv4", 2020, copper(24, 2, 1), 22, 230),
  sw("Nettgear", "ng-m4350-48g", "M4350-48G", 2023, copper(48, 4, 25), 80, 2800, 3),
  sw("Ubiquitea", "ub-es-24", "EdgeSwitch 24", 2015, copper(24, 2, 1), 25, 250),
  sw("Ubiquitea", "ub-es-48", "EdgeSwitch 48", 2015, copper(48, 4, 1), 45, 450),
  sw("Ubiquitea", "ub-usw-lite-8", "UniFee USW-Lite-8", 2020, ports(8, 1), 8, 100),
  sw("Ubiquitea", "ub-usw-pro-24", "UniFee USW-Pro-24", 2020, copper(24, 2), 30, 400, 3),
  sw("Ubiquitea", "ub-usw-pro-48", "UniFee USW-Pro-48", 2020, copper(48, 4), 55, 700, 3),
  sw("Ubiquitea", "ub-usw-agg", "UniFee USW-Aggregation", 2020, ports(8, 10), 25, 250),
  sw("Ubiquitea", "ub-usw-pro-agg", "UniFee USW-Pro-Aggregation", 2022, [...ports(28, 10), ...ports(4, 25)], 60, 900, 3),
  sw("Ubiquitea", "ub-usw-ent-48", "UniFee USW-Enterprise-48", 2023, copper(48, 4), 70, 1200, 3),
  sw("D-Lunk", "dl-dgs1008d", "DGS-1008D", 2005, ports(8, 1), 5, 45),
  sw("D-Lunk", "dl-dgs1224t", "DGS-1224T", 2005, copper(24, 2, 1), 25, 220),
  sw("D-Lunk", "dl-dgs3100-48", "DGS-3100-48", 2005, copper(48, 4, 1), 50, 600),
  sw("D-Lunk", "dl-dgs1210-24", "DGS-1210-24", 2010, copper(24, 4, 1), 20, 200),
  sw("D-Lunk", "dl-dgs1210-48", "DGS-1210-48", 2012, copper(48, 4, 1), 40, 400),
  sw("D-Lunk", "dl-dgs1510-28x", "DGS-1510-28X", 2015, copper(24, 4), 30, 350),
  sw("D-Lunk", "dl-dgs1210-08", "DGS-1210-08", 2012, ports(8, 1), 5, 50),
  sw("D-Lunk", "dl-dgs1510-52x", "DGS-1510-52X", 2016, copper(48, 4), 50, 600),
];
// Parodies: PIXel, ASAP and Firepowder (PIX, ASA, Firepower), FortiGoat (FortiGate), PA, SRX, pfSinse on Netgoat boxes
// (pfSense, Netgate), SoPhosphate (Sophos). Every year sells a firewall under 1000 euro and a datacenter one.
const FIREWALLS: DeviceModel[] = [
  fw("Sysko", "pix501", "PIXel 501", 2005, ports(5, 1), 15, 450, 0.1, 0, 7500),
  fw("Sysko", "fw-1g", "ASAP 5520", 2005, ports(4, 1), 40, 1500, 1, 0.2, 280000),
  fw("Sysko", "asa5505", "ASAP 5505", 2006, ports(8, 1), 20, 600, 0.15, 0, 10000),
  fw("Sysko", "asa5510", "ASAP 5510", 2006, ports(5, 1), 30, 1200, 0.3, 0.05, 50000),
  fw("Sysko", "fw-10g", "ASAP 5585-X", 2011, [...ports(8, 1), ...ports(4, 10)], 120, 6000, 10, 2, 1000000),
  fw("Sysko", "asa5516x", "ASAP 5516-X", 2015, ports(8, 1), 40, 1800, 1.8, 0.45, 250000),
  fw("Sysko", "fw-40g", "Firepowder 4120", 2017, [...ports(8, 10), ...ports(4, 40)], 250, 18000, 40, 12, 10000000),
  fw("Sysko", "fp2130", "Firepowder 2130", 2017, [...ports(8, 1), ...ports(4, 10)], 150, 9000, 5, 2.3, 2000000),
  fw("Sysko", "fp1010", "Firepowder 1010", 2019, ports(8, 1), 20, 700, 0.65, 0.4, 100000),
  fw("Sysko", "fp1120", "Firepowder 1120", 2019, ports(12, 1), 40, 2000, 1.5, 0.65, 400000),
  fw("Sysko", "fw-100g", "Firepowder 4215", 2022, [...ports(8, 25), ...ports(4, 100)], 450, 40000, 100, 35, 30000000),
  fw("Sysko", "fp3110", "Firepowder 3110", 2022, [...ports(8, 1), ...ports(4, 25)], 120, 7000, 17, 6, 3000000),
  fw("Sysko", "fw-400g", "Firepowder 9300", 2027, [...ports(8, 100), ...ports(4, 400)], 700, 70000, 400, 150, 100000000),
  fw("Fortinope", "fg-50b", "FortiGoat 50B", 2007, ports(7, 1), 10, 400, 0.05, 0.02, 50000),
  fw("Fortinope", "fg-60c", "FortiGoat 60C", 2010, ports(10, 1), 12, 500, 1, 0.06, 100000),
  fw("Fortinope", "fg-100d", "FortiGoat 100D", 2012, ports(22, 1), 30, 1500, 2.5, 0.25, 2000000),
  fw("Fortinope", "fg-200e", "FortiGoat 200E", 2016, ports(18, 1), 35, 2200, 20, 1.2, 2000000),
  fw("Fortinope", "fg-600e", "FortiGoat 600E", 2018, [...ports(8, 1), ...ports(8, 10)], 80, 9000, 36, 7, 8000000),
  fw("Fortinope", "fg-1100e", "FortiGoat 1100E", 2019, [...ports(8, 10), ...ports(4, 25)], 150, 16000, 80, 11, 12000000),
  fw("Fortinope", "fg-40f", "FortiGoat 40F", 2020, ports(5, 1), 8, 350, 5, 1, 700000),
  fw("Fortinope", "fg-2600f", "FortiGoat 2600F", 2021, [...ports(8, 10), ...ports(4, 100)], 300, 40000, 200, 24, 24000000),
  fw("Fortinope", "fg-3700f", "FortiGoat 3700F", 2022, [...ports(8, 25), ...ports(8, 100)], 500, 70000, 600, 90, 60000000),
  fw("Fortinope", "fg-90g", "FortiGoat 90G", 2023, ports(8, 1), 15, 700, 10, 2, 1500000),
  fw("Fortinope", "fg-4800f", "FortiGoat 4800F", 2023, [...ports(8, 100), ...ports(4, 400)], 900, 150000, 1000, 150, 120000000),
  fw("Pablo Alto", "pa-500", "PA-500", 2010, ports(8, 1), 40, 2500, 0.25, 0.1, 64000),
  fw("Pablo Alto", "pa-200", "PA-200", 2011, ports(4, 1), 20, 1500, 0.1, 0.05, 64000),
  fw("Pablo Alto", "pa-3020", "PA-3020", 2012, ports(12, 1), 150, 9000, 2, 1, 250000),
  fw("Pablo Alto", "pa-7050", "PA-7050", 2013, ports(12, 10), 600, 90000, 120, 100, 24000000),
  fw("Pablo Alto", "pa-220", "PA-220", 2017, ports(8, 1), 20, 1000, 0.5, 0.15, 64000),
  fw("Pablo Alto", "pa-5220", "PA-5220", 2017, [...ports(12, 10), ...ports(4, 40)], 400, 45000, 18, 9, 4000000),
  fw("Pablo Alto", "pa-3220", "PA-3220", 2018, [...ports(12, 1), ...ports(4, 10)], 150, 12000, 2.5, 1.3, 1000000),
  fw("Pablo Alto", "pa-440", "PA-440", 2021, ports(8, 1), 25, 1500, 3, 1, 200000),
  fw("Pablo Alto", "pa-5450", "PA-5450", 2021, [...ports(8, 25), ...ports(4, 100)], 800, 120000, 120, 70, 100000000),
  fw("Pablo Alto", "pa-7500", "PA-7500", 2023, [...ports(8, 100), ...ports(4, 400)], 1500, 300000, 1500, 1000, 300000000),
  fw("Junipurr", "srx100", "SRX100", 2009, ports(8, 1), 10, 500, 0.7, 0.05, 32000),
  fw("Junipurr", "srx210", "SRX210", 2009, ports(8, 1), 15, 800, 0.85, 0.08, 64000),
  fw("Junipurr", "srx240", "SRX240", 2009, ports(16, 1), 30, 2000, 1.5, 0.25, 128000),
  fw("Junipurr", "srx650", "SRX650", 2009, ports(8, 1), 100, 6000, 7, 0.9, 512000),
  fw("Junipurr", "srx5400", "SRX5400", 2011, ports(16, 10), 800, 80000, 240, 60, 20000000),
  fw("Junipurr", "srx300", "SRX300", 2016, ports(8, 1), 15, 700, 1, 0.3, 64000),
  fw("Junipurr", "srx345", "SRX345", 2016, ports(16, 1), 25, 1800, 5, 0.8, 375000),
  fw("Junipurr", "srx1500", "SRX1500", 2016, [...ports(12, 1), ...ports(4, 10)], 150, 9000, 9, 3, 2000000),
  fw("Junipurr", "srx4100", "SRX4100", 2016, ports(8, 10), 200, 15000, 20, 8, 4000000),
  fw("Junipurr", "srx4600", "SRX4600", 2017, [...ports(8, 10), ...ports(4, 40)], 300, 30000, 80, 20, 10000000),
  fw("Netgoat", "nt-sg2440", "pfSinse SG-2440", 2015, ports(4, 1), 10, 450, 1, 0, 500000),
  fw("Netgoat", "nt-sg4860", "pfSinse SG-4860", 2015, ports(6, 1), 20, 800, 2, 0, 2000000),
  fw("Netgoat", "nt-1100", "pfSinse 1100", 2018, ports(3, 1), 5, 200, 0.5, 0, 100000),
  fw("Netgoat", "nt-xg7100", "pfSinse XG-7100", 2018, [...ports(8, 1), ...ports(2, 10)], 30, 1200, 10, 2, 4000000),
  fw("Netgoat", "nt-6100", "pfSinse 6100", 2021, [...ports(4, 1), ...ports(4, 10)], 25, 800, 10, 3, 2000000),
  fw("Netgoat", "nt-8200", "pfSinse 8200", 2023, [...ports(4, 1), ...ports(4, 25)], 40, 1500, 25, 8, 10000000),
  fw("SoPhosphate", "sp-utm220", "UTM 220", 2011, ports(8, 1), 30, 1500, 1.5, 0.3, 500000),
  fw("SoPhosphate", "sp-xg125", "XG 125", 2016, ports(8, 1), 20, 900, 6, 1.5, 1000000),
  fw("SoPhosphate", "sp-xg450", "XG 450", 2016, [...ports(8, 1), ...ports(4, 10)], 100, 7000, 50, 8, 8000000),
  fw("SoPhosphate", "sp-xgs87", "XGS 87", 2021, ports(4, 1), 8, 400, 3, 0.5, 300000),
  fw("SoPhosphate", "sp-xgs2300", "XGS 2300", 2021, [...ports(8, 1), ...ports(2, 10)], 40, 2500, 25, 4, 3000000),
  fw("SoPhosphate", "sp-xgs4500", "XGS 4500", 2021, [...ports(8, 1), ...ports(8, 10)], 90, 7000, 70, 15, 10000000),
];
const NETWORK: DeviceModel[] = [...SWITCHES, ...FIREWALLS];

export const MODELS: DeviceModel[] = [
  ...SERVERS,
  ...TWINS,
  ...NETWORK,
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
  // Every size of every memory and drive family on sale, and the cards of every line.
  for (const kind of ["ram", "hdd", "ssd", "nvme"] as const) for (const f of familiesOn(kind, year)) for (const gb of familySizes(f, year)) add({ kind, size: gb, ...(isRamFamily(f) ? {} : { ff: f.ff }), sku: f.id });
  for (const c of gpuOffers(year)) add({ kind: "gpu", size: c.year, sku: c.id });
  const maker = (p: PartSpec) => (p.vendor ? VENDORS.indexOf(p.vendor) : p.sku ? PART_MAKERS.findIndex((m) => p.sku!.startsWith(`${m.id}-`)) : -1);
  return out.sort((a, b) => COMPONENT_KINDS.indexOf(a.kind) - COMPONENT_KINDS.indexOf(b.kind) || maker(a) - maker(b) || (a.size ?? 0) - (b.size ?? 0));
}
