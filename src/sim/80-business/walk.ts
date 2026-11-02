// The Pear mail about the bank's overdraft, sent once when cash runs low.
import type { Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

export const OVERDRAFT = "overdraft";
export const WALK_HOUR = 9;

// What the last 30 days cost, without hardware bought once.
const runningCosts = (s: GameState) =>
  s.ledger.filter((e) => e.amount < 0 && e.category !== "hardware" && e.hour > s.hour - 730).reduce((sum, e) => sum - e.amount, 0);

const pearMail = (s: GameState, topic: string): void => {
  const mail: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "pear", topic, status: "open",
    createdAt: s.hour, dueAt: s.hour + 7 * 24, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, mail];
};

export function walkTick(s: GameState): SimEvent[] {
  if (!s.registration || s.hour % 24 !== WALK_HOUR) return [];
  if (!s.arrived.includes(OVERDRAFT) && s.cash < 2 * runningCosts(s)) {
    s.arrived = [...s.arrived, OVERDRAFT];
    pearMail(s, OVERDRAFT);
  }
  return [];
}
