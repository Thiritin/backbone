import type { Product } from "../30-customers/customers";
import type { Resources } from "./products";
import type { LicenseEra, ServerOsId } from "./server-os";
import { SITES, type Site } from "./sites";

// Values from docs/design/economy.md, section "Platforms and licenses". EU competition rules make Pear offer four of each.
export type SoftwareKind = "panel" | "cloud" | "game" | "mail" | "dns" | "vpn" | "storage" | "backup";
export interface Software {
  id: string;
  kind: SoftwareKind;
  name: string;
  // The management console the Virtual machines app turns into for a cloud platform.
  console: string;
  // Euros per unit of the era's kind.
  licensing: LicenseEra[];
  // Days a fresh install runs without a key; null when a key is needed at install. Missing on free software.
  trialDays?: number | null;
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
  // The edition or add-on that spreads VMs over the nodes by load, in euros per node a month (0 when included) from its
  // year; null when the hypervisor never balances.
  balancer?: { name: string; fee: number; from: number };
  // Shared datastores (economy.md, Datastores): VMs move live only off a datastore until the shared-nothing year, and
  // failover restarts only VMs on one.
  datastores?: { sharedNothing: number };
  // Snapshots (checkpoints): up to SNAPSHOTS_MAX per VM, on a hypervisor that sets this flag.
  snapshots?: true;
  // Backup software: the source software whose clusters it backs up, each from that year.
  backs?: Record<string, number>;
  // The skill the team needs before it can install the software.
  skill?: string;
  // docs/design/software.md, section 2: the operating systems it installs on, the first one taken by a machine without one.
  os: ServerOsId[];
  // TCP ports it binds; two software sharing one cannot be on one machine.
  ports: number[];
  exclusive?: "hypervisor";
  // How it gets onto Lunix: commands is what its website prints and the console accepts, in order; with apt,
  // apt-get install of package counts as the install. gui installs from the Windoors desktop, as everything does there.
  install: { kind: "apt" | "script" | "gui"; package?: string; commands: string[] };
  site: Site;
}
type MachineFields = "os" | "ports" | "exclusive" | "install" | "site";

const apt = (pkg: string, ...before: string[]): Software["install"] => ({ kind: "apt", package: pkg, commands: [...before, `apt-get install -y ${pkg}`] });
const script = (line: string): Software["install"] => ({ kind: "script", commands: [line] });
const GUI: Software["install"] = { kind: "gui", commands: [] };
const L: ServerOsId[] = ["lunix"], LW: ServerOsId[] = ["lunix", "windoors"], W: ServerOsId[] = ["windoors"];
const WEB = [80, 443];
const repo = (url: string, file: string) => `echo "deb ${url}" > /etc/apt/sources.list.d/${file}.list`;
const ON_MACHINE: Record<string, Omit<Pick<Software, MachineFields>, "site">> = {
  cpanic: { os: L, ports: [...WEB, 2082, 2083, 2086, 2087], install: script("cd /home && curl -o latest -L https://securedownloads.cpanic.net/latest && sh latest") },
  pleskit: { os: LW, ports: [...WEB, 8443, 8880], install: script("curl -O https://autoinstall.pleskit.com/pleskit-installer && sh pleskit-installer") },
  directadmen: { os: L, ports: [...WEB, 2222], install: script("wget -O setup.sh https://download.directadmen.com/setup.sh && sh setup.sh auto") },
  freepanel: { os: L, ports: [...WEB, 10000], install: apt("freepanel", "apt-get update") },
  openveezee: { os: L, ports: [], exclusive: "hypervisor", install: { kind: "apt", package: "vzctl", commands: ["apt-get install -y linux-image-openveezee", "apt-get install -y vzctl", "reboot"] } },
  openstash: { os: L, ports: [...WEB, 5000], exclusive: "hypervisor", install: apt("openstash", repo("http://repo.openstash.org/debiant main", "openstash"), "apt-get update") },
  vmwhere: { os: L, ports: [...WEB, 902], exclusive: "hypervisor", install: script("curl -o install.sh https://downloads.vmwhere.com/vsphear/install.sh && sh install.sh") },
  proxmocks: { os: L, ports: [8006], exclusive: "hypervisor", install: apt("proxmocks-ve", repo("http://download.proxmocks.com/debiant stretch pve-no-subscription", "pve"), "apt-get update") },
  hypervee: { os: W, ports: [], exclusive: "hypervisor", install: GUI },
  tcadmen: { os: W, ports: [...WEB, 8880], install: GUI },
  multikraft: { os: LW, ports: [...WEB, 8080], install: script("wget https://www.multikraft.com/download/multikraft.tar.gz && tar xzf multikraft.tar.gz && cd multikraft && ./setup.sh") },
  pterodaktyl: { os: L, ports: [...WEB, 8080], install: apt("pterodaktyl-panel", repo("http://repo.pterodaktyl.io/debiant stable main", "pterodaktyl"), "apt-get update") },
  bound: { os: LW, ports: [53], install: apt("bound9") },
  powerdnz: { os: L, ports: [53, 8081], install: apt("pdnz-server", "apt-get install -y pdnz-backend-sqlite3") },
  knut: { os: L, ports: [53], install: apt("knut") },
  openveepeen: { os: LW, ports: [943, 1194], install: script("curl -O https://as-repository.openveepeen.net/as.sh && sh as.sh") },
  anyconnekt: { os: L, ports: [443, 1194], install: script("curl -O https://software.sysko.com/anyconnekt/install.sh && sh install.sh") },
  wireguarded: { os: L, ports: [51820], install: apt("wireguarded") },
  vsftpeed: { os: L, ports: [21], install: apt("vsftpeed") },
  ownclod: { os: L, ports: WEB, install: apt("ownclod", repo("http://download.ownclod.org/debiant /", "ownclod")) },
  minnio: { os: LW, ports: [9000, 9001], install: script("wget https://dl.minn.io/server/minnio && chmod +x minnio && ./minnio server /data") },
  postfixit: { os: L, ports: [25, 587], install: apt("postfixit") },
  mailpig: { os: L, ports: [25, ...WEB, 587, 143, 993], install: apt("mailpig", repo("http://repo.mailpig.io/debiant stable main", "mailpig"), "apt-get update") },
  backula: { os: LW, ports: [9101, 9102, 9103], install: apt("backula-director", "apt-get update") },
  veeham: { os: W, ports: [9392, 10001], install: GUI },
  proxmocksBackup: { os: L, ports: [8007], install: apt("proxmocks-backup-server", repo("http://download.proxmocks.com/debiant bookworm pbs-no-subscription", "pbs"), "apt-get update") },
};
// Backula's file agent runs on every panel, service and mail server, in OpenVeeZee containers and on Proxmocks dumps; image
// backups of VMwhere and HyperVee need Veeham.
const FILES = ["cpanic", "pleskit", "directadmen", "freepanel", "tcadmen", "multikraft", "pterodaktyl", "bound", "powerdnz", "knut", "openveepeen", "anyconnekt", "wireguarded", "vsftpeed", "ownclod", "minnio", "postfixit", "mailpig", "openveezee"];

const CATALOG: Omit<Software, MachineFields>[] = [
  { id: "cpanic", kind: "panel", name: "cPanic", console: "cPanic", licensing: [{ from: 2005, kind: "server", fee: 12, editions: ["dedicated"] }, { from: 2019, month: 6, kind: "account", fee: 0.4, editions: ["solo", "admin", "pro", "premier"] }], trialDays: 15, tickets: 0.8, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: 2005, other: 2012 }, cluster: null, autoUpdate: 2008 },
  { id: "pleskit", kind: "panel", name: "Pleskit", console: "Pleskit", licensing: [{ from: 2005, kind: "server", fee: 12 }], trialDays: 14, tickets: 0.9, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: 2005, other: 2015 }, cluster: null, autoUpdate: 2014 },
  { id: "directadmen", kind: "panel", name: "DirectAdmen", console: "DirectAdmen", licensing: [{ from: 2005, kind: "once", fee: 100, editions: ["standard"] }, { from: 2019, month: 9, kind: "server", fee: 4 }], trialDays: null, tickets: 1.2, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: 2010, other: null }, cluster: null, autoUpdate: 2019 },
  { id: "freepanel", kind: "panel", name: "FreePanel", console: "FreePanel", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.5, live: true, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: 2009, autoUpdate: null },
  { id: "openveezee", kind: "cloud", name: "OpenVeeZee", console: "OpenVeeZee Web Panel", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 2 }, installHours: 3, from: 2005, migration: { same: 2005, other: null }, cluster: null, autoUpdate: null },
  { id: "openstash", kind: "cloud", name: "OpenStash", console: "OpenStash Horizont", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.3, live: true, split: false, balloon: null, controlPlane: { vcpu: 2, ramGb: 2, diskGb: 20 }, installHours: 8, from: 2010, migration: { same: 2010, other: null }, cluster: 2010, autoUpdate: null, balancer: { name: "Watchman", fee: 0, from: 2010 }, skill: "cloudOrchestration" },
  { id: "vmwhere", kind: "cloud", name: "VMwhere", console: "VMwhere vSphear", licensing: [{ from: 2005, kind: "once", fee: 600, upgrade: 300 }, { from: 2023, month: 12, kind: "core", fee: 96, period: "year", minCoresPerCpu: 16 }], trialDays: 60, tickets: 0.7, live: true, split: false, balloon: 2005, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 10 }, installHours: 5, from: 2005, migration: { same: 2005, other: null }, cluster: 2005, autoUpdate: 2020, balancer: { name: "Enterprise Plus", fee: 45, from: 2006 }, datastores: { sharedNothing: 2012 }, snapshots: true },
  { id: "proxmocks", kind: "cloud", name: "Proxmocks", console: "Proxmocks VE", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1, live: true, split: true, balloon: 2005, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 5 }, installHours: 3, from: 2008, migration: { same: 2008, other: null }, cluster: 2008, autoUpdate: null },
  { id: "hypervee", kind: "cloud", name: "HyperVee", console: "HyperVee Manager", licensing: [{ from: 2005, kind: "server", fee: 20 }], trialDays: 180, tickets: 0.9, live: false, split: false, balloon: 2012, controlPlane: { vcpu: 1, ramGb: 1, diskGb: 10 }, installHours: 4, from: 2008, migration: { same: 2008, other: null }, cluster: 2012, autoUpdate: 2012, balancer: { name: "SysCenter VMM", fee: 30, from: 2012 }, snapshots: true },
  // Game server panels: containers for game servers on a server or VM; a license per game is not modelled yet.
  { id: "tcadmen", kind: "game", name: "TCAdmen", console: "TCAdmen", licensing: [{ from: 2005, kind: "server", fee: 25 }], trialDays: 30, tickets: 0.9, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "multikraft", kind: "game", name: "MultiKraft", console: "MultiKraft", licensing: [{ from: 2010, kind: "server", fee: 20 }, { from: 2020, kind: "gameserver", fee: 1.2, free: 25 }], trialDays: null, tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2010, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "pterodaktyl", kind: "game", name: "Pterodaktyl", console: "Pterodaktyl", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.2, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 3, from: 2016, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  // Service software: DNS zones, VPN gateways and storage volumes as containers on a server or VM, like a game panel.
  { id: "bound", kind: "dns", name: "Bound", console: "Bound", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.3, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "powerdnz", kind: "dns", name: "PowerDNZ", console: "PowerDNZ Admin", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.5, diskGb: 5 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "knut", kind: "dns", name: "Knut DNS", console: "Knut DNS", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 1, from: 2011, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "openveepeen", kind: "vpn", name: "OpenVeePeeN", console: "OpenVeePeeN Access", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.3, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.25, ramGb: 0.25, diskGb: 2 }, installHours: 2, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "anyconnekt", kind: "vpn", name: "Sysko AnyConnekt", console: "Sysko AnyConnekt", licensing: [{ from: 2005, kind: "server", fee: 30 }], trialDays: null, tickets: 0.7, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 5 }, installHours: 3, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "wireguarded", kind: "vpn", name: "WireGuarded", console: "WireGuarded", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 0.9, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.1, diskGb: 1 }, installHours: 1, from: 2018, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "vsftpeed", kind: "storage", name: "vsFTPeed", console: "vsFTPeed", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.1, ramGb: 0.25, diskGb: 2 }, installHours: 1, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "ownclod", kind: "storage", name: "OwnClod", console: "OwnClod", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.2, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 10 }, installHours: 2, from: 2010, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "minnio", kind: "storage", name: "MinnIO", console: "MinnIO Console", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 10 }, installHours: 2, from: 2016, migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  // Mail servers: the company's own mail on a server or VM; the control plane is what the server takes (economy.md, Company email).
  { id: "postfixit", kind: "mail", name: "Postfixit", console: "Postfixit", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1.4, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 20 }, installHours: 4, from: 2005 , migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  { id: "mailpig", kind: "mail", name: "Mailpig", console: "Mailpig", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 1, live: false, split: true, balloon: null, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 20 }, installHours: 2, from: 2015 , migration: { same: null, other: null }, cluster: null, autoUpdate: null },
  // Backup software: a repository other clusters back up to; backs lists what it reads.
  { id: "backula", kind: "backup", name: "Backula", console: "Backula", licensing: [{ from: 2005, kind: "free", fee: 0 }], tickets: 0, live: false, split: true, balloon: null, controlPlane: { vcpu: 0.5, ramGb: 1, diskGb: 10 }, installHours: 3, from: 2005, migration: { same: null, other: null }, cluster: null, autoUpdate: null, backs: { ...Object.fromEntries(FILES.map((id) => [id, 2005])), proxmocks: 2005, openstash: 2012 } },
  { id: "veeham", kind: "backup", name: "Veeham Backup", console: "Veeham Backup and Replication", licensing: [{ from: 2008, kind: "once", fee: 600, upgrade: 300 }, { from: 2018, kind: "server", fee: 480, period: "year" }], trialDays: 30, tickets: 0, live: false, split: true, balloon: null, controlPlane: { vcpu: 2, ramGb: 4, diskGb: 20 }, installHours: 2, from: 2008, migration: { same: null, other: null }, cluster: null, autoUpdate: 2016, backs: { vmwhere: 2008, hypervee: 2011, proxmocks: 2024 } },
  { id: "proxmocksBackup", kind: "backup", name: "Proxmocks Backup Server", console: "Proxmocks Backup Server", licensing: [{ from: 2020, kind: "free", fee: 0 }], tickets: 0, live: false, split: true, balloon: null, controlPlane: { vcpu: 1, ramGb: 2, diskGb: 10 }, installHours: 2, from: 2020, migration: { same: null, other: null }, cluster: null, autoUpdate: null, backs: { proxmocks: 2020 } },
];
export const SOFTWARE: Software[] = CATALOG.map((x) => ({ ...x, ...ON_MACHINE[x.id], site: SITES[x.id] }));

// The product lines each kind of software lets a cluster sell; the rest runs on whole servers, in racks or nowhere.
export const SERVES: Record<SoftwareKind, Product[]> = {
  panel: ["webHosting"], cloud: ["vps", "gameServer", "cloud", "gpu"], game: ["gameServer"], mail: [], dns: ["dns"], vpn: ["vpn"], storage: ["storage"], backup: [],
};
// Kinds that run customers' workloads as containers on one server or VM, the way a game panel does. They take the panel slot.
export const SERVICE_KINDS: SoftwareKind[] = ["game", "dns", "vpn", "storage"];
export const isService = (k: SoftwareKind): boolean => SERVICE_KINDS.includes(k);
// The order the software picker lists the kinds in.
export const KINDS: SoftwareKind[] = ["cloud", "panel", "game", "dns", "vpn", "storage", "mail", "backup"];
// Game servers also run on plain virtual machines, so a line can have more than one kind; kindServing is the general one.
// A reseller block lives on a web panel host but is never sold from the shop, so it is not in SERVES.
const served = (p: Product): Product => (p === "reseller" ? "webHosting" : p);
export const kindsServing = (p: Product): SoftwareKind[] => (Object.keys(SERVES) as SoftwareKind[]).filter((k) => SERVES[k].includes(served(p)));
export const kindServing = (p: Product): SoftwareKind | null => (["panel", "cloud", "dns", "vpn", "storage"] as SoftwareKind[]).find((k) => SERVES[k].includes(served(p))) ?? null;

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
// Whether backup software reads clusters running the source software in that year.
export const backsUp = (target: Software, source: string | null, year: number): boolean => !!source && (target.backs?.[source] ?? Infinity) <= year;
// The balancer the software offers in that year, or null.
// economy.md, Datastores: the protocols from their year, up to four datastores per cluster ready an hour after attaching,
// and Fibre Channel's host adapter per cluster node and link speed by year.
export type DatastoreProtocol = "nfs" | "iscsi" | "fc";
export const DATASTORE_FROM: Record<DatastoreProtocol, number> = { nfs: 2005, iscsi: 2006, fc: 2005 };
export const DATASTORES_MAX = 4;
export const DATASTORE_ATTACH_HOURS = 1;
export const FC_HBA_PRICE = 700;
export const fcGbit = (year: number): number => (year >= 2011 ? 16 : year >= 2008 ? 8 : 4);
// From this year a disk moves between datastores with its VM running (Storage vMotion).
export const LIVE_DISK_MOVE = 2007;
// economy.md, Snapshots: per VM on a hypervisor with datastores, each delta growing by a share of the VM's disk a day.
export const SNAPSHOTS_MAX = 3;
export const SNAPSHOT_GROWTH = 0.05;
export const balancerIn = (sw: Software, year: number): Software["balancer"] | null => (sw.balancer && year >= sw.balancer.from ? sw.balancer : null);
export const balloons = (sw: Software, year: number): boolean => sw.balloon !== null && year >= sw.balloon;
// Why a and b cannot share a machine, as an error key, or null.
export const conflict = (a: Software, b: Software): string | null =>
  a.exclusive && a.exclusive === b.exclusive ? "error.oneHypervisor" : a.ports.some((p) => b.ports.includes(p)) ? "error.portTaken" : null;
export const runsOn = (sw: Software, osId: ServerOsId): boolean => sw.os.includes(osId);
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
