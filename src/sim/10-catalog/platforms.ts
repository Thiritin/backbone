import type { Product } from "../30-customers/customers";
import type { Resources } from "./products";

// Values from docs/design/economy.md, section "Platforms and licenses". EU competition rules make Pear offer four of each.
export type SoftwareKind = "panel" | "cloud";
// free, or a monthly fee per web space (account), per node (server) or per physical core of the nodes (core).
export type Pricing = "free" | "account" | "server" | "core";
export interface Software {
  id: string;
  kind: SoftwareKind;
  name: string;
  // The management console the Virtual machines app turns into for a cloud platform.
  console: string;
  pricing: Pricing;
  // Monthly euros per unit of pricing.
  fee: number;
  // How-to ticket rate of customers on it.
  tickets: number;
  // Share of a node's bookable capacity a platform makes usable; panels leave it at 1.
  density: number;
  // Whether virtual machines move between nodes without downtime.
  live: boolean;
  // Convenience score customers give the panel when they compare hosts (economy.md, Customer choice).
  convenience: number;
  // The most vCPU per physical core and booked RAM per installed GB the software lets a node book.
  overcommit: { cpu: number; ram: number };
  // What the platform's management services take on the control-plane node.
  controlPlane: Resources;
  // Game hours an install, or a change to this software, keeps the cluster's control plane busy.
  installHours: number;
}

export const SOFTWARE: Software[] = [
  { id: "cpanic", kind: "panel", name: "cPanic", console: "cPanic", pricing: "account", fee: 0.4, tickets: 0.8, density: 1, live: true, convenience: 90, overcommit: { cpu: 8, ram: 1.5 }, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3 },
  { id: "pleskit", kind: "panel", name: "Pleskit", console: "Pleskit", pricing: "server", fee: 12, tickets: 0.9, density: 1, live: true, convenience: 80, overcommit: { cpu: 8, ram: 1.5 }, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3 },
  { id: "directadmen", kind: "panel", name: "DirectAdmen", console: "DirectAdmen", pricing: "server", fee: 4, tickets: 1.2, density: 1, live: true, convenience: 60, overcommit: { cpu: 8, ram: 1.5 }, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2 },
  { id: "freepanel", kind: "panel", name: "FreePanel", console: "FreePanel", pricing: "free", fee: 0, tickets: 1.5, density: 1, live: true, convenience: 45, overcommit: { cpu: 8, ram: 1.5 }, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2 },
  { id: "openstash", kind: "cloud", name: "OpenStash", console: "OpenStash Horizont", pricing: "free", fee: 0, tickets: 1.3, density: 1, live: true, convenience: 60, overcommit: { cpu: 4, ram: 1 }, controlPlane: { vcpu: 2, ramGb: 2, diskGb: 20 }, installHours: 8 },
  { id: "vmwhere", kind: "cloud", name: "VMwhere", console: "VMwhere vSphear", pricing: "core", fee: 8, tickets: 0.7, density: 1.15, live: true, convenience: 60, overcommit: { cpu: 10, ram: 1.25 }, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 10 }, installHours: 5 },
  { id: "proxmocks", kind: "cloud", name: "Proxmocks", console: "Proxmocks VE", pricing: "free", fee: 0, tickets: 1, density: 1, live: true, convenience: 60, overcommit: { cpu: 8, ram: 1.5 }, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3 },
  { id: "hypervee", kind: "cloud", name: "HyperVee", console: "HyperVee Manager", pricing: "server", fee: 20, tickets: 0.9, density: 1.05, live: false, convenience: 60, overcommit: { cpu: 6, ram: 1.2 }, controlPlane: { vcpu: 1, ramGb: 1, diskGb: 10 }, installHours: 4 },
];

// The product lines each kind of software lets a cluster sell; the rest runs on whole servers, in racks or nowhere.
export const SERVES: Record<SoftwareKind, Product[]> = { panel: ["webHosting"], cloud: ["vps", "gameServer", "dns", "vpn", "storage", "cloud"] };
export const kindServing = (p: Product): SoftwareKind | null => (SERVES.panel.includes(p) ? "panel" : SERVES.cloud.includes(p) ? "cloud" : null);

// economy.md, Platforms and licenses: software in a virtual machine gets this share of the VM's CPU and RAM.
export const IN_VM = 0.95;

export const softwareById =(id: string): Software => SOFTWARE.find((x) => x.id === id) ?? SOFTWARE.find((x) => x.id === "proxmocks")!;
export const softwareOf = (kind: SoftwareKind): Software[] => SOFTWARE.filter((x) => x.kind === kind);

// economy.md, PHP versions: each from 1 January after its release, when web hosts start to install it.
export const PHP: { version: string; year: number }[] = [
  { version: "4.4", year: 2005 }, { version: "5.1", year: 2006 }, { version: "5.2", year: 2007 }, { version: "5.3", year: 2010 },
  { version: "5.4", year: 2013 }, { version: "5.5", year: 2014 }, { version: "5.6", year: 2015 }, { version: "7.0", year: 2016 },
  { version: "7.1", year: 2017 }, { version: "7.2", year: 2018 }, { version: "7.3", year: 2019 }, { version: "7.4", year: 2020 },
  { version: "8.0", year: 2021 }, { version: "8.1", year: 2022 }, { version: "8.2", year: 2023 }, { version: "8.3", year: 2024 },
  { version: "8.4", year: 2025 }, { version: "8.5", year: 2026 },
];
export const phpAt = (year: number): string => [...PHP].reverse().find((p) => p.year <= year)?.version ?? PHP[0].version;
const phpIndex = (version: string) => Math.max(0, PHP.findIndex((p) => p.version === version));
// How many newer versions are out by that year.
export const phpBehind = (version: string, year: number): number => Math.max(0, phpIndex(phpAt(year)) - phpIndex(version));
export const oldestPhp = (versions: string[]): string | undefined =>
  versions.reduce<string | undefined>((a, v) => (a === undefined || phpIndex(v) < phpIndex(a) ? v : a), undefined);
