// GDD, Infrastructure consoles: mailbox quotas and OwnClod per-user quotas. Numbers in economy.md, Tickets and work rates.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import { createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { nodeCapacity } from "./cluster";

export type QuotaKind = "mailbox" | "cloud";
export interface QuotaState { perUserMb: number; usedMb: number }

// Corner points (year, MB) of the era default; the quota is a straight line between them and flat after the last.
const CURVES: Record<QuotaKind, [number, number][]> = {
  mailbox: [[2005, 50], [2012, 1000], [2020, 5000], [2026, 15000]],
  cloud: [[2010, 1000], [2016, 5000], [2024, 20000]],
};
export const defaultQuotaMb = (kind: QuotaKind, year: number): number => {
  const pts = CURVES[kind];
  if (year <= pts[0][0]) return pts[0][1];
  const i = pts.findIndex(([y]) => year < y);
  if (i < 0) return pts[pts.length - 1][1];
  const [y0, v0] = pts[i - 1], [y1, v1] = pts[i];
  return Math.round(v0 + ((v1 - v0) * (year - y0)) / (y1 - y0));
};

export const quotaKind = (v: Service): QuotaKind | null => (v.product === "webHosting" && v.spec.mailboxes > 0 ? "mailbox" : v.product === "storage" ? "cloud" : null);
export const quotaUsers = (v: Service): number => (quotaKind(v) === "mailbox" ? v.spec.mailboxes : Math.max(3, Math.round(v.spec.diskGb / 2)));
export const quotaOf = (s: GameState, v: Service): QuotaState => s.netsvc.quotas[v.id] ?? { perUserMb: defaultQuotaMb(quotaKind(v) ?? "mailbox", yearOf(v.startedAt)), usedMb: 0 };
export const quotaCapMb = (s: GameState, v: Service): number => quotaOf(s, v).perUserMb * quotaUsers(v);
const topicOf = (v: Service) => (quotaKind(v) === "mailbox" ? "mailFull" : "quotaFull");

// The disk a quota books on its host: a typical fill of a quarter of it.
const bookedGb = (s: GameState, v: Service, perUserMb = quotaOf(s, v).perUserMb): number => (quotaUsers(v) * perUserMb * 0.25) / 1024;
const hostOf = (s: GameState, v: Service) => s.workloads.find((w) => w.serviceId === v.id)?.clusterId;

// Whether the quotas of all services on the host fit its disk once this service gets the given quota.
export function quotaFits(s: GameState, v: Service, perUserMb: number): boolean {
  const host = hostOf(s, v), cluster = s.clusters.find((c) => c.id === host);
  if (!cluster) return true;
  const disk = cluster.nodes.reduce((n, x) => n + nodeCapacity(s.devices.find((d) => d.id === x.deviceId)!, s).diskGb, 0);
  const others = s.services.filter((x) => x.id !== v.id && x.endedAt === null && quotaKind(x) && hostOf(s, x) === host).reduce((n, x) => n + bookedGb(s, x), 0);
  return others + bookedGb(s, v, perUserMb) <= disk;
}

// Monthly: stored mail and files grow; a full quota makes the customer write in once.
export function quotaTick(s: GameState): void {
  const quotas = { ...s.netsvc.quotas };
  for (const v of s.services) {
    const kind = quotaKind(v), cust = s.customers.find((c) => c.id === v.customerId);
    if (!kind || v.endedAt !== null || !cust || cust.churnedAt !== null) continue;
    const r = hashRng(s.seed, s.hour, Number(v.id.replace(/\D/g, "")), 283), cur = quotaOf(s, v), cap = cur.perUserMb * quotaUsers(v);
    let used = cur.usedMb + cap * 0.08 * (0.5 + rand(r));
    if (rand(r) < 0.1) used /= 2;
    used = Math.min(cap, used);
    quotas[v.id] = { perUserMb: cur.perUserMb, usedMb: used };
    if (used >= 0.95 * cap && !s.tickets.some((t) => t.serviceId === v.id && t.topic === topicOf(v) && !isFinal(t))) createTicket(s, cust, "howTo", v.id, topicOf(v));
  }
  s.netsvc = { ...s.netsvc, quotas };
}
