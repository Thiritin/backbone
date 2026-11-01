// docs/design/plans/billing-by-hand.md, lane vendor-sites: Lexwear sells the Books modules on its site through the shared
// vendor shop, and the newsletter offers each module once.
import { t } from "../../i18n/en";
import { dateOf } from "../00-core/time";
import { hasModule, MODULES, type ModuleCount } from "../10-catalog/modules";
import { deliverMail } from "../40-support/tickets";
import { bookTransfer, isUnpaid, issue, owed, type Invoice, type Transfer } from "../45-billing/billing";
import { logActivity } from "../47-staff/activity";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

export const LEXWEAR = "Lexwear";
export const LEXWEAR_HOST = "lexwear.de";
export const lexwearUrl = (id?: string): string => `www.${LEXWEAR_HOST}/${id ? `module/${id}` : ""}`;
export const MONTHLY_RUN_HOUR = 9;

export const bought = (s: GameState, id: string): boolean => s.licenses.some((k) => k.product === id);
// Licence emails are from saves before the shared vendor shop.
export const LICENCE = "lexwear.licence", NEWSLETTER = "lexwear.newsletter";

// A Lexwear email's params as shown: the module's name and pitch in the player's language.
export const vendorParams = (p: Record<string, string | number>): Record<string, string> => ({
  module: t(`vendor-sites.module.${p.module}`), pitch: t(`vendor-sites.pitch.${p.module}`), key: String(p.key ?? ""),
});

function mail(s: GameState, topic: string, params: Record<string, string>): SimEvent {
  const m = deliverMail(s, LEXWEAR, topic, params);
  return { app: "Support", key: "event.ticket", params: { ...vendorParams(params), ticketId: m.id, name: LEXWEAR, subject: `ticket.mail.${topic}.subject` } };
}

export const COUNTS: Record<ModuleCount, (s: GameState) => number> = {
  domainsByHand: (s) => s.domains.filter((d) => d.customerId !== null && !d.transfer).length,
  matched: (s) => s.transfers.filter((x) => x.matchedAt !== null).length,
  customers: (s) => s.customers.filter((c) => !c.sponsor).length,
  suspended: (s) => s.invoices.filter((i) => i.suspendedAt !== null).length,
};
// Sent newsletters are kept in arrived, like the apps' emails.
const newsId = (id: string) => `lexwear.${id}`;

function newsletters(s: GameState): SimEvent[] {
  return MODULES.filter((m) => m.trigger && !s.arrived.includes(newsId(m.id)) && COUNTS[m.trigger.count](s) >= m.trigger.at).flatMap((m) => {
    s.arrived = [...s.arrived, newsId(m.id)];
    return bought(s, m.id) ? [] : [mail(s, NEWSLETTER, { module: m.id })];
  });
}

const logged = (s: GameState, inv: Invoice, key: string, by: string, minutes = 0) =>
  logActivity(s, { customerId: inv.customerId, serviceId: null, by, key: `activity.${key}`, params: { invoice: inv.number }, minutes });

// Sends one draft as the given worker; the invoice record is copied, since the tick works on a shallow copy of the state.
export function sendDraft(s: GameState, inv: Invoice, by: string, minutes = 0): void {
  const copy = { ...inv };
  s.invoices = s.invoices.map((x) => (x.id === inv.id ? copy : x));
  issue(s, copy);
  logged(s, copy, "sendInvoice", by, minutes);
}

export function bookFor(s: GameState, tr: Transfer, inv: Invoice, settle: boolean, by: string, minutes = 0): void {
  const copy = { ...inv };
  s.invoices = s.invoices.map((x) => (x.id === inv.id ? copy : x));
  bookTransfer(s, tr, copy, settle);
  logged(s, copy, "matchTransfer", by, minutes);
}

export const monthlyRun = (s: GameState): void => s.invoices.filter((i) => i.status === "draft").forEach((inv) => sendDraft(s, inv, LEXWEAR));

// The open invoice a transfer's reference names, when the amount is exactly what it owes.
export function referenced(s: GameState, tr: Transfer): Invoice | undefined {
  if (tr.invoiceId !== null || tr.reference !== "books.ref.invoice") return undefined;
  const inv = s.invoices.find((i) => i.number === tr.params.number && isUnpaid(i));
  return inv && owed(inv) === tr.amount ? inv : undefined;
}

export const matchByReference = (s: GameState): void => [...s.transfers].forEach((tr) => {
  const inv = referenced(s, tr);
  if (inv) bookFor(s, tr, inv, false, LEXWEAR);
});

// Hourly, after billing and before staff: newsletters and the modules' chores.
export function lexwearTick(s: GameState): SimEvent[] {
  const events = newsletters(s);
  const d = dateOf(s.hour);
  if (hasModule(s, "monthly-run") && d.getUTCDate() === 1 && d.getUTCHours() === MONTHLY_RUN_HOUR) monthlyRun(s);
  if (hasModule(s, "match-by-reference")) matchByReference(s);
  return events;
}
