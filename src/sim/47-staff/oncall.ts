import { dateOf, hourOf, isMonthStart } from "../00-core/time";
import { rightTemplate } from "../40-support/tickets";
import { cents } from "../45-billing/billing";
import type { GameState, LedgerEntry } from "../50-state";
import { attackMbps } from "../60-infra/network";
import type { SimEvent } from "../88-tick/tick";
import { setBlackhole } from "../90-actions/network";
import type { Employee } from "./staff";

// economy.md, On-call duty. Pay this month per employee id; name kept for the payroll line after someone leaves.
export interface OnCallPay { name: string; days: number; allowance: number; callOuts: number; hours: number; callPay: number }
// roster: technicians in the rotation, in the order they joined; each location rotates through its own.
// lastCall: the last hour each technician worked on call, which starts their rest.
export interface OnCall { roster: string[]; lastCall: Record<string, number>; month: Record<string, OnCallPay> }

const WEEK = 168;
// Duty hands over on Mondays at 09:00; 3 Jan 2005 is the first Monday.
const HANDOVER = hourOf(new Date(Date.UTC(2005, 0, 3, 9)));
export const MONTHLY_HOURS = 173;
export const REST_HOURS = 11;
export const ALLOWANCE = { weekday: 2, weekend: 4 };
export const OVERTIME = 1.3;
export const NIGHT = 0.2;
export const SUNDAY = 0.25;
// The day's on-call period starts when the office closes.
const PERIOD_START = 17;

export const hourlyWage = (e: Employee): number => e.salary / MONTHLY_HOURS;
// Night is 21:00 to 06:00.
export function callOutRate(hour: number): number {
  const d = dateOf(hour), h = d.getUTCHours();
  return OVERTIME + (h >= 21 || h < 6 ? NIGHT : 0) + (d.getUTCDay() === 0 ? SUNDAY : 0);
}
const allowanceRate = (hour: number): number => ([0, 6].includes(dateOf(hour).getUTCDay()) ? ALLOWANCE.weekend : ALLOWANCE.weekday);

export const rotation = (s: GameState, locationId: string): Employee[] =>
  s.onCall.roster.map((id) => s.staff.find((e) => e.id === id)).filter((e): e is Employee =>
    !!e && e.role === "technician" && e.location === locationId && e.trained.includes("hardware"));
export function onCallAt(s: GameState, locationId: string, hour: number): Employee | undefined {
  const list = rotation(s, locationId);
  if (!list.length) return undefined;
  const week = Math.floor((hour - HANDOVER) / WEEK);
  return list[((week % list.length) + list.length) % list.length];
}
// Rest of 11 hours after the last call-out hour ends.
export const restUntil = (s: GameState, e: Employee): number => (s.onCall.lastCall[e.id] ?? -Infinity) + 1 + REST_HOURS;

const payOf = (s: GameState, e: Employee): OnCallPay => s.onCall.month[e.id] ?? { name: e.name, days: 0, allowance: 0, callOuts: 0, hours: 0, callPay: 0 };
const setPay = (s: GameState, e: Employee, p: OnCallPay) => { s.onCall = { ...s.onCall, month: { ...s.onCall.month, [e.id]: p } }; };

// One hour on call: a new call-out unless the previous hour was one too, paid as overtime with surcharges.
export function callOut(s: GameState, e: Employee): void {
  const p = payOf(s, e), fresh = s.onCall.lastCall[e.id] !== s.hour - 1;
  setPay(s, e, { ...p, callOuts: p.callOuts + (fresh ? 1 : 0), hours: p.hours + 1, callPay: cents(p.callPay + hourlyWage(e) * callOutRate(s.hour)) });
  s.onCall = { ...s.onCall, lastCall: { ...s.onCall.lastCall, [e.id]: s.hour } };
}

// A saturating attack at the location gets blackholed; otherwise open abuse reports get the right reply, two per hour.
export function respond(s: GameState, e: Employee, events: SimEvent[]): boolean {
  const loc = e.location!;
  const attacks = s.techRules.blackhole && s.network.saturated.includes(loc) ? s.network.attacks.filter((a) => a.locationId === loc && attackMbps(s, a) > 0) : [];
  if (attacks.length) {
    for (const a of attacks) setBlackhole(s, a.id, true);
    events.push({ app: "Staff", key: "event.onCallBlackhole", params: { name: e.name, location: s.locations.find((l) => l.id === loc)!.name } });
    return true;
  }
  const churned = new Set(s.customers.filter((c) => c.churnedAt !== null).map((c) => c.id));
  const abuse = s.tickets.filter((t) => t.kind === "abuse" && t.status === "open" && !t.work && !churned.has(t.customerId)).slice(0, 2);
  if (!abuse.length) return false;
  s.tickets = s.tickets.map((t) => {
    const i = abuse.indexOf(t);
    return i < 0 ? t : { ...t, unread: false, work: { op: "reply", arg: rightTemplate(s, t), doneAt: s.hour * 60 + 30 * (i + 1), by: e.name } };
  });
  events.push({ app: "Staff", key: "event.onCallAbuse", params: { name: e.name, count: abuse.length } });
  return true;
}

// Month start pays last month's allowance and call-outs as their own payroll lines; at 17:00 each on-call technician earns the day's allowance.
export function onCallPayroll(s: GameState): void {
  if (isMonthStart(s.hour)) {
    const lines = Object.values(s.onCall.month).flatMap((p): LedgerEntry[] => [
      ...(p.allowance > 0 ? [{ hour: s.hour, category: "salaries", key: "ledger.onCallAllowance", params: { name: p.name, days: p.days }, amount: -p.allowance }] : []),
      ...(p.callPay > 0 ? [{ hour: s.hour, category: "salaries", key: "ledger.callOuts", params: { name: p.name, count: p.callOuts, hours: p.hours }, amount: -p.callPay }] : []),
    ]);
    s.cash = cents(lines.reduce((sum, l) => sum + l.amount, s.cash));
    s.ledger = [...s.ledger, ...lines];
    s.onCall = { ...s.onCall, month: {} };
  }
  if (dateOf(s.hour).getUTCHours() !== PERIOD_START) return;
  for (const l of s.locations) {
    const e = onCallAt(s, l.id, s.hour);
    if (!e) continue;
    const p = payOf(s, e);
    setPay(s, e, { ...p, days: p.days + 1, allowance: cents(p.allowance + hourlyWage(e) * allowanceRate(s.hour)) });
  }
}
