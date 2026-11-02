// GDD, Replies: every answer and action on a ticket or order goes out as an email in the company's voice.
import { hashRng, rand } from "../00-core/rng";
import { updatePrice } from "../10-catalog/apps";
import { cleanupPrice } from "../60-infra/apps";
import { companyDomain } from "../30-customers/domains";
import { serviceFqdn } from "../30-customers/hostnames";
import type { Customer } from "../30-customers/customers";
import { EXTENSION_DAYS } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { senderName, TAKEDOWN_HOURS } from "./notices";
import { monthlyValue, type Reply, type Ticket } from "./tickets";

// Each outgoing email has this many wordings in en.ts (reply.<what>.0 to .2).
export const REPLY_VARIANTS = 3;
export const PERSONS = ["private", "gamer", "hobbyDev"];

const cents = (v: number) => Math.round(v * 100) / 100;

// One of the wordings, fixed by the seed and the thread's place.
export const variant = (s: GameState, what: string, ...key: number[]): string =>
  `reply.${what}.${Math.floor(rand(hashRng(s.seed, ...key, 97)) * REPLY_VARIANTS)}`;

// The company's name and domain for the signature, the mail server and the panel.
export const companyParams = (s: GameState): Record<string, string> => ({ company: s.company.name, host: companyDomain(s) });

// The email for a template reply ("tpl.ftp") or an action ("credit"), with the figures as they are before the action applies.
export function outgoing(s: GameState, t: Ticket, c: Customer | undefined, what: string): Pick<Reply, "key" | "params"> {
  const v = s.services.find((x) => x.id === t.serviceId), monthly = c ? monthlyValue(s.services, c.id) : 0;
  return {
    key: variant(s, what, Number(t.id.slice(3)) || 0, t.replies.length),
    params: {
      ...companyParams(s), name: c && PERSONS.includes(c.profile) ? c.name.split(" ")[0] : "", service: v?.label ?? "", hostname: serviceFqdn(s, v), domain: v?.domain ?? "",
      credit: cents(0.1 * monthly), once: updatePrice(s.rates.webHosting, "updateOnce"), managed: updatePrice(s.rates.webHosting, "updates"), refund: cents(monthly), cleanup: c ? cleanupPrice(s, c) : 0, days: EXTENSION_DAYS, hours: TAKEDOWN_HOURS,
      url: t.notice?.url ?? "", sender: t.notice ? senderName(t.notice.sender) : "",
    },
  };
}

// Records an action's email in the thread; template replies carry theirs on the reply itself.
export function sendAction(s: GameState, t: Ticket, c: Customer | undefined, what: string, by?: string): void {
  t.replies = [...t.replies, { hour: s.hour, template: what, right: true, ...outgoing(s, t, c, what), ...(by && { by }) }];
}
