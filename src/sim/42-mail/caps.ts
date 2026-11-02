// What a mailbox's host offers now, and the hooks other lanes fill in (docs/design/plans/mail-core.md, Providers by era).
import { nowHours, yearOf } from "../00-core/time";
import { mailAddress } from "../60-infra/addresses";
import { addressesAt, mxHostsAt } from "../60-infra/company-zone";
import { isIpv4 } from "../60-infra/netsvc-dns";
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
  // The tenant that receives the company domain's mail: the live tenant behind the best MX host that resolves. A name in
  // the company zone without an address is skipped as senders skip it; the own server is reached by the address its host
  // name resolves to, a provider by its MX host. A host that holds no tenant for the domain rejects the mail, and senders
  // do not retry the next MX after a rejection.
  mxTarget: (s: GameState): MailTenant | null => {
    const d = companyDomain(s), hour = nowHours(s);
    for (const host of mxHostsAt(s, hour)) {
      const own = host === d || host.endsWith(`.${d}`), ips = own ? addressesAt(s, host, hour) : [];
      if ((own && !ips.length) || isIpv4(host)) continue;
      return s.mail.tenants.find((t) => t.domain === d && t.endsAt === null &&
        (t.host === "self" ? !!t.clusterId && ips.includes(mailAddress(s, t.clusterId)?.ip ?? "") : mxOf(t.host, d).includes(host))) ?? null;
    }
    return null;
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
