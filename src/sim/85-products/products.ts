import { chance } from "../00-core/rng";
import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { isService, softwareById, type Software } from "../10-catalog/platforms";
import { BACKUP_HOUR } from "../10-catalog/usage";
import { homeLineById } from "../20-world/datacenters";
import type { Customer, Product } from "../30-customers/customers";
import { bump, createTicket, slowed } from "../40-support/tickets";
import type { Device, GameState, Location } from "../50-state";
import { controlPlaneUp, hostOfVm, isOwnVm, lostDisk, servedBy, vmOf, type Cluster, type Workload } from "../60-infra/cluster";
import { exitsOf } from "../60-infra/network";
import { hostPerf, phpTickets } from "../60-infra/php";
import { welcomeFriends } from "../90-actions/start";
import { installedCores, perCoreOf, raidUsable } from "../60-infra/status";
import { diskFill, nodeUsage } from "../60-infra/usage";
import { addReview, starsFor } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";

// Values from docs/design/economy.md, sections "Platforms and licenses" and "Data loss and backups".
export const LOSS_NO_BACKUP = -60;
export const LOSS_RESTORED = -15;
export const LOSS_RESTORED_MAX = -40;
export const REVIEW_CHANCE = 0.1;
export const UNHAPPY_REVIEW_CHANCE = 0.2;
export const UNHAPPY = 40;
// Backup jobs start at BACKUP_HOUR, weekly ones on Sundays; the pool holds a full copy plus the extra days kept.
export const BACKUP_POOL = 1.3;
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

function units(s: GameState, c: Cluster, sw: Software): number {
  if (sw.pricing === "account") return s.workloads.filter((w) => w.clusterId === c.id && servedBy(s, w) === "panel").length;
  if (sw.pricing === "server") return c.kind === "cloud" ? c.nodes.length : 1;
  if (sw.pricing === "core") return c.nodes.reduce((n, x) => n + installedCores(s.devices.find((d) => d.id === x.deviceId)!), 0);
  return 0;
}
// The monthly license bill of a cluster's panel and platform.
export function licenseCost(s: GameState, c: Cluster): { panel: number; platform: number } {
  const cost = (id: string | null) => { if (!id) return 0; const sw = softwareById(id); return Math.round(sw.fee * units(s, c, sw) * 100) / 100; };
  return { panel: cost(c.panel), platform: cost(c.platform) };
}

const tickets = (id: string | null) => (id ? softwareById(id).tickets : 1);
// The how-to ticket rate factor of a customer: the average over their cluster workloads of the software serving each,
// with web spaces on an old PHP a little higher.
export function howToFactor(s: GameState, customerId: string): number {
  const services = new Set(s.services.filter((v) => v.customerId === customerId && v.endedAt === null).map((v) => v.id));
  const factors = s.workloads.filter((w) => w.clusterId && services.has(w.serviceId)).map((w) => {
    const c = s.clusters.find((x) => x.id === w.clusterId)!;
    const kind = servedBy(s, w);
    return kind === "panel" ? tickets(c.panel) * phpTickets(s, c) : tickets(isService(kind) ? c.panel : c.platform);
  });
  return factors.length ? factors.reduce((a, b) => a + b, 0) / factors.length : 1;
}

// Backup space a target cluster needs for every cluster backing up to it, and the free disk its nodes have.
export function backupPool(s: GameState, targetId: string): { need: number; room: number } {
  const target = s.clusters.find((c) => c.id === targetId);
  const sources = new Set(s.clusters.filter((c) => c.backup.targetId === targetId && c.backup.every !== "off").map((c) => c.id));
  const need = s.workloads.filter((w) => w.clusterId && sources.has(w.clusterId)).reduce((n, w) => n + w.diskGb * diskFill(s, w, s.hour) * BACKUP_POOL, 0);
  const room = (target?.nodes ?? []).reduce((n, x) => {
    const d = s.devices.find((y) => y.id === x.deviceId);
    return d ? n + raidUsable(d) - nodeUsage(s, d.id).used.diskGb : n;
  }, 0);
  return { need, room };
}

// Hours a restore of a workload takes from its cluster's backup target.
export function restoreHours(s: GameState, w: Workload): number {
  const c = s.clusters.find((x) => x.id === w.clusterId), target = c && s.clusters.find((x) => x.id === c.backup.targetId);
  const rate = target && target.az === c.az ? LAN_GB_PER_HOUR : WAN_GB_PER_HOUR;
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
    s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switching: null, version: yearOf(s.hour), updatedAt: s.hour, ...(kind === "cloud" ? { platform: to } : { panel: to }) } : x));
    events.push({ app: "Products", key: fresh ? "event.installed" : "event.switched", params: { cluster: c.name, name: softwareById(to).name } });
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
      .flatMap((w) => (isOwnVm(w) ? s.workloads.filter((x) => x.clusterId === hostOfVm(s, w.id)?.id) : [w]));
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

function runBackups(s: GameState, events: SimEvent[]) {
  const d = dateOf(s.hour);
  if (d.getUTCHours() !== BACKUP_HOUR) return;
  for (const c of s.clusters) {
    const target = s.clusters.find((x) => x.id === c.backup.targetId);
    if (c.backup.every === "off" || !target || (c.backup.every === "weekly" && d.getUTCDay() !== 0)) continue;
    const pool = backupPool(s, target.id);
    if (!controlPlaneUp(s, target) || pool.need > pool.room) {
      events.push({ app: "Products", key: "event.backupFailed", params: { cluster: c.name, target: target.name } });
      continue;
    }
    s.workloads = s.workloads.map((w) => (w.clusterId === c.id && !lostDisk(s, w) && w.busyUntil <= s.hour ? { ...w, backupAt: s.hour } : w));
  }
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
  const services = new Map(s.services.map((v) => [v.id, v]));
  for (const w of s.workloads) {
    const v = services.get(w.serviceId), perf = workloadPerf(s, w, v?.product, perfOf);
    if (perf >= 1) continue;
    const cus = v && customerCopy(s, v.customerId);
    if (!v || !cus) continue;
    slowed(s, cus, v.id, 1 - perf);
  }
}

function billLicenses(s: GameState) {
  const lines = s.clusters.flatMap((c) => {
    const cost = licenseCost(s, c);
    return ([["panel", c.panel], ["platform", c.platform]] as const)
      .filter(([k]) => cost[k] > 0)
      .map(([k, id]) => ({ hour: s.hour, category: "licenses", key: "ledger.license", params: { cluster: c.name, name: softwareById(id!).name }, amount: -cost[k] }));
  });
  if (!lines.length) return;
  s.cash = Math.round((s.cash + lines.reduce((n, l) => n + l.amount, 0)) * 100) / 100;
  s.ledger = [...s.ledger, ...lines];
}

// Hourly: finishes software switches, opens incident reports for lost disks, runs backups, slows overloaded nodes, bills licenses.
export function productsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  finishSwitches(s, events);
  friendsArrive(s, events);
  reportLosses(s, events);
  runBackups(s, events);
  overload(s);
  if (isMonthStart(s.hour)) billLicenses(s);
  return events;
}
