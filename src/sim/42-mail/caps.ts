// What a mailbox's host offers now, and the hooks other lanes fill in (docs/design/plans/mail-core.md, Providers by era).
import { nowHours, yearOf } from "../00-core/time";
import { mxHostsAt } from "../60-infra/company-zone";
import type { GameState } from "../50-state";
import { companyDomain } from "../30-customers/domains";
import { FILTER_CAP, FOLDER_CAP, mailHost, mailPlan, mxOf, quotaMbAt, type MailCaps } from "../10-catalog/mail-providers";
import type { MailAccount, MailTenant } from "./types";

// junkBonus is added to the own server's catch rate by its spam filter.
export interface SelfHostCaps { imap: boolean; pop: boolean; sieve: boolean; junkBonus: number }

// webmail-server assigns installedWebmail and selfHostCaps at load; mxTarget reads the company zone of webmail-consumer.
export const mailHooks = {
  installedWebmail: (_s: GameState): string | null => null,
  // Postfixit installs Dovecoat and Mailpig bundles it.
  selfHostCaps: (_s: GameState): SelfHostCaps => ({ imap: true, pop: true, sieve: false, junkBonus: 0 }),
  // The tenant that receives the company domain's mail: the live tenant behind the best MX host the world resolves. A host
  // that holds no tenant for the domain rejects the mail, and senders do not retry the next MX after a rejection.
  mxTarget: (s: GameState): MailTenant | null => {
    const d = companyDomain(s), [best] = mxHostsAt(s, nowHours(s));
    return (best && s.mail.tenants.find((t) => t.domain === d && t.endsAt === null && mxOf(t.host, d).includes(best))) || null;
  },
};

export const installedWebmail = (s: GameState): string | null => mailHooks.installedWebmail(s);
export const selfHostCaps = (s: GameState) => mailHooks.selfHostCaps(s);
export const mxTarget = (s: GameState) => mailHooks.mxTarget(s);

export function capsOf(s: GameState, account: MailAccount): MailCaps {
  const tenant = s.mail.tenants.find((x) => x.id === account.tenant)!;
  const year = yearOf(s.hour), host = mailHost(tenant.host)!, plan = mailPlan(tenant.host, tenant.plan) ?? host.plans[0];
  const self = host.id === "self" ? selfHostCaps(s) : null;
  return {
    imap: self ? self.imap : year >= plan.imapFrom,
    pop: self ? self.pop : year >= plan.popFrom,
    webmail: self ? installedWebmail(s) : host.webmail,
    labels: host.labels,
    serverFilters: self ? (self.sieve ? "sieve" : "none") : host.serverFilters,
    aliasMax: host.aliasMax,
    catchAll: host.catchAll,
    // Of the own server software only Mailpig answers autoconfig.
    autoconfig: self ? s.company.mail.kind === "self" && s.company.mail.software === "mailpig" : host.autoconfig,
    quotaMb: account.quotaMb ?? quotaMbAt(tenant.host, plan.id, s.hour),
    attachMb: plan.attachMb(year),
    folderMax: Math.min(plan.folderMax, FOLDER_CAP),
    filterMax: Math.min(plan.filterMax, FILTER_CAP),
    collectors: plan.collectors,
    footer: plan.footer,
    pollGapMin: plan.pollGapMin(year),
  };
}
