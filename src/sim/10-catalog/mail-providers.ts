// Mail hosts by era (docs/design/plans/mail-core.md, Providers by era). Core owns the row shape and the capability fields;
// the provider lanes own the rows of their products: GMix and Goggle from webmail-consumer, Ionose, Lookout 365 and the own
// server from webmail-server. The figures here are core's defaults until those lanes replace them.
import { hourOfMonth } from "../00-core/time";

export type MailHostId = "gmix" | "goggle" | "ionose" | "lookout" | "self";
export type ServerFilters = "none" | "rules" | "filters" | "sieve";
export type MailProtocol = "imap" | "pop" | "smtp";

// [month the value starts, megabytes, ramp]: a ramp grows linearly toward the next anchor, as the Goggle counter does.
export type QuotaAnchor = [from: string, mb: number, ramp?: true];

export interface MailPlan {
  id: string;
  from: number;                     // first year on sale
  until: number | null;             // last year on sale; tenants already on it keep it
  price: (year: number) => number;  // euro per mailbox and month
  mailboxes: number | null;         // per tenant; null is unlimited
  quota: QuotaAnchor[];
  imapFrom: number;
  popFrom: number;
  attachMb: (year: number) => number;
  folderMax: number;
  filterMax: number;
  collectors: number;
  footer: string | null;            // i18n key appended to sent mail
  pollGapMin: (year: number) => number;
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
const gmixQuota = (a: number, b: number, c: number): QuotaAnchor[] => [["2005-01", a * GB], ["2009-01", b * GB], ["2014-01", c * GB]];
const goggleQuota: QuotaAnchor[] = [["2007-01", 2.8 * GB, true], ["2008-01", 6 * GB, true], ["2010-01", 7.6 * GB, true], ["2012-01", 10 * GB], ["2014-01", 30 * GB]];
const plan = (p: Partial<MailPlan> & Pick<MailPlan, "id" | "from" | "price" | "quota">): MailPlan => ({
  until: null, mailboxes: null, imapFrom: p.from, popFrom: p.from, attachMb: flat(25), folderMax: FOLDER_CAP, filterMax: FILTER_CAP,
  collectors: 0, footer: null, pollGapMin: flat(0), ...p,
});

export const MAIL_HOSTS: MailHost[] = [
  {
    id: "gmix", from: 2005, webmail: "gmix", labels: false, serverFilters: "rules", aliasMax: 0, catchAll: false, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.gmix.net", pop: "pop.gmix.net", smtp: "smtp.gmix.net" }, mx: ["mx00.gmix.net", "mx01.gmix.net"],
    // Tiers FreeMix, ProMix and TopMix; webmail-consumer milestone 1 owns these terms.
    plans: [
      plan({ id: "free", from: 2005, price: flat(0), mailboxes: 1, quota: gmixQuota(1, 2, 5), imapFrom: IMAP_FREE_FROM, attachMb: from(2012, 5, 20),
        folderMax: 5, filterMax: 5, collectors: 1, footer: "mail.footer.gmix", pollGapMin: (y) => (y < IMAP_FREE_FROM ? 15 : 0) }),
      plan({ id: "pro", from: 2005, price: from(2015, 2.99, 3.99), mailboxes: 1, quota: gmixQuota(2, 4, 10), attachMb: from(2012, 20, 50), folderMax: 20, filterMax: 10, collectors: 3 }),
      plan({ id: "top", from: 2008, price: from(2015, 4.99, 6.49), mailboxes: 1, quota: gmixQuota(5, 10, 25), attachMb: from(2012, 50, 100), folderMax: 40, filterMax: 20, collectors: 5 }),
    ],
  },
  {
    id: "goggle", from: 2007, webmail: "gmial", labels: true, serverFilters: "filters", aliasMax: 30, catchAll: true, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.goggle.com", pop: "pop.goggle.com", smtp: "smtp.goggle.com" }, mx: ["aspmx.l.goggle.com", "alt1.aspmx.l.goggle.com"],
    // Standard and Premier Edition; webmail-consumer milestone 1 owns the editions and their years (Standard Edition 2006 to 2012).
    plans: [
      plan({ id: "standard", from: 2007, until: 2012, price: flat(0), mailboxes: 50, quota: goggleQuota, collectors: 5 }),
      plan({ id: "premier", from: 2007, price: from(2020, 4, 5), quota: goggleQuota, collectors: 5 }),
    ],
  },
  {
    id: "ionose", from: 2005, webmail: "ionose", labels: false, serverFilters: "rules", aliasMax: 10, catchAll: true, autoconfig: true, sharedFree: false,
    servers: { imap: "imap.ionose.de", pop: "pop.ionose.de", smtp: "smtp.ionose.de" }, mx: ["mx00.ionose.de", "mx01.ionose.de"],
    plans: [plan({ id: "exchange", from: 2005, price: (y) => Math.max(6, 10 - 0.4 * (y - 2005)), quota: [["2005-01", 500], ["2009-01", 2 * GB], ["2013-01", 10 * GB], ["2016-01", 50 * GB]], attachMb: flat(20) })],
  },
  {
    id: "lookout", from: 2011, webmail: "lookout", labels: false, serverFilters: "rules", aliasMax: 50, catchAll: true, autoconfig: true, sharedFree: true,
    servers: { imap: "imap.lookout365.com", pop: "pop.lookout365.com", smtp: "smtp.lookout365.com" }, mx: ["mail.protection.lookout365.com"],
    plans: [plan({ id: "business", from: 2011, price: from(2022, 5, 6), quota: [["2011-01", 25 * GB], ["2013-01", 50 * GB], ["2016-01", 100 * GB]] })],
  },
  {
    id: "self", from: 2005, webmail: null, labels: false, serverFilters: "none", aliasMax: 50, catchAll: true, autoconfig: false, sharedFree: true, servers: null, mx: [],
    plans: [plan({ id: "self", from: 2005, price: flat(0), quota: [["2005-01", SELF_QUOTA_MB]], attachMb: flat(50) })],
  },
];

export const mailHost = (id: string): MailHost | undefined => MAIL_HOSTS.find((h) => h.id === id);
export const mailPlan = (host: string, plan: string): MailPlan | undefined => mailHost(host)?.plans.find((p) => p.id === plan);
// The MX hosts a domain on this host points at.
export const mxOf = (host: string, domain: string): string[] => (host === "self" ? [`mail.${domain}`] : mailHost(host)?.mx ?? []);
export const onSale = (p: MailPlan, year: number): boolean => year >= p.from && (p.until === null || year <= p.until);

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
