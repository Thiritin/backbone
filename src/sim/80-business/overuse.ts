// economy.md, "Traffic overuse": a service that moves more traffic in a month than its plan includes, and the three answers.
import { marketRates } from "../10-catalog/products";
import { yearOf } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import { issueInvoice } from "../30-market/manual";
import { bump, createTicket, expandable, isFinal } from "../40-support/tickets";
import { logActivity } from "../47-staff/activity";
import type { GameState } from "../50-state";
import { serviceTrafficGb, TRAFFIC_WINDOW_HOURS } from "../60-infra/network";

export type OveruseChoice = "throttle" | "bill" | "upgrade";
export const THROTTLE_HAPPINESS = -10;
export const BILL_HAPPINESS = -5;

export interface Overuse { usedGb: number; includedGb: number; overGb: number }

// The month's traffic against the plan; null for a service without included traffic.
export function overuseOf(s: GameState, v: Service): Overuse | null {
  if (v.endedAt !== null || !(v.spec.trafficGb > 0)) return null;
  const usedGb = serviceTrafficGb(s, v), includedGb = v.spec.trafficGb;
  return { usedGb, includedGb, overGb: Math.max(0, Math.floor(usedGb - includedGb)) };
}

// A bill or an upgrade offer covers the month it went out in.
export const overuseHandled = (s: GameState, v: Service): boolean => v.overuseAt !== undefined && s.hour - v.overuseAt < TRAFFIC_WINDOW_HOURS;

// The player's rate per 100 GB for the line, or the market's.
export const trafficRate = (s: GameState, v: Service): number => s.rates[v.product]?.traffic ?? marketRates(v.product, yearOf(s.hour)).traffic ?? 0;
export const overageAmount = (s: GameState, v: Service, overGb: number): number => Math.round((overGb / 100) * trafficRate(s, v) * 100) / 100;

const liveCustomer = (s: GameState, v: Service) => s.customers.find((c) => c.id === v.customerId && c.churnedAt === null);
const setService = (s: GameState, id: string, patch: Partial<Service>) => {
  s.services = s.services.map((x) => (x.id === id ? { ...x, ...patch } : x));
};

// Applies one answer to a service over its traffic; returns the error key, or null when it went through.
export function answerOveruse(s: GameState, v: Service, choice: OveruseChoice, by: string | null = null): string | null {
  const c = liveCustomer(s, v), use = overuseOf(s, v);
  if (!c || !use) return "error.unknownService";
  if (choice === "throttle") {
    if (v.throttled) return "error.overuseHandled";
    setService(s, v.id, { throttled: true });
    bump(c, THROTTLE_HAPPINESS);
    logActivity(s, { customerId: c.id, serviceId: v.id, by, key: "activity.throttled", params: {}, minutes: 0 });
    return null;
  }
  if (use.overGb <= 0) return "error.noOveruse";
  if (overuseHandled(s, v)) return "error.overuseHandled";
  if (choice === "bill") {
    const amount = overageAmount(s, v, use.overGb);
    if (amount <= 0) return "error.noOveruse";
    issueInvoice(s, c.id, [{ serviceId: null, key: "invoice.line.trafficOverage", params: { label: v.label, gb: use.overGb }, amount }]);
    bump(c, BILL_HAPPINESS);
    logActivity(s, { customerId: c.id, serviceId: v.id, by, key: "activity.overageBilled", params: { price: amount }, minutes: 0 });
  } else {
    if (!expandable(v)) return "error.notExpandable";
    if (s.tickets.some((t) => t.serviceId === v.id && !isFinal(t))) return "error.overuseHandled";
    // The customer answers the offer with an upgrade request, which the sales flow quotes and closes.
    createTicket(s, c, "upgrade", v.id, "traffic");
  }
  setService(s, v.id, { overuseAt: s.hour });
  return null;
}

// Each day at noon, a set overusePolicy answers every service over its traffic that is not yet handled.
export function overuseTick(s: GameState): void {
  const choice = s.overusePolicy;
  if (!choice || s.hour % 24 !== 12) return;
  let copied = false;
  for (const v of s.services) {
    if (v.throttled || overuseHandled(s, v) || !liveCustomer(s, v)) continue;
    if ((overuseOf(s, v)?.overGb ?? 0) <= 0) continue;
    if (!copied) { s.customers = s.customers.map((c) => ({ ...c })); copied = true; }
    answerOveruse(s, s.services.find((x) => x.id === v.id)!, choice);
  }
}
