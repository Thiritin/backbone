// Tenants, mailboxes, roles and sign-in (docs/design/plans/mail-core.md, Accounts and addresses).
import { companyDomain } from "../30-customers/domains";
import { mailHost, mailboxCap, type MailProtocol } from "../10-catalog/mail-providers";
import type { GameState } from "../50-state";
import { capsOf, mxTarget } from "./caps";
import { ascii } from "../30-customers/domains";
import { accountByAddress, tenantOf } from "./address";
import { GMIX_DOMAIN, newAccount, seededPassword, welcome } from "./new";
import type { MailAccount, MailRole, MailTenant } from "./types";

export const MAIL_LOGIN = (address: string): string => `mail:${address.trim().toLowerCase()}`;

const live = (s: GameState, t: MailTenant | undefined): t is MailTenant => !!t && (t.endsAt === null || t.endsAt > s.hour);
export const openBoxes = (s: GameState, tenantId: string): MailAccount[] =>
  s.mail.accounts.filter((a) => a.tenant === tenantId && a.closedAt === null);

// The mailboxes a tenant pays for; shared boxes are free where the host says so.
export function seatsBilled(s: GameState, t: MailTenant): number {
  const free = mailHost(t.host)?.sharedFree;
  return openBoxes(s, t.id).filter((a) => !(free && a.shared)).length;
}

export const canAddMailbox = (s: GameState, t: MailTenant): boolean => {
  const cap = mailboxCap(t.host, t.plan, t.since);
  return cap === null || openBoxes(s, t.id).length < cap;
};

// The company-domain tenant that receives mail and can take one more mailbox, for a hire.
export function hireTenant(s: GameState): MailTenant | null {
  const t = mxTarget(s);
  return t && t.domain !== GMIX_DOMAIN && !t.locked && live(s, t) && canAddMailbox(s, t) ? t : null;
}

const CONVENTION: Record<MailRole, string[]> = { owner: [], sales: ["sales", "info"], support: ["support"], abuse: ["abuse", "postmaster"] };

// Leads and the website read the sales mailbox every hour, so the answer is kept until mail, company or hour change.
// ponytail: keyed on object identity, so it assumes mail and company are replaced, never mutated in place.
let roleSeen: { mail: unknown; company: unknown; hour: number; by: Partial<Record<MailRole, MailAccount | undefined>> } | null = null;
export function roleAccount(s: GameState, role: MailRole): MailAccount | undefined {
  if (roleSeen?.mail !== s.mail || roleSeen.company !== s.company || roleSeen.hour !== s.hour) roleSeen = { mail: s.mail, company: s.company, hour: s.hour, by: {} };
  if (!(role in roleSeen.by)) roleSeen.by[role] = findRoleAccount(s, role);
  return roleSeen.by[role];
}

// A flagged mailbox, then one with the conventional local part on the receiving domain tenant, then the primary.
function findRoleAccount(s: GameState, role: MailRole): MailAccount | undefined {
  const target = mxTarget(s), primary = s.mail.accounts.find((a) => a.id === s.mail.primary);
  if (role === "owner") return primary;
  const usable = s.mail.accounts.filter((a) => {
    const t = tenantOf(s, a);
    return a.closedAt === null && live(s, t) && (t.domain === GMIX_DOMAIN || t.id === target?.id);
  });
  return usable.find((a) => a.roles.includes(role))
    ?? CONVENTION[role].map((l) => usable.find((a) => a.domain !== GMIX_DOMAIN && a.local === l)).find(Boolean)
    ?? primary;
}

export const roleAddress = (s: GameState, role: MailRole): string => {
  const a = roleAccount(s, role);
  return a ? `${a.local}@${a.domain}` : `sales@${companyDomain(s)}`;
};

export const sharedMailboxesOf = (s: GameState, accountId: string): MailAccount[] => {
  const a = s.mail.accounts.find((x) => x.id === accountId);
  return a ? openBoxes(s, a.tenant).filter((x) => x.shared && x.id !== a.id) : [];
};

export const vacationOn = (a: MailAccount, hour: number): boolean => !!a.vacation?.on && (a.vacation.until === null || hour < a.vacation.until);

// The one place a password is compared.
export function checkMailLogin(s: GameState, address: string, password: string): { ok: true; account: MailAccount } | { ok: false; error: string } {
  const a = accountByAddress(s, address), t = a && tenantOf(s, a);
  if (!a || !t || a.closedAt !== null) return { ok: false, error: "error.mailLogin" };
  if (a.shared) return { ok: false, error: "error.mailShared" };
  if (t.locked) return { ok: false, error: "error.mailLocked" };
  if (a.password !== password) return { ok: false, error: "error.mailLogin" };
  return { ok: true, account: a };
}

export type ServerStatus = "ok" | "down" | "listed" | "installing" | "closed" | "locked" | "unresolved" | "auth" | "external" | "poll";

// What a client connecting to the mailbox sees; gapMin is the minutes since its last check. The own server's down, listed
// and installing come from webmail-server.
export function serverStatus(s: GameState, accountId: string, protocol: MailProtocol, password?: string, gapMin?: number): ServerStatus {
  const a = s.mail.accounts.find((x) => x.id === accountId), t = a && tenantOf(s, a);
  if (!a || !t || a.closedAt !== null || !live(s, t)) return "closed";
  if (t.locked) return "locked";
  if (t.domain !== GMIX_DOMAIN && mxTarget(s)?.id !== t.id) return "unresolved";
  if (password !== undefined && password !== a.password) return "auth";
  const caps = capsOf(s, a);
  // A protocol the plan does not offer is refused with the wording of the access switch, as GMix does.
  if (protocol !== "smtp" && (!caps[protocol] || a.external === false)) return "external";
  if (gapMin !== undefined && gapMin < caps.pollGapMin) return "poll";
  return "ok";
}

export const PROVIDER_NAMES: Record<string, string> = { gmix: "GMix", goggle: "Goggle", ionose: "Ionose", lookout: "Lookout 365", self: "Postfixit" };
// Taken on GMix whoever asks: the role names and the names everyone wants.
const GMIX_TAKEN = ["admin", "info", "sales", "support", "abuse", "postmaster", "webmaster", "contact", "mail", "office", "service", "hosting", "test"];
const RETIRE_HOURS = 90 * 24;
// Adds a mailbox with no checks; the welcome message states its address and password.
export function addMailbox(s: GameState, t: MailTenant, local: string, title: string, password: string, extra: Partial<MailAccount> = {}): MailAccount {
  const a: MailAccount = { ...newAccount(`mb${s.nextId++}`, t, local, title, password, s.hour), ...extra };
  const w = welcome(`msg${s.nextId++}`, a, PROVIDER_NAMES[t.host] ?? t.host, s.hour * 60);
  s.mail = { ...s.mail, accounts: [...s.mail.accounts, { ...a, usedKb: w.kb }], msgs: { ...s.mail.msgs, [a.id]: [w] } };
  if (!t.admin) s.mail = { ...s.mail, tenants: s.mail.tenants.map((x) => (x.id === t.id ? { ...x, admin: a.id } : x)) };
  return s.mail.accounts.find((x) => x.id === a.id)!;
}

export const mailboxTaken = (s: GameState, t: MailTenant, local: string): boolean =>
  openBoxes(s, t.id).some((a) => a.local === local || a.aliases.includes(local)) || (t.domain === GMIX_DOMAIN && (GMIX_TAKEN.includes(local) || !!accountByAddress(s, `${local}@${GMIX_DOMAIN}`)));

// The employee's mailbox, firstname.lastname, numbered when taken.
export function employeeMailbox(s: GameState, t: MailTenant, employeeId: string, name: string): MailAccount {
  const base = name.split(" ").map(ascii).filter(Boolean).join(".") || "staff";
  let local = base;
  for (let n = 2; mailboxTaken(s, t, local); n++) local = `${base}${n}`;
  return addMailbox(s, t, local, name, seededPassword(s.seed, s.nextId), { employee: employeeId });
}

// Removes a mailbox and its mail at once; a company-domain address keeps receiving bounces for a while.
export function removeMailbox(s: GameState, a: MailAccount): void {
  const { [a.id]: _gone, ...msgs } = s.mail.msgs;
  const retired = a.domain === GMIX_DOMAIN ? [] : [`${a.local}@${a.domain}`, ...a.aliases.map((l) => `${l}@${a.domain}`)].map((address) => ({ address, until: s.hour + RETIRE_HOURS }));
  s.mail = { ...s.mail, accounts: s.mail.accounts.filter((x) => x.id !== a.id), msgs, retired: [...s.mail.retired, ...retired], catchAll: s.mail.catchAll === a.id ? null : s.mail.catchAll };
}

// Why a mailbox cannot go: it is the primary, the last one, a source's contact or a desk channel's input.
export function mailboxInUse(s: GameState, a: MailAccount): string | null {
  if (a.id === s.mail.primary) return "error.mailRoleInUse";
  const sources = Object.entries(s.mail.contacts).filter(([, id]) => id === a.id).map(([k]) => k);
  if (sources.length || s.mail.channels.some((c) => c.accountId === a.id)) return "error.mailInUse";
  return null;
}

