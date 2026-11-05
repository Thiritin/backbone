import { yearOf } from "../00-core/time";
import { chance, rand } from "../00-core/rng";
import { cents } from "../45-billing/billing";
import { deskAiReady, deskHas, deskOf, type DeskAi } from "../10-catalog/desks";
import { monthlySalary, STAFF_HOURS_PER_MONTH, TICKET_MINUTES, tasksPerHour } from "../10-catalog/economy";
import type { Customer } from "../30-customers/customers";
import { bill, invoice } from "../46-finance/payables";
import type { GameState } from "../50-state";
import { deskStatus, newDeskAiUsage } from "./desk";
import { deskNote, held, WEB_SHARE } from "./desk-work";
import { outgoing } from "./replies";
import { HOW_TO, rightTemplate, templatesOf, type Ticket } from "./tickets";

// economy/pear-one-subscriptions.md, Support desks. Share of the customers on the portal form who read a suggested article
// instead of writing in, share of basic how-to tickets the answer bot solves, and its fee per solved ticket.
export const ARTICLE_DEFLECT = 0.2;
export const ANSWER_BOT_SOLVE = 0.25;
export const ANSWER_BOT_FEE = 1;
// The monthly add-on fee while auto-answer or drafting is on.
export const DESK_AI_FEE = 50;
export const BOT_NAME: Record<string, string> = { zendusk: "Answer Bot", freshdusk: "Freddie" };
// The generative agent: listed with the staff as a bot under this id.
export const DESK_AGENT = "deskAi";
export const AGENT_NAME: Record<string, string> = { zendusk: "Zendusk AI agent", freshdusk: "Freddie AI Agent" };
export const GENERATIVE: DeskAi[] = ["autoAnswer", "drafting"];

// economy/staff-salaries-skill-growth-and-quitting.md, Desk AI usage. Every generative reply and draft is billed in
// tokens, and each one rereads the whole thread.
export type AiKind = "howTo" | "billing";
export const BOT_RIGHT: Record<AiKind, number> = { howTo: 0.6, billing: 0.5 };
// After this many replies of its own the agent leaves the ticket to the humans, and the customer resents the runaround.
export const BOT_TRIES = 4;
export const BOT_RUNAROUND = -10;
export const BASE_TOKENS = 6000;
export const THREAD_TOKENS = 3000;
// Price per million tokens falls 15% a year while each model generation reads and reasons 18% more per reply; flat after 2026.
const years = (year: number) => Math.min(Math.max(year, 2005), 2026) - 2005;
export const pricePerMTokens = (year: number): number => 280 * 0.85 ** years(year);
export const attemptTokens = (replies: number, year: number): number => Math.round((BASE_TOKENS + THREAD_TOKENS * replies) * 1.18 ** years(year));
export const tokenCost = (tokens: number, year: number): number => (tokens * pricePerMTokens(year)) / 1e6;

// Expected replies and tokens (at 2005 size) per ticket of a kind, and the share solved before the agent gives up.
export function botOdds(kind: AiKind): { attempts: number; tokens: number; solved: number } {
  let attempts = 0, tokens = 0, reach = 1;
  for (let k = 0; k < BOT_TRIES; k++) {
    attempts += reach;
    tokens += reach * (BASE_TOKENS + THREAD_TOKENS * k);
    reach *= 1 - BOT_RIGHT[kind];
  }
  return { attempts, tokens, solved: 1 - reach };
}
export const costPerTicket = (kind: AiKind, year: number): number => tokenCost(botOdds(kind).tokens * 1.18 ** years(year), year);
export const costPerSolved = (kind: AiKind, year: number): number => costPerTicket(kind, year) / botOdds(kind).solved;
// A full-time skill-50 support agent's salary over the tickets they solve in a month.
export const agentCostPerSolved = (year: number): number =>
  monthlySalary("support", 50, year) / (STAFF_HOURS_PER_MONTH * tasksPerHour(TICKET_MINUTES, 50) * (0.75 + 0.25 * 0.5));

// A feature the desk offers this year: hosted desks only.
export function aiOffered(s: GameState, a: DeskAi): boolean {
  const d = deskOf(s);
  return !!d && d.hosting === "hosted" && s.desk!.hosting.kind !== "self" && deskAiReady(d, a, yearOf(s.hour));
}
export const aiOn = (s: GameState, a: DeskAi): boolean => aiOffered(s, a) && !!s.desk!.ai.on[a] && deskStatus(s) !== "down";
export const agentName = (s: GameState): string | null => (aiOn(s, "autoAnswer") ? AGENT_NAME[s.desk!.id] : null);

// A customer about to write in on the portal form reads the suggested article instead.
export const articleDeflects = (s: GameState, topic: string): boolean =>
  !!HOW_TO[topic]?.basic && aiOn(s, "suggestedArticles") && deskHas(s, "portal") && chance(s.rng, WEB_SHARE * ARTICLE_DEFLECT);

const untouched = (t: Ticket, bot: string): boolean =>
  t.kind === "howTo" && !!t.topic && !!HOW_TO[t.topic]?.basic && t.status === "open" && !t.work && !t.replies.length && held(t) && !t.notes?.some((n) => n.by === bot);

// The answer bot replies with the topic's article to each new basic how-to ticket once. A solved ticket closes; any other
// keeps its due time and waits for an agent. Auto-answer replaces it while on.
export function answerBot(s: GameState, customer: (id: string) => Customer, solve: (t: Ticket, c: Customer) => void): void {
  if (!aiOn(s, "answerBot") || aiOn(s, "autoAnswer")) return;
  const bot = BOT_NAME[s.desk!.id];
  for (const t of s.tickets) {
    const c = untouched(t, bot) ? customer(t.customerId) : undefined;
    if (!c || c.churnedAt !== null) continue;
    const ai = s.desk!.ai;
    if (!chance(s.rng, ANSWER_BOT_SOLVE)) {
      deskNote(s, t, "desk.note.botTried", {}, bot);
      s.desk = { ...s.desk!, ai: { ...ai, tried: ai.tried + 1 } };
      continue;
    }
    const template = rightTemplate(s, t);
    t.replies = [...t.replies, { hour: s.hour, template, right: true, ...outgoing(s, t, c, `tpl.${template}`), by: bot }];
    deskNote(s, t, "desk.note.botSolved", {}, bot);
    s.kbReads = { ...s.kbReads, [t.topic!]: (s.kbReads[t.topic!] ?? 0) + 1 };
    s.desk = { ...s.desk!, ai: { ...ai, solved: ai.solved + 1 } };
    solve(t, c);
  }
}

// Books one generative reply or draft on a thread that already holds `replies` replies.
export function billAttempt(s: GameState, replies: number, solved: boolean, year: number, draft = false): void {
  if (!s.desk) return;
  const tokens = attemptTokens(replies, year), u = s.desk.ai.usage;
  const usage = { attempts: u.attempts + (draft ? 0 : 1), tokens: u.tokens + tokens, cost: u.cost + tokenCost(tokens, year), solved: u.solved + (solved ? 1 : 0), drafts: u.drafts + (draft ? 1 : 0) };
  s.desk = { ...s.desk, ai: { ...s.desk.ai, usage } };
}

// Every open how-to and billing ticket of the desk gets a draft for its next reply: the right one with the agent's odds,
// otherwise another reply of the same ticket.
export function draftReplies(s: GameState): void {
  if (!aiOn(s, "drafting")) return;
  const year = yearOf(s.hour);
  for (const t of s.tickets) {
    if ((t.kind !== "howTo" && t.kind !== "billing") || t.status !== "open" || t.work || !held(t) || t.draft?.replies === t.replies.length) continue;
    const right = rightTemplate(s, t), others = templatesOf(t).filter((x) => x !== right);
    const template = chance(s.rng, BOT_RIGHT[t.kind]) || !others.length ? right : others[Math.floor(rand(s.rng) * others.length)];
    t.draft = { template, replies: t.replies.length };
    billAttempt(s, t.replies.length, false, year, true);
  }
}
export const draftOf = (t: Ticket): string | null => (t.draft && t.draft.replies === t.replies.length && t.status === "open" ? t.draft.template : null);

// At the month start: last month's answer bot resolutions and generative tokens, and the add-on for the month ahead.
export function billDeskAi(s: GameState): void {
  if (!s.desk) return;
  const { solved, usage } = s.desk.ai, fees = cents(solved * ANSWER_BOT_FEE), tokens = cents(usage.cost);
  const addon = GENERATIVE.some((a) => aiOn(s, a)) ? DESK_AI_FEE : 0;
  s.desk = { ...s.desk, ai: { ...s.desk.ai, solved: 0, tried: 0, usage: newDeskAiUsage() } };
  const lines: { key: string; params: Record<string, string | number>; amount: number }[] = [
    { key: "ledger.answerBot", params: { n: solved }, amount: fees },
    { key: "ledger.deskAi", params: { attempts: usage.attempts, drafts: usage.drafts, tokens: usage.tokens }, amount: tokens },
    { key: "ledger.deskAiAddon", params: { name: deskOf(s)!.name }, amount: addon },
  ];
  const owed = lines.filter((l) => l.amount > 0).map((l) => ({ hour: s.hour, category: "ai" as const, key: l.key, params: l.params, amount: -l.amount }));
  if (!owed.length) return;
  const name = deskOf(s)!.name;
  if (s.bank) invoice(s, "services", name, owed);
  else bill(s, { supplier: "services", name, lines: owed, method: "cash" });
}
