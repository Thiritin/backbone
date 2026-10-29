import type { Product } from "../30-customers/customers";
import type { Resources } from "./products";

// Values from docs/design/economy.md, section "Platforms and licenses". EU competition rules make Pear offer four of each.
export type SoftwareKind = "panel" | "cloud" | "game" | "mail" | "dns" | "vpn" | "storage";
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
  // Whether virtual machines move between nodes without downtime.
  live: boolean;
  // Whether a guest gets a fraction of a core (containers, CPU limits); otherwise a VM books its vCPUs rounded up to whole ones.
  split: boolean;
  // First year the hypervisor balloons guest RAM, so a VM grows RAM live; null never.
  balloon: number | null;
  // What the platform's management services take on the control-plane node.
  controlPlane: Resources;
  // Game hours an install, or a change to this software, keeps the cluster's control plane busy.
  installHours: number;
  // First year the software exists; it cannot be installed before. Installs made earlier keep running.
  from: number;
  // Years from which the software imports a web space from the same software (same) and from another panel (other); null never.
  migration: { same: number | null; other: number | null };
  // Year from which a panel runs on more than one server; null never.
  cluster: number | null;
  // Year from which the software updates itself overnight when the player turns it on; null never. The hypervisors follow
  // HyperVee's cluster-aware updating (2012) and VMwhere's lifecycle manager (2020).
  autoUpdate: number | null;
}

export const SOFTWARE: Software[] = [
  { id: "cpanic", kind: "panel", name: "cPanic", console: "cPanic", pricing: "account", fee: 0.4, tickets: 0.8, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: 2005, other: 2012 }, cluster: null, autoUpdate: 2008 },
  { id: "pleskit", kind: "panel", name: "Pleskit", console: "Pleskit", pricing: "server", fee: 12, tickets: 0.9, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: 2005, other: 2015 }, cluster: null, autoUpdate: 2014 },
  { id: "directadmen", kind: "panel", name: "DirectAdmen", console: "DirectAdmen", pricing: "server", fee: 4, tickets: 1.2, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: 2010, other: null }, cluster: null, autoUpdate: 2019 },
  { id: "freepanel", kind: "panel", name: "FreePanel", console: "FreePanel", pricing: "free", fee: 0, tickets: 1.5, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: 2009, autoUpdate: null },
  { id: "openveezee", kind: "cloud", name: "OpenVeeZee", console: "OpenVeeZee Web Panel", pricing: "free", fee: 0, tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 3, from: 2005, migration: { same: 2005, other: null }, cluster: null, autoUpdate: null },
  { id: "openstash", kind: "cloud", name: "OpenStash", console: "OpenStash Horizont", pricing: "free", fee: 0, tickets: 1.3, live: true, split: false, balloon: null, controlPlane: { vcpu: 2, ramGb: 2, diskGb: 20 }, installHours: 8, from: 2010, migration: { same: 2010, other: null }, cluster: 2010, autoUpdate: null },
  { id: "vmwhere", kind: "cloud", name: "VMwhere", console: "VMwhere vSphear", pricing: "core", fee: 8, tickets: 0.7, live: true, split: false, balloon: 2005, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 10 }, installHours: 5, from: 2005, migration: { same: 2005, other: null }, cluster: 2005, autoUpdate: 2020 },
  { id: "proxmocks", kind: "cloud", name: "Proxmocks", console: "Proxmocks VE", pricing: "free", fee: 0, tickets: 1, live: true, split: true, balloon: 2005, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2008, migration: { same: 2008, other: null }, cluster: 2008, autoUpdate: null },
  { id: "hypervee", kind: "cloud", name: "HyperVee", console: "HyperVee Manager", pricing: "server", fee: 20, tickets: 0.9, live: false, split: false, balloon: 2012, controlPlane: { vcpu: 1, ramGb: 1, diskGb: 10 }, installHours: 4, from: 2008, migration: { same: 2008, other: null }, cluster: 2012, autoUpdate: 2012 },
  // Game server panels: containers for game servers on a server or VM; a license per game is not modelled yet.
  { id: "tcadmen", kind: "game", name: "TCAdmen", console: "TCAdmen", pricing: "server", fee: 25, tickets: 0.9, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "multikraft", kind: "game", name: "MultiKraft", console: "MultiKraft", pricing: "server", fee: 20, tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2010, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "pterodaktyl", kind: "game", name: "Pterodaktyl", console: "Pterodaktyl", pricing: "free", fee: 0, tickets: 1.2, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 3, from: 2016, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  // Service software: DNS zones, VPN gateways and storage volumes as containers on a server or VM, like a game panel.
  { id: "bound", kind: "dns", name: "Bound", console: "Bound", pricing: "free", fee: 0, tickets: 1.3, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "powerdnz", kind: "dns", name: "PowerDNZ", console: "PowerDNZ Admin", pricing: "free", fee: 0, tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "knut", kind: "dns", name: "Knut DNS", console: "Knut DNS", pricing: "free", fee: 0, tickets: 1.1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 1, from: 2011, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "openveepeen", kind: "vpn", name: "OpenVeePeeN", console: "OpenVeePeeN Access", pricing: "free", fee: 0, tickets: 1.3, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "anyconnekt", kind: "vpn", name: "Sysko AnyConnekt", console: "Sysko AnyConnekt", pricing: "server", fee: 30, tickets: 0.7, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "wireguarded", kind: "vpn", name: "WireGuarded", console: "WireGuarded", pricing: "free", fee: 0, tickets: 0.9, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 1 }, installHours: 1, from: 2018, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "vsftpeed", kind: "storage", name: "vsFTPeed", console: "vsFTPeed", pricing: "free", fee: 0, tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 1, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "ownclod", kind: "storage", name: "OwnClod", console: "OwnClod", pricing: "free", fee: 0, tickets: 1.2, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 10 }, installHours: 2, from: 2010, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "minnio", kind: "storage", name: "MinnIO", console: "MinnIO Console", pricing: "free", fee: 0, tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 10 }, installHours: 2, from: 2016, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  // Mail servers: the company's own mail on a server or VM; the control plane is what the server takes (economy.md, Company email).
  { id: "postfixit", kind: "mail", name: "Postfixit", console: "Postfixit", pricing: "free", fee: 0, tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 20 }, installHours: 4, from: 2005 , migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "mailpig", kind: "mail", name: "Mailpig", console: "Mailpig", pricing: "free", fee: 0, tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 20 }, installHours: 2, from: 2015 , migration: { same: null, other: null }, cluster: null, autoUpdate: null },
];

// The product lines each kind of software lets a cluster sell; the rest runs on whole servers, in racks or nowhere.
export const SERVES: Record<SoftwareKind, Product[]> = {
  panel: ["webHosting"], cloud: ["vps", "gameServer", "cloud", "gpu"], game: ["gameServer"], mail: [], dns: ["dns"], vpn: ["vpn"], storage: ["storage"],
};
// Kinds that run customers' workloads as containers on one server or VM, the way a game panel does. They take the panel slot.
export const SERVICE_KINDS: SoftwareKind[] = ["game", "dns", "vpn", "storage"];
export const isService = (k: SoftwareKind): boolean => SERVICE_KINDS.includes(k);
// The order the software picker lists the kinds in.
export const KINDS: SoftwareKind[] = ["cloud", "panel", "game", "dns", "vpn", "storage", "mail"];
// Game servers also run on plain virtual machines, so a line can have more than one kind; kindServing is the general one.
export const kindsServing = (p: Product): SoftwareKind[] => (Object.keys(SERVES) as SoftwareKind[]).filter((k) => SERVES[k].includes(p));
export const kindServing = (p: Product): SoftwareKind | null => (["panel", "cloud", "dns", "vpn", "storage"] as SoftwareKind[]).find((k) => SERVES[k].includes(p)) ?? null;

// economy.md, Platforms and licenses: software in a virtual machine gets this share of the VM's CPU and RAM.
export const IN_VM = 0.95;

export const softwareById =(id: string): Software => SOFTWARE.find((x) => x.id === id) ?? SOFTWARE.find((x) => x.id === "proxmocks")!;
// Whether the target's migration tool applies to a web space coming from the source panel in that year.
export const importsFrom = (target: Software, source: string, year: number): boolean => {
  const from = source === target.id ? target.migration.same : target.migration.other;
  return from !== null && year >= from;
};
export const autoUpdates = (sw: Software, year: number): boolean => sw.autoUpdate !== null && year >= sw.autoUpdate;
export const clustersIn = (sw: Software, year: number): boolean => sw.cluster !== null && year >= sw.cluster;
// Whether the software balloons guest RAM in that year.
export const balloons = (sw: Software, year: number): boolean => sw.balloon !== null && year >= sw.balloon;
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
