// Mailbox actions (docs/design/plans/mail-core.md, Account actions and Passwords). Provider sites and server panels call these.
import { hashRng, rand } from "../00-core/rng";
import { post } from "../40-support/letters";
import { addMailbox, canAddMailbox, mailboxInUse, mailboxTaken, openBoxes, PROVIDER_NAMES, removeMailbox } from "../42-mail/accounts";
import { accountByAddress, tenantOf } from "../42-mail/model";
import type { MailAccount, MailRole } from "../42-mail/types";
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

export const setAccountRoles = (s: GameState, id: string, roles: MailRole[]): ActionResult => patch(s, id, { roles: [...new Set(roles)] });
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

