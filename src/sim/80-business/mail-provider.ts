// The daily pass of the provider sites (docs/design/plans/webmail-consumer.md, milestone 3): ended tenants close and go
// after their grace, cheaper tiers take over at the month start, and Goggle's free edition meets its two deadlines.
import { hourOfMonth, isMonthStart, yearOf } from "../00-core/time";
import { GOGGLE_CONVERSION } from "../10-catalog/mail-consumer";
import { GRACE_DAYS } from "../10-catalog/mail-providers";
import { mailboxTaken, openBoxes, removeMailbox } from "../42-mail/accounts";
import { GMIX_DOMAIN } from "../42-mail/new";
import type { MailTenant, Message } from "../42-mail/types";
import type { GameState } from "../50-state";

const GOGGLE_CLOSING = "2012-12";

const gmixTaken = (s: GameState, local: string): boolean =>
  mailboxTaken(s, { id: "", host: "gmix", domain: GMIX_DOMAIN, plan: "free", since: 0, verified: true, endsAt: null, admin: null }, local);

// Free names in the shapes the real portal offers for a taken one: a birth year, this year, the trade.
export function gmixSuggestions(s: GameState, local: string): string[] {
  const name = local.trim().toLowerCase();
  if (!name || !gmixTaken(s, name)) return [];
  return [`${name}.${1970 + (s.seed % 25)}`, `${name}${yearOf(s.hour)}`, `${name}-hosting`].filter((x) => !gmixTaken(s, x));
}

function closeEnded(s: GameState): void {
  for (const t of s.mail.tenants) {
    if (t.endsAt === null || t.endsAt > s.hour) continue;
    const goneAt = (GRACE_DAYS[t.host] ?? 0) * 24;
    for (const a of s.mail.accounts.filter((x) => x.tenant === t.id && x.id !== s.mail.primary)) {
      if (a.closedAt === null) s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, closedAt: t.endsAt } : x)) };
      if ((a.closedAt ?? t.endsAt) + goneAt <= s.hour) removeMailbox(s, s.mail.accounts.find((x) => x.id === a.id)!);
    }
  }
}

// Written straight into the admin's box, as the welcome is, so it arrives wherever the domain's MX points.
const notify = (s: GameState, t: MailTenant, topic: string): void => {
  const a = s.mail.accounts.find((x) => x.id === t.admin);
  if (!a) return;
  const id = `msg${s.nextId++}`, m: Message = { id, thread: id, folder: "inbox", from: "n:Goggle", to: `${a.local}@${a.domain}`, kind: "system", topic, at: s.hour * 60, kb: 3 };
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [a.id]: [...(s.mail.msgs[a.id] ?? []), m] },
    accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, usedKb: x.usedKb + m.kb } : x)) };
};

function goggleEras(s: GameState): void {
  const free = s.mail.tenants.filter((t) => t.host === "goggle" && t.plan === "free" && (t.endsAt === null || t.endsAt > s.hour));
  const notice = hourOfMonth(GOGGLE_CONVERSION.notice), lock = hourOfMonth(GOGGLE_CONVERSION.lock);
  for (const t of free) {
    if (s.hour === hourOfMonth(GOGGLE_CLOSING)) notify(s, t, "goggleClosing");
    else if (s.hour >= notice && s.hour < lock) notify(s, t, s.hour === notice ? "goggleConversion" : "goggleReminder");
    else if (s.hour === lock && !t.locked) s.mail = { ...s.mail, tenants: s.mail.tenants.map((x) => (x.id === t.id ? { ...x, locked: true } : x)) };
  }
}

// Runs before the monthly bill, so a tier that ends with the paid month is not charged again.
export function mailProviderTick(s: GameState): void {
  if (s.hour % 24 !== 0) return;
  closeEnded(s);
  if (!isMonthStart(s.hour)) return;
  s.mail = { ...s.mail, tenants: s.mail.tenants.map(({ next, ...t }) => (next ? { ...t, plan: next } : t)) };
  goggleEras(s);
}

// FreeMix ads: gmix.mail.ad.0 to .7 in i18n, ad 0 the visitor prize. A slot shows the same ad for an hour and a mailbox,
// so a render never reshuffles it.
export const GMIX_ADS = 8;
export const gmixAd = (hour: number, accountId: string, slot = 0): number =>
  (hour + (Number(accountId.replace(/\D/g, "")) || 0) * 3 + slot * 5) % GMIX_ADS;

// The Admin console's Reports: per user the messages sent and received and the kilobytes stored, and how many of the sent
// messages went to an address on the tenant's own domain.
export function goggleReport(s: GameState, tenantId: string): { rows: { id: string; sent: number; received: number; kb: number }[]; sent: number; inside: number } {
  const t = s.mail.tenants.find((x) => x.id === tenantId), boxes = openBoxes(s, tenantId);
  const sent = boxes.flatMap((a) => (s.mail.msgs[a.id] ?? []).filter((m) => m.folder === "sent"));
  return {
    rows: boxes.map((a) => {
      const m = (s.mail.msgs[a.id] ?? []).filter((x) => !x.draft);
      return { id: a.id, sent: m.filter((x) => x.folder === "sent").length, received: m.filter((x) => x.folder !== "sent").length, kb: m.reduce((n, x) => n + x.kb, 0) };
    }),
    sent: sent.length,
    inside: sent.filter((m) => !!t && m.to.toLowerCase().endsWith(`@${t.domain}`)).length,
  };
}
