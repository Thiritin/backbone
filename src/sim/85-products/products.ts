import { chance } from "../00-core/rng";
import { dateOf, isMonthStart } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { softwareById, type Software } from "../10-catalog/platforms";
import type { Customer } from "../30-customers/customers";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { controlPlaneUp, lostDisk, servedBy, type Cluster, type Workload } from "../60-infra/cluster";
import { phpTickets } from "../60-infra/php";
import { welcomeFriends } from "../90-actions/start";
import { raidUsable } from "../60-infra/status";
import { diskFill, nodeUsage } from "../60-infra/usage";
import { addReview, starsFor } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";

// Values from docs/design/economy.md, sections "Platforms and licenses" and "Data loss and backups".
export const LOSS_NO_BACKUP = -60;
export const LOSS_RESTORED = -15;
export const LOSS_RESTORED_MAX = -40;
export const REFUND_HAPPINESS = 20;
export const REVIEW_CHANCE = 0.1;
export const UNHAPPY_REVIEW_CHANCE = 0.2;
export const UNHAPPY = 40;
export const REFUND_THREE_STARS = 0.6;
// Backup jobs start at 02:00, weekly ones on Sundays; the pool holds a full copy plus the extra days kept.
export const BACKUP_HOUR = 2;
export const BACKUP_POOL = 1.3;
// GB moved per hour over a 1 Gbit/s link inside a zone and over the internet to another zone.
export const LAN_GB_PER_HOUR = 450;
export const WAN_GB_PER_HOUR = 45;
// Hourly chance per service on an overloaded node to write in, times the share of performance lost.
export const SLOW_TICKET_CHANCE = 0.1;

// One lost disk in an incident report. A customer without a backup asks for a refund (refund "open").
export interface LossItem {
  workloadId: string; serviceId: string; customerId: string; diskGb: number; backupAt: number | null;
  refund: "open" | "granted" | "declined" | "none"; restored: boolean;
}
// The incident report the game opens when a server's array is lost.
export interface LossReport { id: string; hour: number; deviceId: string; items: LossItem[] }

// The speed of the link between two zones in Gbit/s, 0 without one.
// ponytail: no links between zones exist yet; the network lane's leased wavelengths and dark fiber set this.
export const zoneLinkGbit = (_s: GameState, a: string, b: string): number => (a === b ? 1 : 0);

function units(s: GameState, c: Cluster, sw: Software): number {
  if (sw.pricing === "account") return s.workloads.filter((w) => w.clusterId === c.id && servedBy(s, w) === "panel").length;
  if (sw.pricing === "server") return c.nodes.length;
  if (sw.pricing === "core") return c.nodes.reduce((n, x) => n + (modelById(s.devices.find((d) => d.id === x.deviceId)?.model ?? "").server?.cores ?? 0), 0);
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
    return servedBy(s, w) === "panel" ? tickets(c.panel) * phpTickets(s, c) : tickets(c.platform);
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

// economy.md, Reviews: 10% write one, 20% when unhappy; a refunded customer gives 3 stars 60% of the time.
export function lossReview(s: GameState, c: Customer, refunded: boolean): void {
  if (!chance(s.rng, c.happiness < UNHAPPY ? UNHAPPY_REVIEW_CHANCE : REVIEW_CHANCE)) return;
  addReview(s, c.id, refunded && chance(s.rng, REFUND_THREE_STARS) ? 3 : starsFor(c.happiness, s.rng), "dataLoss");
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
    const { kind, to } = c.switching, fresh = !(kind === "panel" ? c.panel : c.platform);
    s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switching: null, ...(kind === "panel" ? { panel: to } : { platform: to }) } : x));
    events.push({ app: "Products", key: fresh ? "event.installed" : "event.switched", params: { cluster: c.name, name: softwareById(to).name } });
    if (kind === "panel" && welcomeFriends(s, c.id)) events.push({ app: "Customers", key: "event.friendsJoined", params: { cluster: c.name } });
  }
}

function reportLosses(s: GameState, events: SimEvent[]) {
  for (const d of s.devices) {
    if (d.dataLost === null || s.lossReports.some((r) => r.deviceId === d.id && r.hour === d.dataLost)) continue;
    const lost = s.workloads.filter((w) => w.deviceId === d.id && lostDisk(s, w));
    if (!lost.length) continue;
    const items = lost.map((w): LossItem => {
      const v = s.services.find((x) => x.id === w.serviceId)!;
      return { workloadId: w.id, serviceId: v.id, customerId: v.customerId, diskGb: w.diskGb, backupAt: w.backupAt, refund: w.backupAt === null ? "open" : "none", restored: false };
    });
    for (const it of items) if (it.backupAt === null) bump(customerCopy(s, it.customerId)!, LOSS_NO_BACKUP);
    s.lossReports = [...s.lossReports, { id: `loss${s.nextId++}`, hour: d.dataLost, deviceId: d.id, items }];
    events.push({ app: "Locations", key: "event.dataLoss", params: { device: d.label ?? d.name, count: items.length } });
  }
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

// Overloaded nodes slow every customer on them: happiness drops with the performance lost and some write in.
function overload(s: GameState) {
  for (const c of s.clusters) {
    for (const n of c.nodes) {
      const { perf } = nodeUsage(s, n.deviceId);
      if (perf >= 1) continue;
      for (const w of s.workloads.filter((x) => x.deviceId === n.deviceId && x.clusterId === c.id && !x.stopped)) {
        const v = s.services.find((x) => x.id === w.serviceId);
        const cus = v && customerCopy(s, v.customerId);
        if (!v || !cus) continue;
        bump(cus, -(1 - perf));
        if (s.tickets.some((t) => t.serviceId === v.id && !isFinal(t)) || !chance(s.rng, SLOW_TICKET_CHANCE * (1 - perf))) continue;
        createTicket(s, cus, "outage", v.id).topic = "slow";
      }
    }
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
  reportLosses(s, events);
  runBackups(s, events);
  overload(s);
  if (isMonthStart(s.hour)) billLicenses(s);
  return events;
}
