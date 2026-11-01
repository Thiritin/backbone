// economy.md, Account transfers: new web hosting customers sometimes arrive from another host and expect their site moved.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SalesRequest } from "../30-market/market";
import { siteBroken } from "./webpanel";

export interface Transfer { from: string; startedAt: number; doneAt: number; status: "running" | "done" | "failed" }

export const TRANSFER_FROM_YEAR = 2008;
export const TRANSFER_SHARE = 0.3;
export const TRANSFER_GB_PER_HOUR = 20;
export const TRANSFER_MINUTES = 15;
export const TRANSFER_MINUTES_PER_10GB = 5;
export const TRANSFER_FAIL = 0.05;
export const TRANSFER_FAIL_PHP = 0.15;
export const TRANSFER_QUICK_HOURS = 24;
export const TRANSFER_HAPPY = 3;

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// The old host a new web hosting order comes from, drawn with the order's own hash; undefined for orders without a transfer.
export function transferHost(s: GameState, r: Pick<SalesRequest, "id" | "kind" | "product" | "serviceId">): string | undefined {
  if (r.kind !== "order" || r.product !== "webHosting" || r.serviceId || yearOf(s.hour) < TRANSFER_FROM_YEAR) return undefined;
  const g = hashRng(s.seed, idNum(r.id), 313);
  return rand(g) < TRANSFER_SHARE ? `old-host-${1 + Math.floor(rand(g) * 99)}.example` : undefined;
}

export const transferHours = (diskGb: number): number => Math.max(1, Math.ceil(diskGb / TRANSFER_GB_PER_HOUR));
export const transferMinutes = (diskGb: number): number => TRANSFER_MINUTES + TRANSFER_MINUTES_PER_10GB * Math.ceil(diskGb / 10);

// Hourly: a transfer that reached its hour ends; it breaks now and then, more often when the host's PHP is behind the app.
export function transferTick(s: GameState): void {
  const live = new Set(s.services.filter((v) => v.endedAt === null).map((v) => v.id));
  const all = Object.entries(s.webpanel.transfers), kept = all.filter(([id]) => live.has(id));
  if (kept.length !== all.length) s.webpanel = { ...s.webpanel, transfers: Object.fromEntries(kept) };
  for (const [id, x] of kept) {
    if (x.status !== "running" || x.doneAt > s.hour) continue;
    const v = s.services.find((y) => y.id === id)!, c = s.clusters.find((y) => s.workloads.some((w) => w.serviceId === id && w.clusterId === y.id));
    const behind = !!c && siteBroken(s, c, id);
    const failed = rand(hashRng(s.seed, idNum(id), x.startedAt, 314)) < (behind ? TRANSFER_FAIL_PHP : TRANSFER_FAIL);
    s.webpanel = { ...s.webpanel, transfers: { ...s.webpanel.transfers, [id]: { ...x, status: failed ? "failed" : "done" } } };
    const cust = s.customers.find((y) => y.id === v.customerId);
    if (!cust) continue;
    if (failed) {
      if (!s.tickets.some((t) => t.serviceId === id && t.topic === "transferFailed" && !isFinal(t))) createTicket(s, cust, "howTo", id, "transferFailed");
    } else if (x.doneAt - v.startedAt <= TRANSFER_QUICK_HOURS) {
      s.customers = s.customers.map((y) => { if (y.id !== cust.id) return y; const n = { ...y }; bump(n, TRANSFER_HAPPY); return n; });
    }
  }
}
