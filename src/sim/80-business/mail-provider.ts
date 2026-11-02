// The daily pass of the provider sites (docs/design/plans/webmail-consumer.md, milestone 3): ended tenants close and go
// after their grace, cheaper tiers take over at the month start, and Goggle's free edition meets its two deadlines.
import { hourOfMonth, isMonthStart } from "../00-core/time";
import { GOGGLE_CONVERSION } from "../10-catalog/mail-consumer";
import { GRACE_DAYS } from "../10-catalog/mail-providers";
import { removeMailbox } from "../42-mail/accounts";
import type { MailTenant, Message } from "../42-mail/types";
import type { GameState } from "../50-state";

const GOGGLE_CLOSING = "2012-12";

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
