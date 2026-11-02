// Mail hosts by era (docs/design/plans/mail-core.md, Providers by era). Core owns the row shape and the capability fields;
// the provider lanes own the rows of their products: GMix and Goggle from webmail-consumer, Ionose, Lookout 365 and the own
// server from webmail-server. The Ionose, Lookout and own-server figures are core's defaults until webmail-server replaces them.
import { hourOfMonth } from "../00-core/time";

export type MailHostId = "gmix" | "goggle" | "ionose" | "lookout" | "self";
export type ServerFilters = "none" | "rules" | "filters" | "sieve";
export type MailProtocol = "imap" | "pop" | "smtp";

// [month the value starts, megabytes, ramp]: a ramp grows linearly toward the next anchor, as the Goggle counter does.
export type QuotaAnchor = [from: string, mb: number, ramp?: true];
// [month the value starts, value], in month order.
export type Steps<T> = [from: string, value: T][];

export interface MailPlan {
  id: string;
  from: string;                     // first month on sale
  until: string | null;             // month sales stop; tenants already on it keep it
  price: (year: number) => number;  // euro per mailbox and month
  mailboxes: Steps<number | null>;  // per tenant, by sign-up month; null is unlimited
  quota: QuotaAnchor[];
  imapFrom: number;
  popFrom: number;
  attachMb: (year: number) => number;
  folderMax: number;
  filterMax: number;
  collectors: number;
  footer: string | null;            // i18n key appended to sent mail
  pollGapMin: (year: number) => number;
  ads: boolean;                     // banners in the webmail
}

export interface MailHost {
  id: MailHostId;
  from: number;
  plans: MailPlan[];
  webmail: string | null;           // webmail id; the own server's comes from installedWebmail
  labels: boolean;
  serverFilters: ServerFilters;     // the own server's comes from selfHostCaps
  aliasMax: number;
  catchAll: boolean;
  autoconfig: boolean;
  sharedFree: boolean;              // shared mailboxes are not billed
  servers: Record<MailProtocol, string> | null;  // host names for clients; null for the own server, which is mail.<domain>
  mx: string[];                     // MX hosts of a domain on this host; empty for the own server, which is mail.<domain>
}

export interface MailCaps {
  imap: boolean; pop: boolean; webmail: string | null; labels: boolean; serverFilters: ServerFilters;
  aliasMax: number; catchAll: boolean; autoconfig: boolean; quotaMb: number;
  attachMb: number; folderMax: number; filterMax: number; collectors: number; footer: string | null; pollGapMin: number;
}

// Core's caps on what a mailbox may hold, whatever the plan allows.
export const FOLDER_CAP = 40;
export const FILTER_CAP = 20;
export const SELF_QUOTA_MB = 1024;
// The year IMAP opens to GMix FreeMix (mail-suite ruling: from webmail-consumer).
export const IMAP_FREE_FROM = 2012;
export const WEBMAIL_IDS = ["gmix", "gmial", "ionose", "lookout", "squarecube"] as const;

const GB = 1024;
const flat = (n: number) => () => n;
const from = (year: number, before: number, after: number) => (y: number) => (y >= year ? after : before);
const goggleQuota: QuotaAnchor[] = [["2006-08", 2 * GB, true], ["2007-01", 2.8 * GB, true], ["2008-01", 6 * GB, true], ["2010-01", 7.6 * GB, true], ["2012-01", 10 * GB], ["2014-01", 30 * GB]];
const plan = (p: Partial<MailPlan> & Pick<MailPlan, "id" | "from" | "price" | "quota">): MailPlan => ({
  until: null, mailboxes: [[p.from, null]], imapFrom: +p.from.slice(0, 4), popFrom: +p.from.slice(0, 4), attachMb: flat(25),
  folderMax: FOLDER_CAP, filterMax: FILTER_CAP, collectors: 0, footer: null, pollGapMin: flat(0), ads: false, ...p,
});
const one: Steps<number | null> = [["2005-01", 1]];

export const MAIL_HOSTS: MailHost[] = [
  {
    id: "gmix", from: 2005, webmail: "gmix", labels: false, serverFilters: "rules", aliasMax: 0, catchAll: false, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.gmix.net", pop: "pop.gmix.net", smtp: "smtp.gmix.net" }, mx: ["mx00.gmix.net", "mx01.gmix.net"],
    // FreeMix, ProMix and TopMix (GMX FreeMail, ProMail and TopMail): 1, 5 and 10 GB, 2.99 and 4.99 euro, as GMX sold them from 2004.
    plans: [
      plan({ id: "free", from: "2005-01", price: flat(0), mailboxes: one, quota: [["2005-01", GB]], imapFrom: IMAP_FREE_FROM, attachMb: from(2012, 5, 20),
        folderMax: 5, filterMax: 5, collectors: 1, footer: "mail.footer.gmix", pollGapMin: (y) => (y < IMAP_FREE_FROM ? 15 : 0), ads: true }),
      plan({ id: "pro", from: "2005-01", price: from(2015, 2.99, 3.99), mailboxes: one, quota: [["2005-01", 5 * GB]], attachMb: from(2012, 20, 50), folderMax: 20, filterMax: 10, collectors: 3 }),
      plan({ id: "top", from: "2005-01", price: from(2015, 4.99, 6.49), mailboxes: one, quota: [["2005-01", 10 * GB]], attachMb: from(2012, 50, 100), folderMax: 40, filterMax: 20, collectors: 5 }),
    ],
  },
  {
    id: "goggle", from: 2006, webmail: "gmial", labels: true, serverFilters: "filters", aliasMax: 30, catchAll: true, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.goggle.com", pop: "pop.goggle.com", smtp: "smtp.goggle.com" },
    mx: ["aspmx.l.goggle.com", "alt1.aspmx.l.goggle.com", "alt2.aspmx.l.goggle.com", "alt3.aspmx.l.goggle.com", "alt4.aspmx.l.goggle.com", "smtp.goggle.com"],
    // The free edition (Apps for Your Domain, then Standard Edition) until new sign-ups closed on 2012-12-06, and the paid one
    // (Premier Edition from 2007-02-22: 10 GB, 25 GB from 2007-10, 30 GB pooled from 2013-05).
    plans: [
      plan({ id: "free", from: "2006-08", until: "2012-12", price: flat(0), mailboxes: [["2006-08", 200], ["2007-02", 100], ["2009-06", 50], ["2011-05", 10]],
        quota: goggleQuota, imapFrom: 2007, collectors: 5, ads: true }),
      plan({ id: "paid", from: "2007-02", price: from(2020, 4, 5), quota: [["2007-02", 10 * GB], ["2007-10", 25 * GB], ["2013-05", 30 * GB]], collectors: 5 }),
    ],
  },
  {
    id: "ionose", from: 2005, webmail: "ionose", labels: false, serverFilters: "rules", aliasMax: 10, catchAll: true, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.ionose.de", pop: "pop.ionose.de", smtp: "smtp.ionose.de" }, mx: ["mx00.ionose.de", "mx01.ionose.de"],
    plans: [plan({ id: "exchange", from: "2005-01", price: (y) => Math.max(6, 10 - 0.4 * (y - 2005)), quota: [["2005-01", 500], ["2009-01", 2 * GB], ["2013-01", 10 * GB], ["2016-01", 50 * GB]], attachMb: flat(20) })],
  },
  {
    id: "lookout", from: 2011, webmail: "lookout", labels: false, serverFilters: "rules", aliasMax: 50, catchAll: true, autoconfig: true, sharedFree: true,
    servers: { imap: "imap.lookout365.com", pop: "pop.lookout365.com", smtp: "smtp.lookout365.com" }, mx: ["mail.protection.lookout365.com"],
    plans: [plan({ id: "business", from: "2011-01", price: from(2022, 5, 6), quota: [["2011-01", 25 * GB], ["2013-01", 50 * GB], ["2016-01", 100 * GB]] })],
  },
  {
    id: "self", from: 2005, webmail: null, labels: false, serverFilters: "none", aliasMax: 50, catchAll: true, autoconfig: false, sharedFree: true, servers: null, mx: [],
    plans: [plan({ id: "self", from: "2005-01", price: flat(0), quota: [["2005-01", SELF_QUOTA_MB]], attachMb: flat(50) })],
  },
];

export const mailHost = (id: string): MailHost | undefined => MAIL_HOSTS.find((h) => h.id === id);
export const mailPlan = (host: string, plan: string): MailPlan | undefined => mailHost(host)?.plans.find((p) => p.id === plan);
export const stepAt = <T>(steps: Steps<T>, hour: number): T => steps.reduce((v, [m, x]) => (hourOfMonth(m) <= hour ? x : v), steps[0][1]);
// The MX hosts a domain on this host may point at.
export const mxOf = (host: string, domain: string): string[] => (host === "self" ? [`mail.${domain}`] : mailHost(host)?.mx ?? []);
export const onSale = (p: MailPlan, hour: number): boolean => hour >= hourOfMonth(p.from) && (p.until === null || hour < hourOfMonth(p.until));
// The tenant's cap is the one of its sign-up month, as Goggle kept older free domains at their old limit.
export const mailboxCap = (host: string, plan: string, since: number): number | null => {
  const p = mailPlan(host, plan);
  return p ? stepAt(p.mailboxes, since) : null;
};

// Goggle's printed MX set: five records until 2012, the same five reweighted from 2013, one from 2023.
const GOGGLE_MX: Steps<[number, string][]> = [
  ["2006-08", [[10, "aspmx.l.goggle.com"], [20, "alt1.aspmx.l.goggle.com"], [20, "alt2.aspmx.l.goggle.com"], [30, "alt3.aspmx.l.goggle.com"], [30, "alt4.aspmx.l.goggle.com"]]],
  ["2013-01", [[1, "aspmx.l.goggle.com"], [5, "alt1.aspmx.l.goggle.com"], [5, "alt2.aspmx.l.goggle.com"], [10, "alt3.aspmx.l.goggle.com"], [10, "alt4.aspmx.l.goggle.com"]]],
  ["2023-01", [[1, "smtp.goggle.com"]]],
];
// The MX records [priority, host] a provider tells the player to set at the hour.
export const mxSetAt = (host: string, domain: string, hour: number): [number, string][] =>
  host === "goggle" ? stepAt(GOGGLE_MX, hour) : mxOf(host, domain).map((h, i) => [10 * (i + 1), h]);

// A pure function of the hour, so the Goggle storage counter can tick on screen with no stored state.
export function quotaMbAt(host: string, plan: string, hour: number): number {
  const q = mailPlan(host, plan)?.quota ?? [["2005-01", SELF_QUOTA_MB]];
  const at = q.map(([m]) => hourOfMonth(m));
  const i = at.filter((h) => h <= hour).length - 1;
  if (i < 0) return q[0][1];
  const [, mb, ramp] = q[i];
  if (!ramp || i === q.length - 1) return mb;
  return Math.round(mb + ((q[i + 1][1] - mb) * (hour - at[i])) / (at[i + 1] - at[i]));
}

export interface MailServer { host: string; port: number; ssl: boolean }

// The servers a client is configured with; a protocol the host does not offer in the year is null.
export function mailServersOf(hostId: string, domain: string, year: number): Record<MailProtocol, MailServer | null> {
  const h = mailHost(hostId), name = (p: MailProtocol) => h?.servers?.[p] ?? `mail.${domain}`;
  const offers = (first: (p: MailPlan) => number) => !!h && year >= h.from && h.plans.some((p) => year >= first(p));
  return {
    imap: offers((p) => p.imapFrom) ? { host: name("imap"), port: 993, ssl: true } : null,
    pop: offers((p) => p.popFrom) ? { host: name("pop"), port: 995, ssl: true } : null,
    smtp: h && year >= h.from ? { host: name("smtp"), port: 587, ssl: true } : null,
  };
}
