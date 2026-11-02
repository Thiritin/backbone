// Player actions of the Ionose and Lookout 365 sites (docs/design/plans/webmail-server.md, section 7). The control pages
// call mail-core's mailbox, alias, password, plan and tenant actions directly.
import { mxOf } from "../10-catalog/mail-providers";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { mxHostsAt } from "../60-infra/company-zone";
import type { ActionResult } from "./hardware";
import { verifyTenant } from "./mail";
import { signUpTenant } from "./mail-provider";

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
