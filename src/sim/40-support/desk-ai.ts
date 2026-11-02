import { yearOf } from "../00-core/time";
import { chance } from "../00-core/rng";
import { cents } from "../45-billing/billing";
import { deskAiReady, deskHas, deskOf, type DeskAi } from "../10-catalog/desks";
import type { Customer } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { deskStatus } from "./desk";
import { deskNote, held, WEB_SHARE } from "./desk-work";
import { outgoing } from "./replies";
import { HOW_TO, rightTemplate, type Ticket } from "./tickets";

// economy/README.md, Desk AI. Share of the customers on the portal form who read a suggested article instead of writing in,
// share of basic how-to tickets the answer bot solves, and its fee per solved ticket.
export const ARTICLE_DEFLECT = 0.2;
export const ANSWER_BOT_SOLVE = 0.25;
export const ANSWER_BOT_FEE = 1;
export const BOT_NAME: Record<string, string> = { zendusk: "Answer Bot", freshdusk: "Freddie" };

// A feature the desk offers this year: hosted desks only.
export function aiOffered(s: GameState, a: DeskAi): boolean {
  const d = deskOf(s);
  return !!d && d.hosting === "hosted" && s.desk!.hosting.kind !== "self" && deskAiReady(d, a, yearOf(s.hour));
}
export const aiOn = (s: GameState, a: DeskAi): boolean => aiOffered(s, a) && !!s.desk!.ai.on[a] && deskStatus(s) !== "down";

// A customer about to write in on the portal form reads the suggested article instead.
export const articleDeflects = (s: GameState, topic: string): boolean =>
  !!HOW_TO[topic]?.basic && aiOn(s, "suggestedArticles") && deskHas(s, "portal") && chance(s.rng, WEB_SHARE * ARTICLE_DEFLECT);

const untouched = (t: Ticket, bot: string): boolean =>
  t.kind === "howTo" && !!t.topic && !!HOW_TO[t.topic]?.basic && t.status === "open" && !t.work && !t.replies.length && held(t) && !t.notes?.some((n) => n.by === bot);

// The answer bot replies with the topic's article to each new basic how-to ticket once. A solved ticket closes; any other
// keeps its due time and waits for an agent.
export function answerBot(s: GameState, customer: (id: string) => Customer, solve: (t: Ticket, c: Customer) => void): void {
  if (!aiOn(s, "answerBot")) return;
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

// Last month's solved tickets become one ledger line at the month start.
export function billDeskAi(s: GameState): void {
  if (!s.desk) return;
  const { solved } = s.desk.ai, amount = cents(solved * ANSWER_BOT_FEE);
  s.desk = { ...s.desk, ai: { ...s.desk.ai, solved: 0, tried: 0 } };
  if (amount <= 0) return;
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "ai", key: "ledger.answerBot", params: { n: solved }, amount: -amount }];
}
