// What a mailbox's host offers now, and the hooks other lanes fill in (docs/design/plans/mail-core.md, Providers by era).
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { companyDomain } from "../30-customers/domains";
import { FILTER_CAP, FOLDER_CAP, mailHost, mailPlan, quotaMbAt, type MailCaps, type ServerFilters } from "../10-catalog/mail-providers";
import type { MailAccount, MailTenant } from "./types";

export interface SelfHostCaps { imap: boolean; pop: boolean; filters: ServerFilters; autoconfig: boolean; catchBoost: number }

// webmail-server assigns installedWebmail and selfHostCaps, webmail-consumer's company zone assigns mxTarget, each at load.
export const mailHooks = {
  installedWebmail: (_s: GameState): string | null => null,
  // Postfixit installs Dovecoat and Mailpig bundles it; only Mailpig answers autoconfig.
  selfHostCaps: (s: GameState): SelfHostCaps => ({
    imap: true, pop: true, filters: "none", autoconfig: s.company.mail.kind === "self" && s.company.mail.software === "mailpig", catchBoost: 0,
  }),
  // The tenant that receives the company domain's mail: the one live tenant on the domain.
  mxTarget: (s: GameState): MailTenant | null => {
    const d = companyDomain(s);
    return s.mail.tenants.find((t) => t.domain === d && t.endsAt === null) ?? null;
  },
};

export const installedWebmail = (s: GameState) => mailHooks.installedWebmail(s);
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
    serverFilters: self ? self.filters : host.serverFilters,
    aliasMax: host.aliasMax,
    catchAll: host.catchAll,
    autoconfig: self ? self.autoconfig : host.autoconfig,
    quotaMb: account.quotaMb ?? quotaMbAt(tenant.host, plan.id, s.hour),
    attachMb: plan.attachMb(year),
    folderMax: Math.min(plan.folderMax, FOLDER_CAP),
    filterMax: Math.min(plan.filterMax, FILTER_CAP),
    collectors: plan.collectors,
    footer: plan.footer,
    pollGapMin: plan.pollGapMin(year),
  };
}
