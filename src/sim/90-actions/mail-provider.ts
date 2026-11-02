// Player actions of the GMix and Goggle sites (docs/design/plans/webmail-consumer.md, milestone 3). Pages call mail-core's
// mailbox, group, alias, password and tenant actions directly; these add what a provider's own flow decides.
import { nextMonthStart, yearOf } from "../00-core/time";
import { goggleToken, verificationAt } from "../10-catalog/mail-consumer";
import { mailPlan, mxSetAt } from "../10-catalog/mail-providers";
import { companyDomain } from "../30-customers/domains";
import { checkMailLogin, mailboxInUse, removeMailbox } from "../42-mail/accounts";
import type { MailAccount, MailTenant } from "../42-mail/types";
import type { GameState } from "../50-state";
import { recordAt } from "../60-infra/company-zone";
import type { ActionResult } from "./hardware";
import { createTenant, setTenantLock, setTenantPlan, verifyTenant } from "./mail";
import { removeCompanyRecord, setCompanyRecord } from "./domains";
import { createMailAccount } from "./mailbox";

const fail = (error: string): ActionResult => ({ ok: false, error });
const tenantOn = (s: GameState, id: string, host: string): MailTenant | undefined => s.mail.tenants.find((t) => t.id === id && t.host === host);
const withTenant = (s: GameState, id: string, f: (t: MailTenant) => MailTenant): void => {
  s.mail = { ...s.mail, tenants: s.mail.tenants.map((t) => (t.id === id ? f(t) : t)) };
};
const withoutNext = ({ next: _n, ...t }: MailTenant): MailTenant => t;

// A new tenant and its first mailbox, which becomes the admin; nothing stays when the mailbox is refused.
function signUp(s: GameState, tenant: { host: string; plan: string }, box: { local: string; title: string; password: string }): ActionResult {
  const before = s.mail, r = createTenant(s, tenant);
  if (!r.ok) return r;
  const a = createMailAccount(s, { tenant: r.id!, ...box });
  if (!a.ok) {
    s.mail = before;
    return a;
  }
  withTenant(s, r.id!, (t) => ({ ...t, admin: a.id! }));
  return a;
}

export const signUpGmix = (s: GameState, o: { local: string; title: string; password: string; plan: string }): ActionResult =>
  signUp(s, { host: "gmix", plan: o.plan }, o);

// An upgrade applies at once and bills from the next month start; a cheaper tier waits for the end of the paid month.
export function setGmixTier(s: GameState, tenantId: string, plan: string): ActionResult {
  const t = tenantOn(s, tenantId, "gmix"), now = t && mailPlan("gmix", t.plan), to = mailPlan("gmix", plan), year = yearOf(s.hour);
  if (!t || !now || !to || (t.endsAt !== null && t.endsAt <= s.hour)) return fail("error.mailNoService");
  if (plan === t.plan) withTenant(s, tenantId, withoutNext);
  else if (to.price(year) < now.price(year)) withTenant(s, tenantId, (x) => ({ ...x, next: plan }));
  else {
    const r = setTenantPlan(s, tenantId, plan);
    if (!r.ok) return r;
    withTenant(s, tenantId, withoutNext);
  }
  return { ok: true, id: tenantId };
}

// Deleting a GMix mailbox ends its tenant at once, and the address is free to take again.
export function deleteGmixMailbox(s: GameState, id: string, password: string): ActionResult {
  const a = s.mail.accounts.find((x) => x.id === id), t = a && tenantOn(s, a.tenant, "gmix");
  if (!a || !t) return fail("error.mailUnknown");
  const login = checkMailLogin(s, `${a.local}@${a.domain}`, password);
  if (!login.ok) return login;
  const busy = mailboxInUse(s, a);
  if (busy) return fail(busy);
  removeMailbox(s, a);
  withTenant(s, t.id, (x) => ({ ...withoutNext(x), endsAt: s.hour }));
  return { ok: true };
}

// The wizard: the company domain, the edition and the administrator; every employee gets a mailbox with the tenant.
export function signUpGoggle(s: GameState, o: { domain: string; plan: string; local: string; title: string; password: string }): ActionResult {
  if (!s.company.domain || o.domain.trim().toLowerCase() !== companyDomain(s)) return fail("error.needsDomain");
  return signUp(s, { host: "goggle", plan: o.plan }, o);
}

const bare = (v: string): string => v.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\.$/, "");
// The record the wizard showed at sign-up, as the world resolves it now.
export function verifyDomain(s: GameState, tenantId: string): ActionResult {
  const t = tenantOn(s, tenantId, "goggle");
  if (!t) return fail("error.mailNoService");
  const want = verificationAt(t.since, goggleToken(s.seed, t.domain));
  if (!recordAt(s, want.type, want.name, s.hour).some((r) => bare(r.data) === want.data)) return fail("error.goggleVerify");
  return verifyTenant(s, tenantId);
}

// GoDuddy's Domain Connect, from 2019: the verification record and the MX set in one step, replacing the MX records there.
export function connectGoggleDns(s: GameState, tenantId: string): ActionResult {
  const t = tenantOn(s, tenantId, "goggle");
  if (!t || s.registrar?.id !== "goDuddy" || yearOf(s.hour) < 2019) return fail("error.mailNoService");
  const v = verificationAt(t.since, goggleToken(s.seed, t.domain)), live = s.company.zone.filter((r) => !r.gone);
  for (const r of live.filter((x) => x.type === "MX")) removeCompanyRecord(s, r.id);
  const drafts = [
    ...(live.some((r) => r.type === v.type && r.name === v.name && bare(r.data) === v.data) ? [] : [{ ...v, ttl: 3600 }]),
    ...mxSetAt("goggle", t.domain, s.hour).map(([p, host]) => ({ type: "MX" as const, name: "@", ttl: 3600, data: `${p} ${host}` })),
  ];
  for (const d of drafts) {
    const r = setCompanyRecord(s, d);
    if (!r.ok) return r;
  }
  return { ok: true, id: tenantId };
}

// Suspended users cannot sign in and still bill, as in the real console; the admin cannot suspend itself.
function setSuspended(s: GameState, id: string, on: boolean): ActionResult {
  const a = s.mail.accounts.find((x) => x.id === id), t = a && tenantOn(s, a.tenant, "goggle");
  if (!a || !t) return fail("error.mailUnknown");
  if (a.id === t.admin) return fail("error.mailAdmin");
  const { suspended: _s, ...rest } = a, next: MailAccount = on ? { ...rest, suspended: true } : rest;
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === id ? next : x)) };
  return { ok: true, id };
}
export const suspendUser = (s: GameState, id: string): ActionResult => setSuspended(s, id, true);
export const restoreUser = (s: GameState, id: string): ActionResult => setSuspended(s, id, false);

// Free to paid, billed from the next month start; it also lifts the 2022 lock at once.
export function upgradeGoggleEdition(s: GameState, tenantId: string): ActionResult {
  const t = tenantOn(s, tenantId, "goggle");
  if (!t || t.plan === "paid") return fail("error.mailNoService");
  const r = setTenantPlan(s, tenantId, "paid");
  return r.ok && t.locked ? setTenantLock(s, tenantId, false) : r;
}

// The retention offer of the cancellation pages: three months at the offer price, once per tenant, and the tier stays.
export function acceptGmixOffer(s: GameState, tenantId: string): ActionResult {
  const t = tenantOn(s, tenantId, "gmix");
  if (!t || t.plan === "free" || t.offerUntil !== undefined || (t.endsAt !== null && t.endsAt <= s.hour)) return fail("error.mailNoService");
  const until = nextMonthStart(nextMonthStart(nextMonthStart(s.hour)));
  withTenant(s, tenantId, (x) => ({ ...withoutNext(x), offerUntil: until }));
  return { ok: true, id: tenantId };
}
