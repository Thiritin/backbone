import type { GameState } from "../50-state";
import { companyDomain } from "../30-customers/domains";
import { providerById, type MailProviderId } from "../80-business/mail";
import { emptyMail, gmixLocal, GMIX_DOMAIN, seededPassword, startMail } from "../42-mail/new";
import type { MailState, MailTenant } from "../42-mail/types";

const HOSTS: Record<MailProviderId, [host: string, plan: string]> = {
  hostedExchange: ["ionose", "exchange"], goggleWorkspace: ["goggle", "premier"], lookout365: ["lookout", "business"],
};
const SOFTWARE_NAMES = { postfixit: "Postfixit", mailpig: "Mailpig" };

// Saves from before mailboxes get a tenant for their mail service and a primary mailbox on the sales address.
export function fillMail(s: GameState, saved: Partial<MailState> | undefined): void {
  if (saved) {
    s.mail = { ...emptyMail(), ...saved };
    return;
  }
  const m = s.company.mail, pw = seededPassword(s.seed, 1), name = s.company.name;
  const tenant = (host: string, domain: string, plan: string, extra: Partial<MailTenant> = {}): MailTenant =>
    ({ id: "tn1", host, domain, plan, since: s.hour, verified: true, endsAt: null, admin: null, ...extra });
  if (m.kind === "free") s.mail = startMail(tenant("gmix", GMIX_DOMAIN, "free"), gmixLocal(name), name, pw, "GMix", s.hour);
  else if (m.kind === "external") {
    const [host, plan] = HOSTS[m.provider];
    s.mail = startMail(tenant(host, companyDomain(s), plan), "sales", name, pw, providerById(m.provider)!.name, s.hour);
  } else s.mail = startMail(tenant("self", companyDomain(s), "self", { clusterId: m.clusterId }), "sales", name, pw, SOFTWARE_NAMES[m.software], s.hour);
}
