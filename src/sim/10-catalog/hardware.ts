// Values come from docs/design/economy.md (Server generations, Server lines, Manufacturers, Switches, Security appliances, Patch panels and gateways).
import { GENERATIONS } from "./economy";

export type DeviceKind = "server" | "switch" | "firewall" | "gateway" | "patch" | "ups" | "part";
export interface PortSpec { media: "rj45" | "sfp"; gbit: number }
// Form factor of a drive and of a bay group. A "nvme" bay is a 2.5" bay that takes SATA/SAS and NVMe drives; a "2.5" bay takes
// SATA/SAS only; a "3.5" bay takes 3.5" drives only.
export type FormFactor = "3.5" | "2.5" | "nvme";
export interface BayGroup { ff: FormFactor; count: number }
export interface ServerSpec {
  arch: "x86" | "arm";
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
}
// Values from economy.md (Components): life in years, yearly failure rates before and after it, part price, and when a swap
// can happen with the device running: in a RAID array, with a second working power supply, always, or never.
export type ComponentKind = "hdd" | "ssd" | "nvme" | "psu" | "fan" | "ram" | "board" | "cpu" | "nic";
export const COMPONENT_KINDS: ComponentKind[] = ["hdd", "ssd", "nvme", "psu", "fan", "ram", "board", "cpu", "nic"];
export const COMPONENTS: Record<ComponentKind, { life: number; before: number; after: number; price: number; hotSwap: "raid" | "dual" | "yes" | "no" }> = {
  hdd: { life: 5, before: 0.015, after: 0.08, price: 120, hotSwap: "raid" },
  ssd: { life: 5, before: 0.008, after: 0.04, price: 150, hotSwap: "raid" },
  nvme: { life: 5, before: 0.006, after: 0.03, price: 200, hotSwap: "raid" },
  psu: { life: 7, before: 0.01, after: 0.06, price: 150, hotSwap: "dual" },
  fan: { life: 6, before: 0.01, after: 0.07, price: 25, hotSwap: "yes" },
  ram: { life: 12, before: 0.002, after: 0.006, price: 60, hotSwap: "no" },
  board: { life: 12, before: 0.003, after: 0.01, price: 600, hotSwap: "no" },
  cpu: { life: 15, before: 0.0005, after: 0.002, price: 400, hotSwap: "no" },
  nic: { life: 10, before: 0.003, after: 0.01, price: 80, hotSwap: "no" },
};
const COMPONENT_NAMES: Record<ComponentKind, string> = {
  hdd: "HDD", ssd: "SSD", nvme: "NVMe drive", psu: "power supply", fan: "fan", ram: "RAM stick", board: "mainboard", cpu: "CPU", nic: "network card",
};
const DRIVE_KIND = { HDD: "hdd", SSD: "ssd", NVMe: "nvme" } as const;

export const bayCount = (v: ServerSpec): number => v.bays.reduce((n, b) => n + b.count, 0);
// Whether a drive of this form factor goes into a bay group.
export const bayTakes = (bay: FormFactor, drive: FormFactor): boolean => (drive === "3.5" ? bay === "3.5" : drive === "2.5" ? bay !== "3.5" : bay === "nvme");
// The form factor of the drives a server ships with.
const presetFf = (v: ServerSpec): FormFactor => (v.disk === "NVMe" ? "nvme" : v.bays[0].ff === "3.5" ? "3.5" : "2.5");

// A part of a model as it ships: size in GB for RAM sticks and drives, in cores for CPUs.
export interface PartSpec { kind: ComponentKind; size?: number; ff?: FormFactor }

// The parts a model is built from: drives, power supplies, fans, RAM, board, CPUs and a NIC for a server;
// power supplies, 2 fans and a board for a switch or firewall; nothing for patch panels, gateways and parts.
export function componentParts(m: DeviceModel): PartSpec[] {
  const n = (k: ComponentKind, count: number, size?: (i: number) => number, ff?: FormFactor): PartSpec[] =>
    Array.from({ length: count }, (_, i) => ({ kind: k, ...(size ? { size: size(i) } : {}), ...(ff ? { ff } : {}) }));
  if (m.server) {
    const v = m.server;
    // The first (cores mod sockets) CPUs carry the odd core.
    const cpu = (i: number) => Math.floor(v.cores / v.sockets) + (i < v.cores % v.sockets ? 1 : 0);
    return [
      ...n(DRIVE_KIND[v.disk], v.drives, () => v.diskGb / v.drives, presetFf(v)), ...n("psu", m.psus), ...n("fan", 4),
      ...n("ram", v.ramSticks, () => v.ramGb / v.ramSticks), ...n("board", 1), ...n("cpu", v.sockets, cpu), ...n("nic", 1),
    ];
  }
  if (m.kind === "switch" || m.kind === "firewall") return [...n("psu", m.psus), ...n("fan", 2), ...n("board", 1)];
  return [];
}
export const componentKinds = (m: DeviceModel): ComponentKind[] => componentParts(m).map((p) => p.kind);

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
  until: number | null;
  server?: ServerSpec;
  layer?: 2 | 3;
  // Firewalls cap every link through them at this speed.
  throughputGbit?: number;
  // A UPS carries its location through a grid outage for batteryWh ÷ load.
  batteryWh?: number;
}

// Within a class, manufacturers differ in price and failure rate, never in specs.
export interface Manufacturer { id: string; name: string; kinds: DeviceKind[]; priceFactor: number; failureFactor: number }
export const MANUFACTURERS: Manufacturer[] = [
  { id: "dwell", name: "Dwell", kinds: ["server"], priceFactor: 1, failureFactor: 1 },
  { id: "hewlett-packet", name: "Hewlett-Packet", kinds: ["server"], priceFactor: 1.08, failureFactor: 0.8 },
  { id: "supermacro", name: "SuperMacro", kinds: ["server"], priceFactor: 0.9, failureFactor: 1.3 },
  { id: "lenovoid", name: "Lenovoid", kinds: ["server"], priceFactor: 0.95, failureFactor: 1.1 },
  { id: "sysko", name: "Sysko", kinds: ["switch", "firewall", "gateway"], priceFactor: 1, failureFactor: 1 },
  { id: "junipurr", name: "Junipurr", kinds: ["switch"], priceFactor: 1.1, failureFactor: 0.7 },
  { id: "aristotle", name: "Aristotle", kinds: ["switch"], priceFactor: 0.93, failureFactor: 1.2 },
  { id: "fortinope", name: "Fortinope", kinds: ["firewall"], priceFactor: 0.9, failureFactor: 1.25 },
  { id: "pablo-alto", name: "Pablo Alto", kinds: ["firewall"], priceFactor: 1.1, failureFactor: 0.75 },
  { id: "pandoot", name: "Pandoot", kinds: ["patch"], priceFactor: 1, failureFactor: 1 },
  { id: "eatin", name: "Eatin", kinds: ["ups"], priceFactor: 1, failureFactor: 1 },
  { id: "generic", name: "Generic", kinds: ["part"], priceFactor: 1, failureFactor: 1 },
];
export const brandsFor = (kind: DeviceKind): string[] => MANUFACTURERS.filter((m) => m.kinds.includes(kind)).map((m) => m.name);
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
const BAYS_3_5 = (count: number) => (): BayGroup[] => [{ ff: "3.5", count }];
// The storage line ships NVMe drives from G6; those need NVMe-capable bays.
const BAYS_STORAGE = (i: number): BayGroup[] => [{ ff: i >= 5 ? "nvme" : "3.5", count: 12 }];
const SERVER_LINES = [
  { id: "compute", name: "Balanced 1U", arch: "x86", height: 1, sockets: 2, cores: 1, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 1, price: 1, from: 2005 },
  { id: "compute-2psu", name: "Balanced 1U, 2 PSU", arch: "x86", height: 1, sockets: 2, cores: 1, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 2, gpus: 0, watts: 1.05, price: 1.1, from: 2005 },
  { id: "dense", name: "Compute-dense 1U", arch: "x86", height: 1, sockets: 2, cores: 2, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 1.5, price: 1.6, from: 2005 },
  { id: "memory", name: "Memory-optimized 2U", arch: "x86", height: 2, sockets: 2, cores: 1, ram: 4, bays: BAYS_8, dimms: [16, 24, 32, 48], pcie: 4, drives: 1, disk: "gen", ports: 4, psus: 2, gpus: 0, watts: 1.6, price: 1.8, from: 2005 },
  { id: "storage", name: "Storage 2U", arch: "x86", height: 2, sockets: 2, cores: 1, ram: 1, bays: BAYS_STORAGE, dimms: [8, 12, 16, 24], pcie: 4, drives: 12, disk: "gen", ports: 2, psus: 2, gpus: 0, watts: 1.7, price: 2, from: 2005 },
  { id: "backup", name: "Backup storage 4U", arch: "x86", height: 4, sockets: 1, cores: 0.5, ram: 0.5, bays: BAYS_3_5(36), dimms: [8, 12, 16, 24], pcie: 4, drives: 36, disk: "large", ports: 2, psus: 2, gpus: 0, watts: 2, price: 2.4, from: 2005 },
  { id: "archive", name: "Archive storage 4U", arch: "x86", height: 4, sockets: 1, cores: 0.25, ram: 0.25, bays: BAYS_3_5(60), dimms: [8, 8, 16, 16], pcie: 2, drives: 60, disk: "dense", ports: 2, psus: 2, gpus: 0, watts: 2.2, price: 3.2, from: 2005 },
  { id: "gpu", name: "GPU 4U", arch: "x86", height: 4, sockets: 2, cores: 1, ram: 2, bays: BAYS_8, dimms: [16, 24, 32, 48], pcie: 8, drives: 1, disk: "gen", ports: 2, psus: 2, gpus: 4, watts: 5, price: 6, from: 2016 },
  { id: "arm", name: "ARM 1U", arch: "arm", height: 1, sockets: 1, cores: 1.5, ram: 1, bays: BAYS_SMALL, dimms: [8, 12, 16, 32], pcie: 2, drives: 1, disk: "gen", ports: 2, psus: 1, gpus: 0, watts: 0.6, price: 0.9, from: 2020 },
] as const;

// A generation stays in the shop until the one two steps newer arrives.
const SERVERS: DeviceModel[] = GENERATIONS.flatMap((g, i) =>
  SERVER_LINES.filter((v) => v.from <= g.year).map((v) => {
    const driveGb = v.disk === "large" ? LARGE_HDD_GB[i] : v.disk === "dense" ? DENSE_HDD_GB[i] : g.diskGb;
    const ramGb = g.ramGb * v.ram, dimmSlots = v.dimms[Math.floor(i / 2)];
    // Sticks double in size until they fit the slots (the memory line outgrows the generation's standard stick).
    let stickGb = RAM_STICK_GB[i];
    while (ramGb / stickGb > dimmSlots) stickGb *= 2;
    return {
      id: `g${i + 1}-${v.id}`,
      name: `${v.name} G${i + 1}`,
      kind: "server" as const,
      height: v.height,
      ports: ports(v.ports, portGbit(g.year)),
      watts: Math.round(g.watts * v.watts),
      idleWatts: Math.round(g.watts * v.watts * 0.4),
      psus: v.psus,
      price: Math.round(g.price * v.price),
      from: g.year,
      until: GENERATIONS[i + 2] ? GENERATIONS[i + 2].year - 1 : null,
      server: {
        arch: v.arch, sockets: v.sockets, cores: Math.round(g.cores * v.cores), ramGb, maxRamGb: 2 * ramGb,
        dimmSlots, bays: v.bays(i), pcie: v.pcie, psuBays: 2, diskGb: driveGb * v.drives, disk: v.disk === "gen" ? g.disk : "HDD", gpus: v.gpus,
        drives: v.drives, ramSticks: Math.max(1, Math.round(ramGb / stickGb)),
      },
    };
  }),
);

type Extra = Partial<Pick<DeviceModel, "layer" | "throughputGbit" | "batteryWh">>;
const other = (id: string, name: string, kind: DeviceKind, height: number, p: PortSpec[], watts: number, price: number, from = 2005, extra: Extra = {}): DeviceModel =>
  ({ id, name, kind, height, ports: p, watts, idleWatts: watts, psus: 1, price, from, until: null, ...extra });
const L2 = { layer: 2 } as const, L3 = { layer: 3 } as const;

export const MODELS: DeviceModel[] = [
  ...SERVERS,
  other("sw-8", "L2 switch 8", "switch", 1, ports(8, 1), 8, 60, 2005, L2),
  other("sw-24", "L2 switch 24", "switch", 1, [...ports(24, 1), ...ports(2, 1, "sfp")], 40, 900, 2005, L2),
  other("sw-48", "L2 switch 48", "switch", 1, [...ports(48, 1), ...ports(4, 10)], 70, 2800, 2008, L2),
  other("sw-48x", "L2 switch 48 SFP", "switch", 1, ports(48, 10), 200, 8000, 2011, L2),
  other("sw-48-l3", "L3 switch 48", "switch", 1, [...ports(48, 1), ...ports(4, 10)], 110, 5500, 2008, L3),
  other("sw-48q", "L3 switch 48 SFP, 40G", "switch", 1, [...ports(48, 10), ...ports(6, 40)], 280, 14000, 2014, L3),
  other("sw-48y", "L3 switch 48 SFP, 100G", "switch", 1, [...ports(48, 25), ...ports(8, 100)], 400, 18000, 2017, L3),
  other("sw-32c", "L3 spine 32 × 100G", "switch", 1, ports(32, 100), 450, 20000, 2017, L3),
  other("sw-32d", "L3 spine 32 × 400G", "switch", 1, ports(32, 400), 900, 45000, 2022, L3),
  other("fw-1g", "Firewall 1G", "firewall", 1, ports(4, 1), 40, 1500, 2005, { throughputGbit: 1 }),
  other("fw-10g", "Firewall 10G", "firewall", 1, [...ports(8, 1), ...ports(4, 10)], 120, 6000, 2011, { throughputGbit: 10 }),
  other("fw-40g", "Firewall 40G", "firewall", 1, [...ports(8, 10), ...ports(4, 40)], 250, 18000, 2017, { throughputGbit: 40 }),
  other("fw-100g", "Firewall 100G", "firewall", 1, [...ports(8, 25), ...ports(4, 100)], 450, 40000, 2022, { throughputGbit: 100 }),
  // The first half of the ports are the front jacks, the second half the back; front i is wired to back jacks + i.
  other("patch-24", "Patch panel 24, copper", "patch", 1, ports(48, 1), 0, 80),
  other("patch-24f", "Patch panel 24, fiber", "patch", 1, ports(48, 400, "sfp"), 0, 250),
  other("patch-48", "Patch panel 48, copper", "patch", 1, ports(96, 1), 0, 140),
  other("patch-48f", "Patch panel 48, fiber", "patch", 1, ports(96, 400, "sfp"), 0, 450),
  // Edge routers mount in a rack; every uplink link takes one of their ports.
  other("edge-s", "Edge router S", "gateway", 1, ports(4, 1), 100, 3000, 2005),
  other("edge-m", "Edge router M", "gateway", 1, [...ports(8, 10), ...ports(4, 1)], 200, 12000, 2008),
  other("edge-l", "Edge router L", "gateway", 2, ports(32, 100), 600, 40000, 2014),
  other("edge-xl", "Edge router XL", "gateway", 2, ports(36, 400), 900, 90000, 2021),
  // economy.md, Power outages: the small UPS carries a 0.2 kW basement rack for about 3 hours.
  other("ups-1500", "UPS 1500 VA", "ups", 1, [], 10, 180, 2005, { batteryWh: 600 }),
  // Price 0 keeps gateways out of the shop; they come with the basement and with every datacenter location.
  other("home-router", "Home router", "gateway", 0, ports(4, 1), 10, 0),
  other("handoff", "Datacenter handoff", "gateway", 0, ports(2, 1), 0, 0),
  ...COMPONENT_KINDS.map((k) => other(`part-${k}`, `Spare ${COMPONENT_NAMES[k]}`, "part", 0, [], 0, COMPONENTS[k].price)),
];
// Model ids from older saves.
export const RENAMED_MODELS: Record<string, string> = Object.fromEntries(GENERATIONS.flatMap((_, i) => [
  [`g${i + 1}-compute-1s`, `g${i + 1}-compute`],
  [`g${i + 1}-highmem`, `g${i + 1}-memory`],
]));
export const jacksOf = (m: DeviceModel): number => m.ports.length / 2;
// Jacks on a 24-port panel; use jacksOf for the 48-port panels.
export const PATCH_JACKS = 24;
export const modelById = (id: string): DeviceModel => {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown model ${id}`);
  return m;
};
// The same server with its second power supply bay filled, for models sold in both builds.
export const dualPsuModel = (id: string): DeviceModel | undefined => MODELS.find((x) => x.id === `${id}-2psu`);
export const manufacturerByName = (name: string): Manufacturer | undefined => MANUFACTURERS.find((m) => m.name === name);
// What a unit of this model costs from this manufacturer.
export const priceOf = (model: DeviceModel, brand: string): number => Math.round(model.price * (manufacturerByName(brand)?.priceFactor ?? 1));
export const shopModels = (year: number): DeviceModel[] => MODELS.filter((m) => m.from <= year && (m.until === null || year <= m.until) && m.price > 0);
