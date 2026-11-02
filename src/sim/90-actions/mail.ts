import { yearOf } from "../00-core/time";
import { companyDomain } from "../30-customers/domains";
import { mailboxCap, mailHost, mailPlan, mxSetAt, onSale } from "../10-catalog/mail-providers";
import { addMailbox, canAddMailbox, employeeMailbox, openBoxes, seatsBilled } from "../42-mail/accounts";
import { gmixLocal, GMIX_DOMAIN, seededPassword } from "../42-mail/new";
import type { MailTenant } from "../42-mail/types";
import type { CompanyRecord } from "../60-infra/company-zone";
import { PROVIDER_HOSTS, providerById, type MailProviderId, type SelfMailSoftware } from "../80-business/mail";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const GMIX_TENANTS = 3;

const liveOn = (s: GameState, domain: string): MailTenant[] => s.mail.tenants.filter((t) => t.domain === domain && (t.endsAt === null || t.endsAt > s.hour));

// A billing relationship with a provider. A company-domain tenant on an external host starts unverified and gets a mailbox
// for every employee; billing starts at the next month start.
export function createTenant(s: GameState, o: { host: string; plan: string; clusterId?: string }): ActionResult {
  const h = mailHost(o.host), p = mailPlan(o.host, o.plan);
  if (!h || !p) return fail("error.unknownMailProvider");
  if (yearOf(s.hour) < h.from || !onSale(p, s.hour)) return fail("error.mailProviderLater");
  const gmix = o.host === "gmix";
  if (!gmix && !s.company.domain) return fail("error.needsDomain");
  const domain = gmix ? GMIX_DOMAIN : companyDomain(s), others = liveOn(s, domain);
  if (gmix ? others.length >= GMIX_TENANTS : others.length >= 2 || others.some((t) => t.host === o.host)) return fail(gmix ? "error.mailLimit" : "error.mailHasTenant");
  const t: MailTenant = { id: `tn${s.nextId++}`, host: o.host, domain, plan: o.plan, since: s.hour, verified: gmix || o.host === "self", endsAt: null, admin: null,
    ...(o.clusterId && { clusterId: o.clusterId }) };
  s.mail = { ...s.mail, tenants: [...s.mail.tenants, t] };
  if (!gmix) for (const e of s.staff) if (canAddMailbox(s, tenant(s, t.id))) employeeMailbox(s, tenant(s, t.id), e.id, e.name);
  return { ok: true, id: t.id };
}
const tenant = (s: GameState, id: string) => s.mail.tenants.find((t) => t.id === id)!;

export function verifyTenant(s: GameState, id: string): ActionResult {
  if (!s.mail.tenants.some((t) => t.id === id)) return fail("error.mailNoService");
  s.mail = { ...s.mail, tenants: s.mail.tenants.map((t) => (t.id === id ? { ...t, verified: true } : t)) };
  return { ok: true, id };
}

// A tier change or upgrade; a smaller plan has to hold the mailboxes already there.
export function setTenantPlan(s: GameState, id: string, plan: string): ActionResult {
  const t = s.mail.tenants.find((x) => x.id === id), p = t && mailPlan(t.host, plan);
  if (!t || !p) return fail("error.mailNoService");
  if (!onSale(p, s.hour)) return fail("error.mailProviderLater");
  const next = { ...t, plan, since: s.hour }, cap = mailboxCap(t.host, plan, s.hour);
  if (cap !== null && openBoxes(s, id).length > cap) return fail("error.mailQuotaPlan");
  s.mail = { ...s.mail, tenants: s.mail.tenants.map((x) => (x.id === id ? next : x)) };
  return { ok: true, id };
}

// The 2022 conversion lock: sign-in is refused and incoming mail bounces until unlocked.
export function setTenantLock(s: GameState, id: string, locked: boolean): ActionResult {
  if (!s.mail.tenants.some((t) => t.id === id)) return fail("error.mailNoService");
  s.mail = { ...s.mail, tenants: s.mail.tenants.map((t) => (t.id !== id ? t : locked ? { ...t, locked: true } : (({ locked: _l, ...rest }) => rest)(t))) };
  return { ok: true, id };
}

// The Email sheet switched at once: earlier domain tenants end now, and the MX record points at the new host live.
function switchDomainMail(s: GameState, host: string, plan: string, clusterId?: string): ActionResult {
  const d = companyDomain(s);
  endDomainTenants(s);
  const r = createTenant(s, { host, plan, clusterId });
  if (!r.ok) return r;
  const t = tenant(s, r.id!);
  verifyTenant(s, t.id);
  const sales = addMailbox(s, t, "sales", s.company.name, seededPassword(s.seed, s.nextId), { roles: ["owner", "sales", "support", "abuse"] });
  s.mail = { ...s.mail, primary: sales.id, tenants: s.mail.tenants.map((x) => (x.id === t.id ? { ...x, admin: sales.id } : x)),
    accounts: s.mail.accounts.map((a) => (a.id === sales.id ? a : { ...a, roles: [] })) };
  pointMx(s, host, d);
  return { ok: true, id: t.id };
}

function endDomainTenants(s: GameState): void {
  const ids = new Set(liveOn(s, companyDomain(s)).map((t) => t.id));
  s.mail = { ...s.mail, tenants: s.mail.tenants.map((t) => (ids.has(t.id) ? { ...t, endsAt: s.hour } : t)),
    accounts: s.mail.accounts.map((a) => (ids.has(a.tenant) && a.closedAt === null ? { ...a, closedAt: s.hour } : a)) };
}

function pointMx(s: GameState, host: string, domain: string): void {
  const mx = mxSetAt(host, domain, s.hour).map(([p, h]): CompanyRecord => ({ id: `z${s.nextId++}`, type: "MX", name: "@", ttl: 3600, data: `${p} ${h}` }));
  s.company = { ...s.company, zone: [...s.company.zone.filter((r) => !(r.type === "MX" && r.name === "@")), ...mx] };
}

// Books an external mail provider for the company; the seats follow the staff and are billed at each month start.
export function bookMail(s: GameState, provider: MailProviderId): ActionResult {
  const p = providerById(provider);
  if (!p) return fail("error.unknownMailProvider");
  if (!s.company.domain) return fail("error.needsDomain");
  if (yearOf(s.hour) < p.from) return fail("error.mailProviderLater");
  const [host, plan] = PROVIDER_HOSTS[provider];
  const r = switchDomainMail(s, host, plan);
  if (!r.ok) return r;
  s.company = { ...s.company, mail: { kind: "external", provider, seats: seatsBilled(s, tenant(s, r.id!)) } };
  return { ok: true, id: provider };
}

// Takes the mail server the company runs (Email app, Change provider) back into use after another service.
export function selectMailServer(s: GameState, clusterId?: string, software?: SelfMailSoftware): ActionResult {
  const c = s.clusters.find((x) => x.kind === "mail" && (!clusterId || x.id === clusterId));
  software ??= (c && (c.panel ?? c.switching?.to)) as SelfMailSoftware | undefined;
  if (!c || !software) return fail("error.noMailServer");
  // Without a domain the server holds no mailboxes yet; the company mail still names it.
  if (s.company.domain) {
    const r = switchDomainMail(s, "self", "self", c.id);
    if (!r.ok) return r;
  }
  s.company = { ...s.company, mail: { kind: "self", software: software as SelfMailSoftware, clusterId: c.id } };
  return { ok: true, id: c.id };
}

// Cancels the company's mail service and goes back to free GMix; a mail server stays installed.
export function cancelMail(s: GameState): ActionResult {
  if (s.company.mail.kind === "free") return fail("error.noMailService");
  endDomainTenants(s);
  let box = s.mail.accounts.find((a) => a.domain === GMIX_DOMAIN && a.closedAt === null);
  if (!box) {
    const r = createTenant(s, { host: "gmix", plan: "free" });
    if (!r.ok) return r;
    box = addMailbox(s, tenant(s, r.id!), gmixLocal(s.company.name), s.company.name, seededPassword(s.seed, s.nextId), { external: false });
  }
  const id = box.id;
  s.mail = { ...s.mail, primary: id, accounts: s.mail.accounts.map((a) => ({ ...a, roles: a.id === id ? ["owner", "sales", "support", "abuse"] : [] })) };
  s.company = { ...s.company, mail: { kind: "free" } };
  return { ok: true };
}
