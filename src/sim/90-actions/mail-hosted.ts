// Player actions of the Ionose and Lookout 365 sites (docs/design/plans/webmail-server.md, section 7). The control pages
// call mail-core's mailbox, alias, password, plan and tenant actions directly.
import { lookoutToken } from "../10-catalog/mail-hosted";
import { mxOf } from "../10-catalog/mail-providers";
import type { ServerFilter } from "../42-mail/types";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { mxHostsAt, recordAt } from "../60-infra/company-zone";
import type { ActionResult } from "./hardware";
import { verifyTenant } from "./mail";
import { signUpTenant } from "./mail-provider";
import { saveFilter } from "./mailbox";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The order: the company domain, the plan and the mailbox that administers the contract.
export function orderIonose(s: GameState, o: { domain: string; plan: string; local: string; title: string; password: string }): ActionResult {
  if (!s.company.domain || o.domain.trim().toLowerCase() !== companyDomain(s)) return fail("error.needsDomain");
  return signUpTenant(s, { host: "ionose", plan: o.plan }, o);
}

// Ionose proves the domain by its MX records pointing at the Ionose mail servers.
export function checkIonoseDomain(s: GameState, tenantId: string): ActionResult {
  const t = s.mail.tenants.find((x) => x.id === tenantId && x.host === "ionose");
  if (!t) return fail("error.mailNoService");
  const want = mxOf("ionose", t.domain);
  if (!mxHostsAt(s, s.hour).some((h) => want.includes(h))) return fail("error.ionoseMx");
  return verifyTenant(s, tenantId);
}

// The sign-up: the company domain, the plan and the global admin; the domain is verified on the Domains page.
export function signUpLookout(s: GameState, o: { domain: string; plan: string; local: string; title: string; password: string }): ActionResult {
  if (!s.company.domain || o.domain.trim().toLowerCase() !== companyDomain(s)) return fail("error.needsDomain");
  return signUpTenant(s, { host: "lookout", plan: o.plan }, o);
}

// Lookout 365 proves the domain by the TXT record it showed at sign-up.
export function verifyLookout(s: GameState, tenantId: string): ActionResult {
  const t = s.mail.tenants.find((x) => x.id === tenantId && x.host === "lookout");
  if (!t) return fail("error.mailNoService");
  const want = lookoutToken(s.seed, t.domain);
  if (!recordAt(s, "TXT", "@", s.hour).some((r) => r.data.replace(/"/g, "").trim() === want)) return fail("error.lookoutVerify");
  return verifyTenant(s, tenantId);
}

// A mail flow rule of the organisation: the same server filter on every user mailbox of the tenant.
export function addOrgRule(s: GameState, tenantId: string, f: Omit<ServerFilter, "accountId" | "id">): ActionResult {
  const boxes = s.mail.accounts.filter((a) => a.tenant === tenantId && a.closedAt === null && !a.shared);
  if (!s.mail.tenants.some((x) => x.id === tenantId && x.host === "lookout") || !boxes.length) return fail("error.mailNoService");
  const before = s.mail;
  for (const a of boxes) {
    const r = saveFilter(s, a.id, f);
    if (!r.ok) { s.mail = before; return r; }
  }
  return { ok: true, id: tenantId };
}
