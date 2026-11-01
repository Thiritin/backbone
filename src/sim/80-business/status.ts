// The company's status page: which product lines had an outage, a slowdown or an announced maintenance window each day.
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { coverage } from "../60-infra/maintenance";
import { workloadsUp } from "../60-infra/cluster";

export interface StatusDay { day: number; down: Product[]; slow: Product[]; maint: Product[] }
export type LineState = "ok" | "slow" | "down" | "maint";
export const STATUS_DAYS = 90;
export const STATUS_SHOWN = 30;
export const STATUS_FROM_YEAR = 2009;
export const STATUS_MIN_CUSTOMERS = 10;

// Worst state per line for the services in the given set of down ids; a down service inside an announced window is maintenance.
function states(s: GameState, down: Set<string>): Map<Product, LineState> {
  const rank: Record<LineState, number> = { ok: 0, slow: 1, maint: 2, down: 3 };
  const out = new Map<Product, LineState>();
  const raise = (p: Product, st: LineState) => { if (rank[st] > rank[out.get(p) ?? "ok"]) out.set(p, st); };
  for (const v of s.services) {
    if (v.endedAt !== null) continue;
    if (down.has(v.id)) raise(v.product, coverage(s, v) ? "maint" : "down");
    else if (v.slowedAt !== undefined && v.slowedAt >= s.hour - 1) raise(v.product, "slow");
  }
  return out;
}

// Called every hour with the services found down: adds the lines to today's entry.
export function recordStatus(s: GameState, down: string[]): void {
  const day = Math.floor(s.hour / 24);
  let cur = s.statusDays[s.statusDays.length - 1];
  if (!cur || cur.day !== day) {
    cur = { day, down: [], slow: [], maint: [] };
    s.statusDays = [...s.statusDays, cur].slice(-STATUS_DAYS);
  }
  const add = (list: Product[], p: Product) => { if (!list.includes(p)) list.push(p); };
  for (const [p, st] of states(s, new Set(down))) if (st !== "ok") add(cur[st === "maint" ? "maint" : st], p);
}

// The state of a line right now.
export function statusNow(s: GameState): Map<Product, LineState> {
  const ids = [...new Set(s.workloads.map((w) => w.serviceId))].filter((id) => !workloadsUp(s, id));
  return states(s, new Set(ids));
}

// One state per day for the last STATUS_SHOWN days up to today; days without a record count as fine.
export function statusBars(s: GameState, line: Product): LineState[] {
  const today = Math.floor(s.hour / 24);
  return Array.from({ length: STATUS_SHOWN }, (_, i) => {
    const e = s.statusDays.find((x) => x.day === today - STATUS_SHOWN + 1 + i);
    return !e ? "ok" : e.down.includes(line) ? "down" : e.maint.includes(line) ? "maint" : e.slow.includes(line) ? "slow" : "ok";
  });
}
