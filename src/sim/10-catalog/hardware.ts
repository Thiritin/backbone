// Values come from docs/design/economy.md (Server generations, Server models, Switches and gateways).
import { GENERATIONS } from "./economy";

export type DeviceKind = "server" | "switch" | "gateway" | "patch";
export interface PortSpec { media: "rj45" | "sfp"; gbit: number }
export interface ServerSpec {
  arch: "x86" | "arm";
  sockets: number;
  cores: number;
  ramGb: number;
  maxRamGb: number;
  bays: number;
  diskGb: number;
  disk: "HDD" | "SSD" | "NVMe";
}
export interface DeviceModel {
  id: string;
  name: string;
  kind: DeviceKind;
  // Rack units; gateways are 0 and live on a carrier panel.
  height: number;
  ports: PortSpec[];
  watts: number;
  idleWatts: number;
  psus: 1 | 2;
  price: number;
  from: number;
  until: number | null;
  server?: ServerSpec;
}

export const SERVER_BRANDS = ["Dwell", "Hewlett-Packet", "SuperMacro"] as const;
export const SWITCH_BRAND = "Sysko";

const portGbit = (year: number): number => (year >= 2023 ? 100 : year >= 2017 ? 25 : year >= 2011 ? 10 : 1);
const ports = (n: number, gbit: number, media: PortSpec["media"] = gbit === 1 ? "rj45" : "sfp"): PortSpec[] =>
  Array.from({ length: n }, () => ({ media, gbit }));

// Multipliers on the generation row; drives is how many bays ship filled.
const SERVER_VARIANTS = [
  { id: "compute", name: "Compute 1U", arch: "x86", height: 1, sockets: 2, cores: 1, ram: 1, bays: 4, drives: 1, ports: 2, psus: 1, watts: 1, price: 1, from: 2005 },
  { id: "compute-2psu", name: "Compute 1U, 2 PSU", arch: "x86", height: 1, sockets: 2, cores: 1, ram: 1, bays: 4, drives: 1, ports: 2, psus: 2, watts: 1.05, price: 1.1, from: 2005 },
  { id: "compute-1s", name: "Compute 1U, one socket", arch: "x86", height: 1, sockets: 1, cores: 0.5, ram: 0.5, bays: 4, drives: 1, ports: 2, psus: 1, watts: 0.6, price: 0.65, from: 2005 },
  { id: "highmem", name: "High-memory 2U", arch: "x86", height: 2, sockets: 2, cores: 1, ram: 4, bays: 8, drives: 1, ports: 4, psus: 2, watts: 1.4, price: 2.2, from: 2008 },
  { id: "storage", name: "Storage 2U", arch: "x86", height: 2, sockets: 1, cores: 0.5, ram: 0.5, bays: 12, drives: 6, ports: 2, psus: 2, watts: 1.2, price: 1.5, from: 2005 },
  { id: "arm", name: "ARM 1U", arch: "arm", height: 1, sockets: 1, cores: 1.5, ram: 1, bays: 4, drives: 1, ports: 2, psus: 1, watts: 0.6, price: 0.9, from: 2020 },
] as const;

// A generation stays in the shop until the one two steps newer arrives.
const SERVERS: DeviceModel[] = GENERATIONS.flatMap((g, i) =>
  SERVER_VARIANTS.filter((v) => v.from <= g.year).map((v) => ({
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
      arch: v.arch, sockets: v.sockets, cores: Math.round(g.cores * v.cores), ramGb: g.ramGb * v.ram, maxRamGb: 2 * g.ramGb * v.ram,
      bays: v.bays, diskGb: g.diskGb * v.drives, disk: g.disk,
    },
  })),
);

const other = (id: string, name: string, kind: DeviceKind, height: number, p: PortSpec[], watts: number, price: number, from = 2005): DeviceModel =>
  ({ id, name, kind, height, ports: p, watts, idleWatts: watts, psus: 1, price, from, until: null });

export const MODELS: DeviceModel[] = [
  ...SERVERS,
  other("sw-8", "Sysko SG8", "switch", 1, ports(8, 1), 8, 60),
  other("sw-24", "Sysko 2924", "switch", 1, [...ports(24, 1), ...ports(2, 1, "sfp")], 40, 900),
  other("sw-48", "Sysko 2948", "switch", 1, [...ports(48, 1), ...ports(4, 10)], 70, 2800, 2008),
  other("sw-48x", "Sysko 4948X", "switch", 1, ports(48, 10), 200, 8000, 2011),
  other("sw-48y", "Sysko 9348Y", "switch", 1, [...ports(48, 25), ...ports(4, 10), ...ports(4, 100)], 350, 12000, 2017),
  other("sw-32c", "Sysko 9332C", "switch", 1, ports(32, 100), 450, 20000, 2023),
  // Ports 0-23 are the front jacks, 24-47 the back; front i is wired to back 24 + i.
  other("patch-24", "Patch panel 24, copper", "patch", 1, ports(48, 1), 0, 80),
  other("patch-24f", "Patch panel 24, fiber", "patch", 1, ports(48, 100, "sfp"), 0, 250),
  // Price 0 keeps gateways out of the shop; they come with the basement and with every datacenter location.
  other("home-router", "Home router", "gateway", 0, ports(4, 1), 10, 0),
  other("handoff", "Datacenter handoff", "gateway", 0, ports(2, 1), 0, 0),
];
export const PATCH_JACKS = 24;
export const modelById = (id: string): DeviceModel => {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown model ${id}`);
  return m;
};
export const shopModels = (year: number): DeviceModel[] => MODELS.filter((m) => m.from <= year && (m.until === null || year <= m.until) && m.price > 0);
