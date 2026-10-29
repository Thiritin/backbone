import { cents } from "../45-billing/billing";
import { monthlySalary, STAFF_HOURS_PER_MONTH, TICKET_MINUTES, tasksPerHour } from "../10-catalog/economy";
import type { GameState } from "../50-state";

// economy.md, ChadGPT usage. ChadGPT bills every reply it sends in tokens, and each reply rereads the whole thread.
export type ChadKind = "howTo" | "billing";
export const BOT_RIGHT: Record<ChadKind, number> = { howTo: 0.6, billing: 0.5 };
// After this many replies of its own the bot leaves the ticket to the humans, and the customer resents the runaround.
export const BOT_TRIES = 4;
export const BOT_RUNAROUND = -10;
export const BASE_TOKENS = 6000;
export const THREAD_TOKENS = 3000;
// Price per million tokens falls 15% a year while each model generation reads and reasons 18% more per reply; flat after 2026.
const years = (year: number) => Math.min(Math.max(year, 2005), 2026) - 2005;
export const pricePerMTokens = (year: number): number => 280 * 0.85 ** years(year);
export const attemptTokens = (replies: number, year: number): number => Math.round((BASE_TOKENS + THREAD_TOKENS * replies) * 1.18 ** years(year));
export const tokenCost = (tokens: number, year: number): number => (tokens * pricePerMTokens(year)) / 1e6;

export interface ChadUsage { attempts: number; tokens: number; cost: number; solved: number }
export const newChadUsage = (): ChadUsage => ({ attempts: 0, tokens: 0, cost: 0, solved: 0 });

// Books one reply on a thread that already holds `replies` replies.
export function billAttempt(s: GameState, replies: number, solved: boolean, year: number): void {
  const tokens = attemptTokens(replies, year), u = s.chadUsage;
  s.chadUsage = { attempts: u.attempts + 1, tokens: u.tokens + tokens, cost: u.cost + tokenCost(tokens, year), solved: u.solved + (solved ? 1 : 0) };
}

// Last month's usage becomes one ledger line at the month start.
export function billChadUsage(s: GameState): void {
  const u = s.chadUsage, amount = cents(u.cost);
  s.chadUsage = newChadUsage();
  if (amount <= 0) return;
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "ai", key: "ledger.chadUsage", params: { attempts: u.attempts, tokens: u.tokens }, amount: -amount }];
}

// Expected replies and tokens (at 2005 size) per ticket of a kind, and the share solved before the bot gives up.
export function botOdds(kind: ChadKind): { attempts: number; tokens: number; solved: number } {
  let attempts = 0, tokens = 0, reach = 1;
  for (let k = 0; k < BOT_TRIES; k++) {
    attempts += reach;
    tokens += reach * (BASE_TOKENS + THREAD_TOKENS * k);
    reach *= 1 - BOT_RIGHT[kind];
  }
  return { attempts, tokens, solved: 1 - reach };
}
export const costPerTicket = (kind: ChadKind, year: number): number => tokenCost(botOdds(kind).tokens * 1.18 ** years(year), year);
export const costPerSolved = (kind: ChadKind, year: number): number => costPerTicket(kind, year) / botOdds(kind).solved;

// A full-time skill-50 support agent's salary over the tickets they solve in a month.
export const agentCostPerSolved = (year: number): number =>
  monthlySalary("support", 50, year) / (STAFF_HOURS_PER_MONTH * tasksPerHour(TICKET_MINUTES, 50) * (0.75 + 0.25 * 0.5));
