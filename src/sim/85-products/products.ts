import { chance, hashRng } from "../00-core/rng";
import { hourOf, isMonthStart, monthIndexOf, nowHours, yearOf } from "../00-core/time";
import { cpuModel, isFresh, skuOf, topBoost } from "../10-catalog/cpus";
import { genOf, modelById } from "../10-catalog/hardware";
import { balancerIn, isService, softwareById } from "../10-catalog/platforms";
import { slowTolerance } from "../10-catalog/usage";
import { channelOf, EDGE_HOWTO } from "../60-infra/channel";
import { tierOf } from "../60-infra/licence";
import { TRIAL_DAYS, LAPSE_GRACE_DAYS, topTier } from "../10-catalog/licence-tiers";
import { APP_SUITE_FEE, licensingAt, SERVER_OS, serverOsAt, serverOsById, type LicenseEra, type LicenseKind, type ServerOsId } from "../10-catalog/server-os";
import { homeLineById } from "../20-world/datacenters";
import type { Customer, Product } from "../30-customers/customers";
import { bump, createTicket, slowed } from "../40-support/tickets";
import type { Device, GameState, Location } from "../50-state";
import { insideVm, isOwnVm, lostDisk, servedBy, vmOf, type Cluster, type Workload } from "../60-infra/cluster";
import { exitsOf } from "../60-infra/network";
import { backupTarget, linkHours, repoRoom, repoUsed, runBackups } from "../60-infra/backups";
import { bootHours, customerWorkloads, liveServices } from "../60-infra/status";
import { hostPerf, phpTickets } from "../60-infra/php";
import { welcomeFriends } from "../90-actions/start";
import { deviceVendor, installedCores, perCoreOf } from "../60-infra/status";
import { diskFill, nodeUsage } from "../60-infra/usage";
import { addAwareness, addReview, announceReview, starsFor } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";

// Values from docs/design/economy.md, sections "Platforms and licenses" and "Data loss and backups".
export const LOSS_NO_BACKUP = -60;
export const LOSS_RESTORED = -15;
export const LOSS_RESTORED_MAX = -40;
export const REVIEW_CHANCE = 0.1;
export const UNHAPPY_REVIEW_CHANCE = 0.2;
export const UNHAPPY = 40;
// GB moved per hour over a 1 Gbit/s link inside a zone and over the internet to another zone.
export const LAN_GB_PER_HOUR = 450;
export const WAN_GB_PER_HOUR = 45;
export { SLOW_PENALTY, SLOW_TICKET_CHANCE } from "../40-support/tickets";

// One lost disk in an incident report.
export interface LossItem { workloadId: string; serviceId: string; customerId: string; diskGb: number; backupAt: number | null; restored: boolean }
// The incident report the game opens when a server's array is lost.
export interface LossReport { id: string; hour: number; deviceId: string; items: LossItem[] }

// The speed of the links between two zones in Gbit/s, 0 without a ready one; parallel links add up.
export const zoneLinkGbit = (s: GameState, a: string, b: string): number => {
  if (a === b) return 1;
  const ends = [a, b].map((az) => s.locations.find((l) => l.az === az)?.id);
  return s.network.zoneLinks.filter((z) => z.readyAt <= s.hour && ends.includes(z.a) && ends.includes(z.b)).reduce((n, z) => n + z.gbit, 0);
};

// The speed a workload moves between two zones at: the zone links, or else over the internet into a datacenter at the slower
// side's uplink, at most WAN_GB_PER_HOUR. Never 10 Gbit/s, so such a move is always cold. Nothing moves back into the basement.
export function moveGbit(s: GameState, a: string, b: string): number {
  const linked = zoneLinkGbit(s, a, b);
  const from = s.locations.find((l) => l.az === a), to = s.locations.find((l) => l.az === b);
  if (linked || !from || !to?.dc) return linked;
  const mbps = (l: Location) => (l.dc ? exitsOf(s, l).reduce((n, e) => n + e.cap, 0) : homeLineById(s.homeLine.id).up);
  return Math.min(Math.min(mbps(from), mbps(to)) / 1000, WAN_GB_PER_HOUR / LAN_GB_PER_HOUR);
}

function units(s: GameState, c: Cluster, kind: LicenseKind): number {
  if (kind === "account") return s.workloads.filter((w) => w.clusterId === c.id && servedBy(s, w) === "panel").length;
  if (kind === "server") return c.kind === "cloud" ? c.nodes.length : 1;
  if (kind === "core") return c.nodes.reduce((n, x) => n + installedCores(s.devices.find((d) => d.id === x.deviceId)!), 0);
  return 0;
}
// The monthly fee of a panel edition: nothing during the trial, after a lapse or once the trial ended without a tier.
export const softwareFee = (s: GameState, c: Cluster, id: string | null): number => {
  if (!id) return 0;
  const tier = id === c.panel ? tierOf(c) : undefined;
  if (tier) {
    if (c.licence && (c.licence.trialUntil !== null || c.licence.lapsedAt !== null)) return 0;
    return Math.round(tier.fee * (tier.kind === "account" ? units(s, c, "account") : 1) * 100) / 100;
  }
  const era = licensingAt(softwareById(id), yearOf(s.hour));
  return Math.round(era.fee * units(s, c, era.kind) * 100) / 100;
};
const isServer = (m: Device | Workload): m is Device => "components" in m;
// The monthly OS license of a machine, a server or one of the player's own VMs: per physical core or per vCPU in a core era.
const osFee = (s: GameState, m: Device | Workload): number => {
  const era = m.os && licensingAt(serverOsById(m.os.id), yearOf(s.hour));
  return era?.kind !== "core" ? 0 : era.fee * (isServer(m) ? installedCores(m) : m.vcpu);
};
const machinesOf = (s: GameState, c: Cluster) => (c.vm ? s.workloads.filter((w) => w.id === c.vm) : s.devices.filter((d) => c.nodes.some((n) => n.deviceId === d.id)));
// docs/design/software.md, section 1: in a once era the OS or the software is bought when its install starts, per machine
// for an OS and per CPU socket of a server for software, and the machine keeps the license for every later reinstall.
type Licensed = { id: string; name: string; licensing: LicenseEra[] };
const oncePrice = (s: GameState, machineId: string, x: Licensed, perSocket: boolean): number => {
  const era = licensingAt(x, yearOf(s.hour));
  if (era.kind !== "once" || s.licenses.some((l) => l.id === x.id && l.machineId === machineId)) return 0;
  const d = perSocket ? s.devices.find((m) => m.id === machineId) : undefined;
  return era.fee * (d ? d.components.filter((p) => p.kind === "cpu").length : 1);
};
const owed = (s: GameState, machineId: string, osId: ServerOsId | null, swId: string | null): [Licensed, number][] => [
  ...(osId ? [[serverOsById(osId), oncePrice(s, machineId, serverOsById(osId), false)] as [Licensed, number]] : []),
  ...(swId ? [[softwareById(swId), oncePrice(s, machineId, softwareById(swId), true)] as [Licensed, number]] : []),
].filter(([, n]) => n > 0);

// What installing the OS or the software on the machine costs at once; a machine that does not exist yet is a new VM.
export const licenseDue = (s: GameState, machineId: string, osId: ServerOsId | null, swId: string | null): number =>
  owed(s, machineId, osId, swId).reduce((n, [, x]) => n + x, 0);

// Charges and records what licenseDue counts, one ledger line each.
export function buyLicenses(s: GameState, machineId: string, osId: ServerOsId | null, swId: string | null): void {
  const m = [...s.devices, ...s.workloads].find((x) => x.id === machineId);
  const machine = m && ("components" in m ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);
  for (const [x, price] of owed(s, machineId, osId, swId)) {
    const name = x.id === osId ? `${x.name} ${serverOsAt(osId, yearOf(s.hour)).version}` : x.name;
    s.cash = Math.round((s.cash - price) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.licenseOnce", params: { name, machine: machine ?? machineId }, amount: -price }];
    s.licenses = [...s.licenses, { id: x.id, machineId, boughtAt: s.hour }];
  }
}

// An in-place upgrade buys the new release in a once era; a monthly era already covers it.
export const upgradeLicenseDue = (s: GameState, osId: ServerOsId): number => {
  const era = licensingAt(serverOsById(osId), yearOf(s.hour));
  return era.kind === "once" ? era.fee : 0;
};

export function buyUpgradeLicense(s: GameState, machineId: string, osId: ServerOsId, version: string): void {
  const price = upgradeLicenseDue(s, osId);
  if (!price) return;
  const m = [...s.devices, ...s.workloads].find((x) => x.id === machineId);
  const machine = m && ("components" in m ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);
  s.cash = Math.round((s.cash - price) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.licenseOnce", params: { name: `${serverOsById(osId).name} ${version}`, machine: machine ?? machineId }, amount: -price }];
}

// Old saves: the licenses every machine holds, Windoors or VMwhere on it.
export const heldLicenses = (s: GameState): GameState["licenses"] =>
  [...s.devices, ...s.workloads].flatMap((m) => [m.os?.id, ...(m.software ?? []).map((x) => x.id)].filter((id): id is string => !!id)
    .filter((id) => (SERVER_OS.find((o) => o.id === id) ?? softwareById(id)).licensing.some((e) => e.kind === "once"))
    .map((id) => ({ id, machineId: m.id, boughtAt: s.hour })));

// The monthly license bill of a cluster's panel and platform; the operating systems of its machines and the App Suite
// count under platform.
// A bought balancer edition is billed per node.
export const balancerFee = (s: GameState, c: Cluster): number =>
  (c.balancer && c.platform ? balancerIn(softwareById(c.platform), yearOf(s.hour))?.fee ?? 0 : 0) * c.nodes.length;

export function licenseCost(s: GameState, c: Cluster): { panel: number; platform: number } {
  const extra = machinesOf(s, c).reduce((n, m) => n + osFee(s, m), 0) + (c.appSuite ? APP_SUITE_FEE : 0) + balancerFee(s, c);
  return { panel: softwareFee(s, c, c.panel), platform: softwareFee(s, c, c.platform) + extra };
}

const tickets = (id: string | null) => (id ? softwareById(id).tickets : 1);
// The how-to ticket rate factor of a customer: the average over their cluster workloads of the software serving each,
// with web spaces on an old PHP a little higher.
export function howToFactor(s: GameState, customerId: string): number {
  const services = new Set(liveServices(s, customerId).map((v) => v.id));
  const factors = customerWorkloads(s, customerId).filter((w) => w.clusterId && services.has(w.serviceId)).map((w) => {
    const c = s.clusters.find((x) => x.id === w.clusterId)!;
    const kind = servedBy(s, w), edge = channelOf(c) === "edge" ? EDGE_HOWTO : 1;
    return edge * (kind === "panel" ? tickets(c.panel) * phpTickets(s, c) : tickets(isService(kind) ? c.panel : c.platform));
  });
  return factors.length ? factors.reduce((a, b) => a + b, 0) / factors.length : 1;
}

// Space the restore points written to a target cluster take, and the free disk its nodes have.
export function backupPool(s: GameState, targetId: string): { need: number; room: number } {
  const target = s.clusters.find((c) => c.id === targetId);
  return { need: repoUsed(s, targetId), room: target ? repoRoom(s, target) : 0 };
}

// Hours a restore of a workload takes from the repository that holds its newest good copy.
export function restoreHours(s: GameState, w: Workload): number {
  const c = s.clusters.find((x) => x.id === w.clusterId);
  return c ? linkHours(c, backupTarget(s, c, w), w.diskGb * diskFill(s, w, w.backupAt ?? s.hour)) : 1;
}

// economy.md, Reviews: 10% write one, 20% when unhappy.
export function lossReview(s: GameState, c: Customer): void {
  if (!chance(s.rng, c.happiness < UNHAPPY ? UNHAPPY_REVIEW_CHANCE : REVIEW_CHANCE)) return;
  addReview(s, c.id, starsFor(c.happiness, s.rng), "dataLoss");
}

const customerCopy = (s: GameState, id: string): Customer | undefined => {
  const i = s.customers.findIndex((c) => c.id === id);
  if (i < 0) return undefined;
  const c = { ...s.customers[i] };
  s.customers = s.customers.map((x, k) => (k === i ? c : x));
  return c;
};

function finishSwitches(s: GameState, events: SimEvent[]) {
  for (const c of s.clusters) {
    if (!c.switching || c.switching.doneAt > s.hour) continue;
    const { kind, to } = c.switching, fresh = !(kind === "cloud" ? c.platform : c.panel);
    // A licensed panel starts on a free trial of its top tier.
    const licence = kind === "panel" && topTier(to) ? { tier: topTier(to)!.id, trialUntil: s.hour + TRIAL_DAYS * 24, lapsedAt: null } : undefined;
    s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switching: null, version: yearOf(s.hour), updatedAt: s.hour, ...(kind === "cloud" ? { platform: to } : { panel: to, licence }), ...(fresh ? { channel: "stable" as const } : {}) } : x));
    events.push({ app: "Locations", key: fresh ? "event.installed" : "event.switched", params: { cluster: c.name, name: softwareById(to).name } });
    const d = fresh ? s.devices.find((x) => x.id === c.controlPlane) : undefined;
    if (d?.bootFrom === "usb") Object.assign(d, { bootFrom: "disk", bootUntil: nowHours(s) + bootHours(s, d) });
    if (fresh && c.vm) s.workloads = s.workloads.map((w) => (w.id === c.vm && w.media ? { ...w, media: undefined } : w));
    if (kind === "panel" && welcomeFriends(s, c.id)) events.push({ app: "Customers", key: "event.friendsJoined", params: { cluster: c.name } });
  }
}

// The friends wait for the first panel host the internet reaches, which may go online after its install. They only come to
// a company without customers.
function friendsArrive(s: GameState, events: SimEvent[]) {
  if (s.customers.length) return;
  const c = s.clusters.find((x) => x.kind === "panel" && x.panel && !x.switching);
  if (c && welcomeFriends(s, c.id)) events.push({ app: "Customers", key: "event.friendsJoined", params: { cluster: c.name } });
}

function reportLosses(s: GameState, events: SimEvent[]) {
  for (const d of s.devices) {
    if (d.dataLost === null || s.lossReports.some((r) => r.deviceId === d.id && r.hour === d.dataLost)) continue;
    // A lost panel VM loses every web space in it, with the VM's backup.
    const lost = s.workloads.filter((w) => w.deviceId === d.id && lostDisk(s, w))
      .flatMap((w) => (isOwnVm(w) ? insideVm(s, w.id) : [w]));
    if (lost.length) reportLoss(s, d, lost, d.dataLost, events);
  }
}

// Opens a loss report for workloads that lost their data on a device at an hour: customers without a backup take the hit.
export function reportLoss(s: GameState, d: Device, lost: Workload[], hour: number, events: SimEvent[]) {
  const items = lost.map((w): LossItem => {
    const v = s.services.find((x) => x.id === w.serviceId)!;
    return { workloadId: w.id, serviceId: v.id, customerId: v.customerId, diskGb: w.diskGb, backupAt: (vmOf(s, w) ?? w).backupAt, restored: false };
  });
  // A customer without a backup takes the hit per lost disk and asks for a refund once, in Support.
  const asked = new Set<string>();
  for (const it of items) {
    if (it.backupAt !== null) continue;
    const c = customerCopy(s, it.customerId)!;
    bump(c, LOSS_NO_BACKUP);
    if (!asked.has(c.id)) createTicket(s, c, "refund", it.serviceId, "dataLoss");
    asked.add(c.id);
  }
  s.lossReports = [...s.lossReports, { id: `loss${s.nextId++}`, hour, deviceId: d.id, items }];
  events.push({ app: "Locations", key: "event.dataLoss", params: { device: d.label ?? d.name, count: items.length } });
}

// The speed a customer workload runs at, 1 when nothing slows it: the slowest of its node, its panel host and, for a game
// server, one core.
export function workloadPerf(s: GameState, w: Workload, product: Product | undefined, nodePerf: (deviceId: string) => number = (id) => nodeUsage(s, id).perf): number {
  if (!w.clusterId || w.stopped || isOwnVm(w)) return 1;
  const vm = vmOf(s, w), at = w.deviceId ?? vm?.deviceId;
  if (!at || s.frozen.includes(at) || vm?.stopped) return 1;
  const c = s.clusters.find((x) => x.id === w.clusterId), node = product === "gameServer" ? s.devices.find((d) => d.id === at) : undefined;
  return Math.min(nodePerf(at), hostPerf(s, c), node ? perCoreOf(node) : 1);
}

// Overloaded nodes slow every customer on them, web spaces in a panel VM included, and a PHP upgrade or a compromise slows
// its panel host's sites: happiness drops with the performance lost and some write in.
function overload(s: GameState) {
  const perfs = new Map<string, number>();
  const perfOf = (id: string) => perfs.get(id) ?? perfs.set(id, nodeUsage(s, id).perf).get(id)!;
  const services = new Map(s.services.map((v) => [v.id, v])), slow = new Set<string>();
  for (const w of s.workloads) {
    const v = services.get(w.serviceId), perf = workloadPerf(s, w, v?.product, perfOf);
    if (perf >= 1) continue;
    const cus = v && customerCopy(s, v.customerId);
    if (!v || !cus) continue;
    slow.add(v.id);
    // Customers notice only the slowdown past what they expect from what they run.
    const lost = 1 - perf - slowTolerance(s.seed, v.product, cus.profile, cus.id);
    if (lost > 0) slowed(s, cus, v.id, lost);
  }
  if (slow.size) s.services = s.services.map((v) => (slow.has(v.id) ? { ...v, slowedAt: s.hour } : v));
}

// economy.md, Marketing and reviews: a fast game server and a smooth month.
export const FAST_CLOCK = 0.9;
export const FAST_HAPPY = 3;
export const FAST_REVIEW_CHANCE = 0.1;
export const FRESH_AWARENESS = 0.01;
export const FRESH_AWARENESS_CAP = 0.05;
export const SMOOTH_REVIEW_CHANCE = 0.05;
// The boost clock of a node's CPUs: its part's, or its vendor generation's clock for a part without a name.
export const nodeBoost = (d: Device): number => {
  const c = d.components.find((x) => x.kind === "cpu");
  if (!c) return 0;
  const vendor = c.vendor ?? deviceVendor(d), gen = c.gen ?? genOf(modelById(d.model));
  return skuOf({ ...c, vendor, gen })?.boost ?? cpuModel(vendor, gen)?.ghz ?? 0;
};
// The node a customer workload runs on.
const nodeOf = (s: GameState, w: Workload): Device | undefined => {
  const at = w.deviceId ?? vmOf(s, w)?.deviceId;
  return at ? s.devices.find((d) => d.id === at) : undefined;
};
// At a month's start: gamers on a node whose CPU boosts within FAST_CLOCK of the fastest part on sale gain FAST_HAPPY and may
// write a five-star review; a CPU still new raises awareness among gamers per node, up to the cap. Every service that ran the
// whole month without a slowdown or an outage may earn a review of at least four stars. One review per customer and month.
// The rolls come from the month's own stream, so they leave the game's draws alone.
export function monthlyReviews(s: GameState, events: SimEvent[]): void {
  const month = monthIndexOf(s.hour), year = yearOf(s.hour), top = topBoost(year), since = hourOf(new Date(Date.UTC(Math.floor((month - 1) / 12), (month - 1) % 12, 1)));
  const reviewed = new Set<string>(), fresh = new Set<string>(), r = hashRng(s.seed, s.hour, 331);
  const review = (cus: Customer, stars: number, reason: "fast" | "smooth", p: number) => {
    if (reviewed.has(cus.id) || !chance(r, p)) return;
    reviewed.add(cus.id);
    announceReview(s, addReview(s, cus.id, stars, reason), events);
  };
  for (const v of s.services) {
    if (v.endedAt !== null) continue;
    const w = s.workloads.find((x) => x.serviceId === v.id), node = w && !w.stopped ? nodeOf(s, w) : undefined;
    if (v.product === "gameServer" && node && nodeBoost(node) >= FAST_CLOCK * top) {
      const cus = customerCopy(s, v.customerId);
      if (!cus) continue;
      bump(cus, FAST_HAPPY);
      const c = node.components.find((x) => x.kind === "cpu");
      const part = c && skuOf({ ...c, vendor: c.vendor ?? deviceVendor(node), gen: c.gen ?? genOf(modelById(node.model)) });
      if (part && isFresh(part, month)) fresh.add(node.id);
      review(cus, 5, "fast", FAST_REVIEW_CHANCE);
    }
    if (v.startedAt <= since && (v.slowedAt ?? -1) < since && !(v.id in s.downSince)) {
      const cus = s.customers.find((x) => x.id === v.customerId);
      if (cus) review(cus, Math.max(4, starsFor(cus.happiness, r)), "smooth", SMOOTH_REVIEW_CHANCE);
    }
  }
  if (fresh.size) addAwareness(s, "gamer", Math.min(FRESH_AWARENESS_CAP, FRESH_AWARENESS * fresh.size));
}

// One line per paid software and cluster, one per App Suite, and one for every machine's Windoors together.
function billLicenses(s: GameState) {
  const line = (key: string, params: Record<string, string | number>, amount: number) => ({ hour: s.hour, category: "licenses", key, params, amount: -amount });
  const lines = s.clusters.flatMap((c) => [
    ...[c.panel, c.platform].filter((id) => softwareFee(s, c, id) > 0).map((id) => line("ledger.license", { cluster: c.name, name: softwareById(id!).name }, softwareFee(s, c, id))),
    ...(c.appSuite ? [line("ledger.appSuite", { cluster: c.name }, APP_SUITE_FEE)] : []),
    ...(balancerFee(s, c) > 0 ? [line("ledger.balancer", { cluster: c.name, name: balancerIn(softwareById(c.platform!), yearOf(s.hour))!.name }, balancerFee(s, c))] : []),
  ]);
  const windoors = [...s.devices, ...s.workloads].filter((m) => m.os?.id === "windoors");
  const osTotal = Math.round(windoors.reduce((n, m) => n + osFee(s, m), 0) * 100) / 100;
  if (osTotal > 0) lines.push(line("ledger.windoors", { count: windoors.length }, osTotal));
  // ponytail: sold, scrapped and deleted machines lose their one-time licenses here, at the month's bill.
  const held = new Set([...s.devices, ...s.workloads, ...s.ops.seized.map((x) => x.device)].map((m) => m.id));
  s.licenses = s.licenses.filter((l) => held.has(l.machineId));
  if (!lines.length) return;
  s.cash = Math.round((s.cash + lines.reduce((n, l) => n + l.amount, 0)) * 100) / 100;
  s.ledger = [...s.ledger, ...lines];
}

// On the 1st a panel whose licence the cash cannot pay lapses; a lapse that cash recovers within a week is paid and cleared.
export function licenceTick(s: GameState): void {
  for (const c of s.clusters) {
    const lic = c.licence;
    if (!lic || !tierOf(c)) continue;
    const set = (patch: Partial<typeof lic>) => { s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, licence: { ...lic, ...patch } } : x)); };
    if (lic.lapsedAt !== null && s.hour - lic.lapsedAt <= LAPSE_GRACE_DAYS * 24) {
      const fee = softwareFee(s, { ...c, licence: { ...lic, lapsedAt: null } }, c.panel);
      if (s.cash >= fee) { set({ lapsedAt: null }); payLicence(s, c, fee); }
    } else if (lic.lapsedAt === null && lic.trialUntil === null && isMonthStart(s.hour) && s.cash < softwareFee(s, c, c.panel)) set({ lapsedAt: s.hour });
  }
}

// Charges a licence fee at once, as the monthly line does.
export function payLicence(s: GameState, c: Cluster, fee: number): void {
  if (fee <= 0) return;
  s.cash = Math.round((s.cash - fee) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.license", params: { cluster: c.name, name: softwareById(c.panel!).name }, amount: -fee }];
}

// Hourly: finishes software switches, opens incident reports for lost disks, runs backups, slows overloaded nodes, bills licenses.
export function productsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  finishSwitches(s, events);
  friendsArrive(s, events);
  reportLosses(s, events);
  runBackups(s, events);
  overload(s);
  licenceTick(s);
  if (isMonthStart(s.hour)) {
    monthlyReviews(s, events);
    billLicenses(s);
  }
  return events;
}
