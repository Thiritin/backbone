// The mail check: on each account's interval, with the window open or closed (docs/design/plans/mail-client.md, The check).
import { nowMinutes, yearOf } from "../00-core/time";
import { MAIL_HOSTS, mailServersOf, type MailProtocol } from "../10-catalog/mail-providers";
import { companyDomain } from "../30-customers/domains";
import { tenantOf } from "../42-mail/address";
import { capsOf } from "../42-mail/caps";
import { serverStatus, type ServerStatus } from "../42-mail/accounts";
import { drop } from "../42-mail/deliver";
import { boxOf, isRead } from "../42-mail/model";
import type { Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { clientFolder } from "./view";
import { ACTIVITY_KEEP, localFolder, type ActivityLine, type ClientAccount, type PopRemove } from "./state";

export const APP = "Pear Mail";
// The rule step, set by 90-actions/pear-rules when it loads, so this file stays below the actions in the import order.
export const ruleStep: { run?: (s: GameState, clientId: string, ids: string[]) => void } = {};
const DAY = 24 * 60;
export const POP_KEEP: Record<PopRemove, number | null> = { now: 0, day: DAY, week: 7 * DAY, month: 30 * DAY, never: null };
// Single new-mail events per check; the rest are summed up in one.
const EVENTS_EACH = 3;

const ERRORS: Record<ServerStatus, string | null> = {
  ok: null, listed: null, down: "error.mailDown", installing: "error.mailDown", closed: "error.mailClosed", locked: "error.mailLocked",
  unresolved: "error.mailDns", auth: "error.mailAuth", external: "error.mailExternal", poll: "error.mailPoll",
};

// The provider whose server answers to a typed host name for the protocol, "self" for mail.<company domain>.
export function hostOwner(s: GameState, host: string, protocol: MailProtocol): string | null {
  const h = host.trim().toLowerCase(), d = companyDomain(s), year = yearOf(s.hour);
  return MAIL_HOSTS.find((x) => mailServersOf(x.id, d, year)[protocol]?.host === h)?.id ?? null;
}

// The error key a check of the account answers now, null when it connects; gapMin counts the provider's poll gap.
export function clientError(s: GameState, c: ClientAccount, gapMin?: number): string | null {
  const owner = c.server && hostOwner(s, c.server.host, c.protocol);
  if (c.server && !owner) return "error.mailServer";
  const a = s.mail.accounts.find((x) => x.id === c.accountId);
  if (!a || (owner && tenantOf(s, a)?.host !== owner)) return "error.mailNoBox";
  const st = serverStatus(s, a.id, c.protocol, c.password, gapMin);
  return st === "external" && !capsOf(s, a)[c.protocol] ? "error.mailProtocol" : ERRORS[st];
}

const patch = (s: GameState, id: string, p: Partial<ClientAccount>): void => {
  s.pearMail = { ...s.pearMail, accounts: s.pearMail.accounts.map((c) => (c.id === id ? { ...c, ...p } : c)) };
};
const log = (s: GameState, line: ActivityLine): void => { s.pearMail = { ...s.pearMail, activity: [...s.pearMail.activity, line].slice(-ACTIVITY_KEEP) }; };

// One check of one account; returns its new-mail events. A check right after new settings skips the poll gap, which
// counts from the last check that got in.
export function checkAccount(s: GameState, id: string, polled = true): SimEvent[] {
  const c = s.pearMail.accounts.find((x) => x.id === id);
  if (!c) return [];
  const now = nowMinutes(s), error = clientError(s, c, polled ? now - c.checkedAt : undefined);
  if (error) {
    patch(s, id, { checkedAt: now, ...(error === "error.mailAuth" && { authFailed: true }) });
    log(s, { at: now, clientId: id, count: 0, error });
    return [];
  }
  const fresh = boxOf(s, c.accountId).filter((m) => m.folder === "inbox" && !m.snooze && m.at > c.syncedAt && m.at <= now);
  let shown = fresh, popDue = c.popDue;
  if (c.protocol === "pop") {
    shown = fresh.map((m) => ({ ...m, id: `msg${s.nextId++}`, folder: localFolder(id, "inbox"), origin: id }));
    s.pearMail = { ...s.pearMail, local: { ...s.pearMail.local, messages: [...s.pearMail.local.messages, ...shown] } };
    const keep = POP_KEEP[c.popRemove];
    if (keep === 0) drop(s, c.accountId, new Set(fresh.map((m) => m.id)));
    else if (keep !== null) popDue = [...popDue, ...fresh.map((m) => ({ id: m.id, at: now + keep }))];
  }
  const due = popDue.filter((d) => d.at <= now);
  if (due.length) drop(s, c.accountId, new Set(due.map((d) => d.id)));
  const { authFailed: _a, ...rest } = c;
  s.pearMail = { ...s.pearMail, accounts: s.pearMail.accounts.map((x) => (x.id === id ? { ...rest, checkedAt: now, syncedAt: now, popDue: popDue.filter((d) => d.at > now) } : x)) };
  log(s, { at: now, clientId: id, count: fresh.length });
  ruleStep.run?.(s, id, shown.map((m) => m.id));
  // What the rules left unread in the Inbox.
  const inbox = new Map(clientFolder(s, s.pearMail.accounts.find((x) => x.id === id)!, "inbox").map((m) => [m.id, m]));
  const news = shown.map((m) => inbox.get(m.id)).filter((m): m is Message => !!m && !isRead(s, m)), params = { account: c.description };
  return [
    ...news.slice(0, EVENTS_EACH).map((m) => ({ app: "Pear Mail", key: "event.newMail", params: { ...params, count: 1, messageId: m.id } })),
    ...(news.length > EVENTS_EACH ? [{ app: "Pear Mail", key: "event.newMailMore", params: { ...params, count: news.length - EVENTS_EACH } }] : []),
  ];
}

// Every game minute. A manual account and one whose password was refused wait for Get Mail.
export function pearMailTick(s: GameState): SimEvent[] {
  if (!s.pearMail.accounts.length || !s.installed.includes(APP)) return [];
  const now = nowMinutes(s);
  return s.pearMail.accounts.filter((c) => c.enabled && !c.authFailed && c.checkEvery > 0 && now - c.checkedAt >= c.checkEvery)
    .flatMap((c) => checkAccount(s, c.id));
}
