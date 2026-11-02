// Mailbox actions (docs/design/plans/mail-core.md, Account actions and Passwords). Provider sites and server panels call these.
import { hashRng, rand } from "../00-core/rng";
import { post } from "../40-support/letters";
import { addMailbox, canAddMailbox, mailboxInUse, mailboxTaken, openBoxes, PROVIDER_NAMES, RETIRE_HOURS, removeMailbox } from "../42-mail/accounts";
import { capsOf } from "../42-mail/caps";
import { GMIX_DOMAIN } from "../42-mail/new";
import { mailHost } from "../10-catalog/mail-providers";
import { accountByAddress, tenantOf } from "../42-mail/model";
import type { Folder, MailAccount, MailGroup, MailRole, MailTenant, ServerFilter } from "../42-mail/types";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string, params?: Record<string, string>): ActionResult => ({ ok: false, error, ...(params && { params }) });
const box = (s: GameState, id: string) => s.mail.accounts.find((a) => a.id === id);

// The provider's Forgot password page, which the reset letter links to.
const RESET_PAGES: Record<string, string> = {
  gmix: "www.gmix.net/reset", goggle: "accounts.goggle.com/recovery", ionose: "www.ionose.de/mail/reset", lookout: "login.lookout365.com/reset",
};
const RESET_TRIES = 3;

const LOCAL = /^[a-z0-9._-]{1,32}$/;
export const MIN_PASSWORD = 6;

export function createMailAccount(s: GameState, o: { tenant: string; local: string; title: string; password: string; shared?: boolean }): ActionResult {
  const t = s.mail.tenants.find((x) => x.id === o.tenant);
  if (!t || (t.endsAt !== null && t.endsAt <= s.hour)) return fail("error.mailNoService");
  const local = o.local.trim().toLowerCase();
  if (!LOCAL.test(local)) return fail("error.mailLocal");
  if (!o.shared && o.password.length < MIN_PASSWORD) return fail("error.mailPassword");
  if (mailboxTaken(s, t, local)) return fail("error.mailTaken");
  if (!canAddMailbox(s, t)) return fail("error.mailLimit");
  return { ok: true, id: addMailbox(s, t, local, o.title.trim() || local, o.shared ? "" : o.password, o.shared ? { shared: true } : {}).id };
}

export function deleteMailAccount(s: GameState, id: string): ActionResult {
  const a = box(s, id);
  if (!a) return fail("error.mailUnknown");
  if (a.employee) return fail("error.mailInUse", { sources: s.staff.find((e) => e.id === a.employee)?.name ?? "" });
  if (openBoxes(s, a.tenant).length <= 1) return fail("error.mailRoleInUse");
  const busy = mailboxInUse(s, a);
  if (busy) return fail(busy);
  removeMailbox(s, a);
  return { ok: true };
}

const patch = (s: GameState, id: string, p: Partial<MailAccount>): ActionResult => {
  if (!box(s, id)) return fail("error.mailUnknown");
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === id ? { ...a, ...p } : a)) };
  return { ok: true, id };
};

// A group holds no mail, so a role, which routes requests to one mailbox, cannot point at it.
export const setAccountRoles = (s: GameState, id: string, roles: MailRole[]): ActionResult =>
  s.mail.groups.some((g) => g.id === id) ? fail("error.mailGroupRole") : patch(s, id, { roles: [...new Set(roles)] });
export const setAccountTitle = (s: GameState, id: string, title: string): ActionResult => patch(s, id, { title: title.trim() });
export const setExternalAccess = (s: GameState, id: string, on: boolean): ActionResult => patch(s, id, { external: on });

const PREFS_MAX = 30;
export function setAccountPrefs(s: GameState, id: string, p: Record<string, string | number | boolean>): ActionResult {
  const prefs = { ...box(s, id)?.prefs, ...p };
  return Object.keys(prefs).length > PREFS_MAX ? fail("error.mailPrefs") : patch(s, id, { prefs });
}

export function setPrimary(s: GameState, id: string): ActionResult {
  const a = box(s, id);
  if (!a || a.closedAt !== null || a.shared) return fail("error.mailUnknown");
  s.mail = { ...s.mail, primary: id };
  return { ok: true, id };
}

const GROUP_MAX = 30;
const groupLabel = (s: GameState, tenant: MailTenant, name: string, members: string[]): void => {
  if (!mailHost(tenant.host)?.labels) return;
  const add = members.filter((m) => !s.mail.folders.some((f) => f.accountId === m && f.label && f.name === name));
  s.mail = { ...s.mail, folders: [...s.mail.folders, ...add.map((accountId): Folder => ({ id: `fd${s.nextId++}`, accountId, name, parent: null, label: true }))] };
};
const membersOk = (s: GameState, tenant: string, members: string[]): boolean =>
  members.length <= GROUP_MAX && members.every((m) => s.mail.accounts.some((a) => a.id === m && a.tenant === tenant && a.closedAt === null));

// A group address copies each message to its members, which are mailboxes of the same domain tenant.
export function createGroup(s: GameState, o: { tenant: string; local: string; title: string; members: string[] }): ActionResult {
  const t = s.mail.tenants.find((x) => x.id === o.tenant);
  if (!t || t.domain === GMIX_DOMAIN || (t.endsAt !== null && t.endsAt <= s.hour)) return fail("error.mailNoService");
  const local = o.local.trim().toLowerCase(), members = [...new Set(o.members)];
  if (!LOCAL.test(local)) return fail("error.mailLocal");
  if (mailboxTaken(s, t, local)) return fail("error.mailTaken");
  if (!membersOk(s, t.id, members)) return fail("error.mailGroupMembers");
  const title = o.title.trim() || local, label = mailHost(t.host)?.labels ? title : null;
  const g: MailGroup = { id: `grp${s.nextId++}`, tenant: t.id, local, title, members, label };
  s.mail = { ...s.mail, groups: [...s.mail.groups, g] };
  if (label) groupLabel(s, t, label, members);
  return { ok: true, id: g.id };
}

export function setGroupMembers(s: GameState, id: string, members: string[]): ActionResult {
  const g = s.mail.groups.find((x) => x.id === id), t = g && s.mail.tenants.find((x) => x.id === g.tenant);
  if (!g || !t) return fail("error.mailUnknown");
  const list = [...new Set(members)];
  if (!membersOk(s, g.tenant, list)) return fail("error.mailGroupMembers");
  s.mail = { ...s.mail, groups: s.mail.groups.map((x) => (x.id === id ? { ...x, members: list } : x)) };
  if (g.label) groupLabel(s, t, g.label, list);
  return { ok: true, id };
}

export function deleteGroup(s: GameState, id: string): ActionResult {
  const g = s.mail.groups.find((x) => x.id === id), t = g && s.mail.tenants.find((x) => x.id === g.tenant);
  if (!g || !t) return fail("error.mailUnknown");
  s.mail = { ...s.mail, groups: s.mail.groups.filter((x) => x.id !== id), retired: [...s.mail.retired, { address: `${g.local}@${t.domain}`, until: s.hour + RETIRE_HOURS }] };
  return { ok: true };
}

const RULE_PARTS = 5;
// Server filters run on delivery in their order; the host decides which actions take effect.
export function saveFilter(s: GameState, accountId: string, f: Omit<ServerFilter, "accountId" | "id"> & { id?: string }): ActionResult {
  const a = box(s, accountId);
  if (!a) return fail("error.mailUnknown");
  const caps = capsOf(s, a), mine = s.mail.filters.filter((x) => x.accountId === accountId);
  if (caps.serverFilters === "none") return fail("error.mailNoFilters");
  if (!f.conds.length || !f.acts.length || f.conds.length > RULE_PARTS || f.acts.length > RULE_PARTS) return fail("error.mailFilterRule");
  const old = f.id ? mine.find((x) => x.id === f.id) : undefined;
  if (!old && mine.length >= caps.filterMax) return fail("error.mailFilterMax");
  const next: ServerFilter = { ...f, id: old?.id ?? `flt${s.nextId++}`, accountId, name: f.name.trim() };
  s.mail = { ...s.mail, filters: old ? s.mail.filters.map((x) => (x.id === old.id ? next : x)) : [...s.mail.filters, next] };
  return { ok: true, id: next.id };
}

export function deleteFilter(s: GameState, id: string): ActionResult {
  if (!s.mail.filters.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.mail = { ...s.mail, filters: s.mail.filters.filter((x) => x.id !== id) };
  return { ok: true };
}

export function setFilterOn(s: GameState, id: string, on: boolean): ActionResult {
  if (!s.mail.filters.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.mail = { ...s.mail, filters: s.mail.filters.map((x) => (x.id === id ? { ...x, on } : x)) };
  return { ok: true, id };
}

// Moves a filter to position `to` among the filters of its mailbox.
export function moveFilter(s: GameState, id: string, to: number): ActionResult {
  const f = s.mail.filters.find((x) => x.id === id);
  if (!f) return fail("error.mailUnknown");
  const mine = s.mail.filters.filter((x) => x.accountId === f.accountId && x.id !== id);
  mine.splice(Math.max(0, Math.min(mine.length, to)), 0, f);
  s.mail = { ...s.mail, filters: [...s.mail.filters.filter((x) => x.accountId !== f.accountId), ...mine] };
  return { ok: true, id };
}

export function changePassword(s: GameState, id: string, oldPassword: string, newPassword: string): ActionResult {
  const a = box(s, id);
  if (!a || a.password !== oldPassword || a.shared) return fail("error.mailLogin");
  if (newPassword.length < MIN_PASSWORD) return fail("error.mailPassword");
  return patch(s, id, { password: newPassword });
}

// Hosted tenants with an admin reset the other mailboxes at once; the admin's own password and GMix use the letter.
export function requestPasswordReset(s: GameState, address: string): ActionResult {
  const a = accountByAddress(s, address), t = a && tenantOf(s, a);
  if (!a || !t || a.closedAt !== null || a.shared) return fail("error.mailLogin");
  if (t.host === "self" || (t.host !== "gmix" && a.id !== t.admin)) return fail("error.mailAdmin");
  if (a.reset) return fail("error.mailResetOpen");
  const r = hashRng(s.seed, s.nextId, 6113), code = String(Math.floor(rand(r) * 900000) + 100000), days = rand(r) < 0.5 ? 2 : 3;
  const letter = post(s, PROVIDER_NAMES[t.host], "mailReset", { address: `${a.local}@${a.domain}`, code }, days, { link: RESET_PAGES[t.host] });
  return patch(s, a.id, { reset: { code, letter: letter.id } });
}

export function resetPassword(s: GameState, address: string, code: string, newPassword: string): ActionResult {
  const a = accountByAddress(s, address);
  if (!a?.reset) return fail("error.mailCode");
  if (code.trim() !== a.reset.code) {
    const tries = (a.reset.tries ?? 0) + 1;
    patch(s, a.id, { reset: tries >= RESET_TRIES ? null : { ...a.reset, tries } });
    return fail("error.mailCode");
  }
  if (newPassword.length < MIN_PASSWORD) return fail("error.mailPassword");
  return patch(s, a.id, { password: newPassword, reset: null });
}

// The admin reset: any mailbox on the own server, another mailbox of the tenant for a hosted admin.
export function setAccountPassword(s: GameState, adminId: string | null, id: string, newPassword: string): ActionResult {
  const a = box(s, id), t = a && tenantOf(s, a);
  if (!a || !t) return fail("error.mailUnknown");
  const allowed = t.host === "self" ? adminId === null : t.host !== "gmix" && adminId === t.admin && id !== adminId;
  if (!allowed) return fail("error.mailAdmin");
  if (newPassword.length < MIN_PASSWORD) return fail("error.mailPassword");
  return patch(s, id, { password: newPassword, reset: null });
}


// Addresses on the company domain: aliases, the catch-all, forwarding and quotas (webmail-server.md, 5.1).
const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const domainBox = (s: GameState, id: string) => {
  const a = box(s, id), t = a && tenantOf(s, a);
  return a && t && a.closedAt === null && a.domain !== GMIX_DOMAIN ? { a, t } : null;
};

export function addAlias(s: GameState, id: string, local: string): ActionResult {
  const x = domainBox(s, id);
  if (!x) return fail("error.mailNoAlias");
  const l = local.trim().toLowerCase(), max = capsOf(s, x.a).aliasMax;
  if (!LOCAL.test(l)) return fail("error.mailLocal");
  if (mailboxTaken(s, x.t, l)) return fail("error.mailTaken");
  if (openBoxes(s, x.t.id).reduce((n, b) => n + b.aliases.length, 0) >= max) return fail("error.mailAliasMax");
  const address = `${l}@${x.a.domain}`;
  s.mail = { ...s.mail, retired: s.mail.retired.filter((r) => r.address !== address) };
  return patch(s, id, { aliases: [...x.a.aliases, l] });
}

export function removeAlias(s: GameState, id: string, local: string): ActionResult {
  const a = box(s, id), l = local.trim().toLowerCase();
  if (!a || !a.aliases.includes(l)) return fail("error.mailUnknown");
  s.mail = { ...s.mail, retired: [...s.mail.retired, { address: `${l}@${a.domain}`, until: s.hour + RETIRE_HOURS }] };
  return patch(s, id, { aliases: a.aliases.filter((x) => x !== l) });
}

export function setCatchAll(s: GameState, id: string | null): ActionResult {
  if (id === null) {
    s.mail = { ...s.mail, catchAll: null };
    return { ok: true };
  }
  const x = domainBox(s, id);
  if (!x || !capsOf(s, x.a).catchAll) return fail("error.mailNoCatchAll");
  s.mail = { ...s.mail, catchAll: id };
  return { ok: true, id };
}

export function setForward(s: GameState, id: string, to: string | null, keep: boolean): ActionResult {
  const address = to?.trim().toLowerCase() ?? null;
  if (address !== null && !ADDRESS.test(address)) return fail("error.mailForward");
  return patch(s, id, { forward: address === null ? null : { to: address, keep } });
}

// Own servers only; the mailbox may be set below what it holds, and new mail then waits in the queue.
export function setAccountQuota(s: GameState, id: string, mb: number): ActionResult {
  const a = box(s, id), t = a && tenantOf(s, a);
  if (!a || !t) return fail("error.mailUnknown");
  if (t.host !== "self") return fail("error.mailQuotaHost");
  if (!Number.isInteger(mb) || mb < 1) return fail("error.mailQuota");
  return patch(s, id, { quotaMb: mb });
}
