import { chance, hashRng } from "../00-core/rng";
import { runsHot } from "../60-infra/ha";
import { POOL_LOW_PERF, sharesOf } from "../60-infra/vmwhere";
import { hourOf, isMonthStart, monthIndexOf, nowHours, yearOf } from "../00-core/time";
import { cpuModel, isFresh, skuOf, topBoost } from "../10-catalog/cpus";
import { genOf, modelById } from "../10-catalog/hardware";
import { balancerIn, isService, softwareById } from "../10-catalog/platforms";
import { slowTolerance } from "../10-catalog/usage";
import { channelOf, EDGE_HOWTO } from "../60-infra/channel";
import { accountsOn, keyTiers, assignedKey, extendKey, productOf, panelMachine, startTrial, tiersOnSale, updateKey, yearly } from "../60-infra/licence";
import { LAPSE_GRACE_DAYS, topTier, type LicenceTier } from "../10-catalog/licence-tiers";
import { APP_SUITE_FEE, eraAt, serverOsById, type ServerOsId } from "../10-catalog/server-os";
import { homeLineById } from "../20-world/datacenters";
import type { Customer, Product } from "../30-customers/customers";
import { bump, createTicket, deliverMail, slowed } from "../40-support/tickets";
import { spendable } from "../46-finance/bank";
import type { Device, GameState, Licence, Location } from "../50-state";
import { insideVm, isOwnVm, lostDisk, servedBy, vmOf, type Cluster, type Workload } from "../60-infra/cluster";
import { exitsOf } from "../60-infra/network";
import { backupTarget, repoRoom, repoUsed, runBackups } from "../60-infra/backups";
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

const panelAccounts = (s: GameState, c: Cluster): number => s.workloads.filter((w) => w.clusterId === c.id && servedBy(s, w) === "panel").length;
export const tierFee = (s: GameState, c: Cluster, tier: LicenceTier): number =>
  Math.round(tier.fee * (tier.kind === "account" ? panelAccounts(s, c) : 1) * 100) / 100;
const isServer = (m: Device | Workload): m is Device => "components" in m;
const machinesOf = (s: GameState, c: Cluster) => (c.vm ? s.workloads.filter((w) => w.id === c.vm) : s.devices.filter((d) => c.nodes.some((n) => n.deviceId === d.id)));

// An in-place upgrade buys the new release in a once era; a monthly era already covers it.
export const upgradeLicenseDue = (s: GameState, osId: ServerOsId): number => {
  const era = eraAt(serverOsById(osId), s.hour);
  return era.kind === "once" ? era.fee : 0;
};

export function buyUpgradeLicense(s: GameState, machineId: string, osId: ServerOsId, version: string): void {
  const price = upgradeLicenseDue(s, osId);
  if (!price) return;
  const m = [...s.devices, ...s.workloads].find((x) => x.id === machineId);
  const machine = m && ("components" in m ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);
  s.cash = Math.round((s.cash - price) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.licenseOnce", params: { name: `${serverOsById(osId).name} ${version}`, machine: machine ?? machineId }, amount: -price }];
  const k = assignedKey(s, machineId, osId);
  if (k?.covers.kind === "version") updateKey(s, k.id, { covers: { kind: "version", major: version } });
}

// The monthly license bill of a cluster: the renewing keys on its machines, the panel's apart; the other keys, the App
// Suite and the balancer count under platform.
// A bought balancer edition is billed per node.
export const balancerFee = (s: GameState, c: Cluster): number =>
  (c.balancer && c.platform ? balancerIn(softwareById(c.platform), yearOf(s.hour))?.fee ?? 0 : 0) * c.nodes.length;

export function licenseCost(s: GameState, c: Cluster): { panel: number; platform: number } {
  const machines = new Set(machinesOf(s, c).map((m) => m.id));
  const keys = s.licenses.filter((k) => k.machineId !== null && machines.has(k.machineId) && k.renewsAt !== null);
  const sum = (ks: Licence[]) => Math.round(ks.reduce((n, k) => n + keyFee(s, k) / (yearly(k.product, k.edition, s.hour) ? 12 : 1), 0) * 100) / 100;
  const extra = (c.appSuite ? APP_SUITE_FEE : 0) + balancerFee(s, c);
  return { panel: sum(keys.filter((k) => k.product === c.panel)), platform: sum(keys.filter((k) => k.product !== c.panel)) + extra };
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

// Hours a restore of a workload takes from the repository that holds its newest good copy into zone az, its own cluster's by default.
export function restoreHours(s: GameState, w: Workload, az?: string): number {
  const c = s.clusters.find((x) => x.id === w.clusterId), target = c && backupTarget(s, c, w);
  const rate = target && target.az === (az ?? c.az) ? LAN_GB_PER_HOUR : WAN_GB_PER_HOUR;
  return Math.max(1, Math.ceil((w.diskGb * diskFill(s, w, w.backupAt ?? s.hour)) / rate));
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
    // A licensed panel installed without a key runs its trial, once per machine.
    const host = kind === "panel" && topTier(to) ? panelMachine(c) : null;
    if (host && !assignedKey(s, host, to)) startTrial(s, host, to);
    const licence = kind === "cloud" && to === "vmwhere" && fresh ? { tier: "essentials", trialUntil: null, lapsedAt: null } : undefined;
    s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switching: null, version: yearOf(s.hour), updatedAt: s.hour, ...(kind === "cloud" ? { platform: to, ...(licence && { licence }) } : { panel: to }), ...(fresh ? { channel: "stable" as const } : {}) } : x));
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
  const base = Math.min(nodePerf(at), hostPerf(s, c), node ? perCoreOf(node) : 1), shares = sharesOf(c, w);
  if (shares === "normal" || !runsHot(s, at)) return base;
  // Under contention a high pool keeps its performance and a low pool gives some up.
  return shares === "high" ? 1 : Math.min(base, POOL_LOW_PERF);
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

// One line per App Suite and per balancer; software and operating systems renew per key in renewKeys.
function billLicenses(s: GameState) {
  const line = (key: string, params: Record<string, string | number>, amount: number) => ({ hour: s.hour, category: "licenses", key, params, amount: -amount });
  const lines = s.clusters.flatMap((c) => [
    ...(c.appSuite ? [line("ledger.appSuite", { cluster: c.name }, APP_SUITE_FEE)] : []),
    ...(balancerFee(s, c) > 0 ? [line("ledger.balancer", { cluster: c.name, name: balancerIn(softwareById(c.platform!), yearOf(s.hour))!.name }, balancerFee(s, c))] : []),
  ]);
  // ponytail: sold, scrapped and deleted machines release their keys here, at the month's bill.
  const held = new Set([...s.devices, ...s.workloads, ...s.ops.seized.map((x) => x.device)].map((m) => m.id));
  s.licenses = s.licenses.map((k) => (k.machineId !== null && !held.has(k.machineId) ? { ...k, machineId: null } : k));
  if (!lines.length) return;
  s.cash = Math.round((s.cash + lines.reduce((n, l) => n + l.amount, 0)) * 100) / 100;
  s.ledger = [...s.ledger, ...lines];
}

// The fee per term of a subscription key: its edition's or its product's price per account, server, game server beyond the
// free ones, or core of its machine, a server counting at least the era's minimum cores. An unassigned key pays for one unit.
export function keyFee(s: GameState, k: Licence): number {
  const tier = keyTiers(k.product).find((x) => x.id === k.edition);
  const c = s.clusters.find((x) => x.panel === k.product && panelMachine(x) === k.machineId);
  if (tier) return c ? tierFee(s, c, tier) : tier.fee;
  const era = eraAt(productOf(k.product)!, s.hour);
  if (era.kind === "once" || era.kind === "free") return 0;
  const m = [...s.devices, ...s.workloads].find((x) => x.id === k.machineId);
  const sockets = m && isServer(m) ? m.components.filter((p) => p.kind === "cpu").length : 0;
  const units = !m ? 1
    : era.kind === "core" ? (isServer(m) ? Math.max(installedCores(m), era.minCores ?? 0, (era.minCoresPerCpu ?? 0) * sockets) : m.vcpu)
    : era.kind === "gameserver" ? Math.max(0, (c ? accountsOn(s, c) : 0) - (era.free ?? 0)) : 1;
  return Math.round(era.fee * units * 100) / 100;
}

const keyCluster = (s: GameState, k: Licence): Cluster | undefined => s.clusters.find((x) => x.panel === k.product && panelMachine(x) === k.machineId);
// The edition a key renews as at the hour: its own while the vendor sells it, else the first one on sale that fits its accounts.
function renewalTier(s: GameState, k: Licence, hour: number): LicenceTier | undefined {
  const own = keyTiers(k.product).find((x) => x.id === k.edition), sale = tiersOnSale(k.product, hour);
  if (!own || sale.includes(own)) return own;
  const c = keyCluster(s, k), n = c ? accountsOn(s, c) : 0;
  return sale.find((x) => x.cap === null || n <= x.cap) ?? own;
}

// Hourly: every subscription key that is due renews from the bank, one ledger line each and one receipt per product. A key
// still unpaid after the grace days lapses; paid later, it runs a month from then. A cancelled key expires when its term ends.
// A key whose edition the vendor stopped selling renews as the edition that fits it, with a notice 30 days before.
export function renewKeys(s: GameState): void {
  const receipts = new Map<string, { count: number; amount: number }>();
  for (let k of s.licenses) {
    if (k.covers.kind !== "term") continue;
    if (k.renewsAt === null) {
      if (k.lapsedAt === null && s.hour >= k.covers.until) updateKey(s, k.id, { lapsedAt: k.covers.until });
      continue;
    }
    if (s.hour === k.renewsAt - 30 * 24) {
      const next = renewalTier(s, k, k.renewsAt), c = keyCluster(s, k);
      if (next && next.id !== k.edition) {
        const name = productOf(k.product)!.name, from = keyTiers(k.product).find((x) => x.id === k.edition)!.name;
        deliverMail(s, name, "licenceEditionChange", { name, key: k.key, from, to: next.name, amount: c ? tierFee(s, c, next) : next.fee });
      }
    }
    if (s.hour < k.renewsAt) continue;
    const renewsAt = k.renewsAt, next = renewalTier(s, k, s.hour);
    if (next && next.id !== k.edition) {
      updateKey(s, k.id, { edition: next.id, kind: next.kind });
      k = { ...k, edition: next.id, kind: next.kind };
    }
    const fee = keyFee(s, k), late = s.hour - renewsAt >= LAPSE_GRACE_DAYS * 24, name = productOf(k.product)!.name;
    if (spendable(s) >= fee) {
      extendKey(s, k.id, late ? s.hour : renewsAt);
      if (fee <= 0) continue;
      s.cash = Math.round((s.cash - fee) * 100) / 100;
      s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.licenceRenewal", params: { name, key: k.key }, amount: -fee }];
      const r = receipts.get(name) ?? { count: 0, amount: 0 };
      receipts.set(name, { count: r.count + 1, amount: Math.round((r.amount + fee) * 100) / 100 });
    } else if (late && k.lapsedAt === null) {
      updateKey(s, k.id, { lapsedAt: s.hour });
      deliverMail(s, name, "licenceLapsed", { name, key: k.key });
    }
  }
  for (const [name, r] of receipts) deliverMail(s, name, "licenceRenewed", { name, ...r });
}

// Charges a licence fee at once, as the monthly line does.
export function payLicence(s: GameState, c: Cluster, fee: number): void {
  if (fee <= 0) return;
  s.cash = Math.round((s.cash - fee) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.license", params: { cluster: c.name, name: softwareById((c.panel ?? c.platform)!).name }, amount: -fee }];
}

// Hourly: finishes software switches, opens incident reports for lost disks, runs backups, slows overloaded nodes, bills licenses.
export function productsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  finishSwitches(s, events);
  friendsArrive(s, events);
  reportLosses(s, events);
  runBackups(s, events);
  overload(s);
  renewKeys(s);
  if (isMonthStart(s.hour)) {
    monthlyReviews(s, events);
    billLicenses(s);
  }
  return events;
}
