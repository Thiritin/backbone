// economy.md, Happiness and churn: planned maintenance windows. Customers told a day ahead lose nothing to downtime inside
// the window; a late announcement halves what it costs them.
import { dateOf } from "../00-core/time";
import type { Customer, Service } from "../30-customers/customers";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { serverOf, vmOf, workloadsOf, type Workload } from "./cluster";
import { locationOf } from "./status";

export interface MaintenanceTarget { kind: "device" | "cluster" | "location"; id: string }
export interface Maintenance { id: string; target: MaintenanceTarget; from: number; hours: number; notifiedAt: number; customerIds: string[] }

// A window announced at least this many hours ahead removes the penalties; a later one halves them.
export const NOTICE_HOURS = 24;
export const LATE_FACTOR = 0.5;
export const START_CHOICES = ["tonight", "tomorrow", "weekend"] as const;
export const LENGTHS = [2, 4, 8] as const;
export type StartChoice = (typeof START_CHOICES)[number];

// The start choices are 01:00: the next night, the night after, and the next Friday night (Saturday 01:00).
export function startOf(choice: StartChoice, hour: number): number {
  let h = hour + 1;
  while (dateOf(h).getUTCHours() !== 1) h++;
  if (choice === "tomorrow") return h + 24;
  while (choice === "weekend" && dateOf(h).getUTCDay() !== 6) h += 24;
  return h;
}

export function targetName(s: GameState, t: MaintenanceTarget): string {
  if (t.kind === "cluster") return s.clusters.find((c) => c.id === t.id)?.name ?? "";
  if (t.kind === "location") return s.locations.find((l) => l.id === t.id)?.name ?? "";
  const d = s.devices.find((x) => x.id === t.id);
  return d ? d.label ?? d.name : "";
}

const hits = (s: GameState, w: Workload, t: MaintenanceTarget): boolean => {
  const dev = serverOf(s, w);
  if (t.kind === "device") return dev === t.id;
  if (t.kind === "cluster") return w.clusterId === t.id || vmOf(s, w)?.clusterId === t.id;
  const d = dev ? s.devices.find((x) => x.id === dev) : undefined;
  return (d ? locationOf(s, d)?.id : s.racks.find((r) => r.id === w.rackId)?.locationId) === t.id;
};

export type Reaction = "accepts" | "asksMove" | "declines";
export interface Impact { service: Service; customer: Customer; reaction: Reaction }

// Shops ask to move a window that touches weekday shopping hours; gamers decline Friday and Saturday nights.
function reactionOf(c: Customer, from: number, hours: number): Reaction {
  if (c.profile === "onlineShop") {
    for (let h = from; h < from + hours; h++) {
      const d = dateOf(h), day = d.getUTCDay(), hour = d.getUTCHours();
      if (day >= 1 && day <= 5 && hour >= 8 && hour < 20) return "asksMove";
    }
  }
  const hour = dateOf(from).getUTCHours();
  if (c.profile === "gamer" && (hour >= 17 || hour < 9) && [5, 6].includes(dateOf(from - 9).getUTCDay())) return "declines";
  return "accepts";
}

// Every live service with a workload on the target, with its customer's reaction to a window at from.
export function impact(s: GameState, target: MaintenanceTarget, from: number, hours: number): Impact[] {
  return s.services.flatMap((service) => {
    const customer = s.customers.find((c) => c.id === service.customerId);
    if (service.endedAt !== null || !customer || customer.churnedAt !== null) return [];
    if (!workloadsOf(s, service.id).some((w) => hits(s, w, target))) return [];
    return [{ service, customer, reaction: reactionOf(customer, from, hours) }];
  });
}

// The penalty share a service keeps during the current hour (0 inside an announced window, half after a late announcement)
// and the hour the covering window ends.
export function coverage(s: GameState, v: Service): { factor: number; end: number } | null {
  let best: { factor: number; end: number } | null = null;
  for (const m of s.maintenance) {
    if (s.hour < m.from || s.hour >= m.from + m.hours || !m.customerIds.includes(v.customerId)) continue;
    if (!workloadsOf(s, v.id).some((w) => hits(s, w, m.target))) continue;
    const factor = m.from - m.notifiedAt >= NOTICE_HOURS ? 0 : LATE_FACTOR;
    if (!best || factor < best.factor) best = { factor, end: m.from + m.hours };
  }
  return best;
}

export const maintParams = (m: { from: number; hours: number }): Record<string, number> => {
  const d = dateOf(m.from);
  return { weekday: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth(), from: d.getUTCHours(), to: dateOf(m.from + m.hours).getUTCHours(), hours: m.hours };
};

// Hourly: announces the start and end of a window and drops windows that are over.
export function maintenanceTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const m of s.maintenance) {
    if (m.from === s.hour) events.push({ app: "Locations", key: "event.maintenanceStart", params: { where: targetName(s, m.target), hours: m.hours } });
    if (m.from + m.hours === s.hour) events.push({ app: "Locations", key: "event.maintenanceEnd", params: { where: targetName(s, m.target) } });
  }
  if (s.maintenance.some((m) => m.from + m.hours <= s.hour)) s.maintenance = s.maintenance.filter((m) => m.from + m.hours > s.hour);
  return events;
}
