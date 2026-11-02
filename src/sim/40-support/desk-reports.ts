import { monthIndexOf } from "../00-core/time";
import { PROFILES } from "../10-catalog/economy";
import type { GameState } from "../50-state";
import { held, inDesk, OWNER } from "./desk-work";
import { isFinal, profileStats, replyDue, type Ticket, type TicketKind } from "./tickets";

// The tickets a desk reports on: what it holds, without junk and merged duplicates.
export const reportTickets = (s: GameState): Ticket[] =>
  s.tickets.filter((t) => inDesk(t) && held(t) && t.kind !== "spam" && t.outcome !== "spam" && t.outcome !== "merged");

// The first deadline, on the customer's clock: a wrong answer moves dueAt, the SLA counts from the opening.
export function firstDue(s: GameState, t: Ticket): number {
  const c = s.customers.find((x) => x.id === t.customerId);
  return c ? replyDue(c, t.createdAt) : t.dueAt;
}

// Hours to the first reply, or null while none went out.
export const firstResponse = (t: Ticket): number | null => (t.replies.length ? t.replies[0].hour - t.createdAt : null);

// Met when the first reply went out by the deadline, breached when it came later or the deadline passed without one,
// also when the customer gave up afterwards; null while still inside the deadline or closed unanswered before it.
export function slaMet(s: GameState, t: Ticket): boolean | null {
  const due = firstDue(s, t), first = t.replies[0]?.hour;
  if (first !== undefined) return first <= due;
  return (isFinal(t) ? t.updatedAt : s.hour) > due ? false : null;
}

export interface ReportRow { created: number; solved: number; firstResponse: number | null; slaHit: number | null }
export interface DeskReport extends ReportRow {
  byKind: Partial<Record<TicketKind, number>>;
  // Replies by employee name, the player under "owner".
  byAgent: Record<string, number>;
  // Months since year 0 (monthIndexOf) with their own row.
  byMonth: ({ month: number } & ReportRow)[];
}

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function row(s: GameState, ts: Ticket[]): ReportRow {
  const sla = ts.map((t) => slaMet(s, t)).filter((x): x is boolean => x !== null);
  return {
    created: ts.length,
    solved: ts.filter((t) => t.status === "resolved").length,
    firstResponse: avg(ts.map(firstResponse).filter((x): x is number => x !== null)),
    slaHit: sla.length ? sla.filter(Boolean).length / sla.length : null,
  };
}

// Tickets opened in [from, to) and what became of them.
export function deskReport(s: GameState, from: number, to: number): DeskReport {
  const ts = reportTickets(s).filter((t) => t.createdAt >= from && t.createdAt < to);
  const byKind: DeskReport["byKind"] = {}, byAgent: Record<string, number> = {}, months = new Map<number, Ticket[]>();
  for (const t of ts) {
    byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
    for (const r of t.replies) byAgent[r.by ?? OWNER] = (byAgent[r.by ?? OWNER] ?? 0) + 1;
    const m = monthIndexOf(t.createdAt);
    months.set(m, [...(months.get(m) ?? []), t]);
  }
  const byMonth = [...months].sort(([a], [b]) => a - b).map(([month, list]) => ({ month, ...row(s, list) }));
  return { ...row(s, ts), byKind, byAgent, byMonth };
}

// The SLA page: the response time each customer profile expects, and how many current customers have it.
export const slaPlans = (s: GameState) =>
  PROFILES.map((p) => ({ id: p.id, hours: p.reply.hours, clock: p.reply.clock, customers: s.customers.filter((c) => c.churnedAt === null && profileStats(c.profile).id === p.id).length }));
