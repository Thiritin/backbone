// GDD, Company email: the company starts on free GMix and can move to an external provider or a mail server of its own.
// Numbers in economy.md, Company email.
import { isMonthStart, yearOf } from "../00-core/time";
import type { GameState, LedgerEntry } from "../50-state";
import type { Profile } from "../30-customers/customers";
import { anchorOf, controlPlaneUp, type Cluster } from "../60-infra/cluster";
import { mailAddress } from "../60-infra/addresses";
import { linkStatus } from "../60-infra/status";
import { mailPlan } from "../10-catalog/mail-providers";
import { roleAccount, roleAddress, seatsBilled } from "../42-mail/accounts";
import { mxTarget } from "../42-mail/caps";
import { tenantOf } from "../42-mail/address";

export type MailProviderId = "hostedExchange" | "goggleWorkspace" | "lookout365";
export type SelfMailSoftware = "postfixit" | "mailpig";
export type CompanyMail =
  | { kind: "free" }
  | { kind: "external"; provider: MailProviderId; seats: number }
  | { kind: "self"; software: SelfMailSoftware; clusterId: string };

export interface MailProvider { id: MailProviderId; name: string; from: number; price: (year: number) => number }

export const MAIL_PROVIDERS: MailProvider[] = [
  { id: "hostedExchange", name: "Hosted Exchange by Ionose", from: 2005, price: (y) => Math.max(6, 10 - 0.4 * (y - 2005)) },
  { id: "goggleWorkspace", name: "Goggle Workspace", from: 2007, price: (y) => (y >= 2020 ? 5 : 4) },
  { id: "lookout365", name: "Lookout 365", from: 2011, price: (y) => (y >= 2022 ? 6 : 5) },
];
export const FREEMAIL = "GMix";
// The catalog host and plan behind each provider of the Email sheet.
export const PROVIDER_HOSTS: Record<MailProviderId, [host: string, plan: string]> = {
  hostedExchange: ["ionose", "exchange"], goggleWorkspace: ["goggle", "paid"], lookout365: ["lookout", "business"],
};

// The address customers write to: the sales mailbox.
export const salesAddress = (s: GameState): string => roleAddress(s, "sales");
const salesHost = (s: GameState): string | undefined => {
  const a = roleAccount(s, "sales");
  return a && tenantOf(s, a)?.host;
};

export const providerById = (id: string): MailProvider | undefined => MAIL_PROVIDERS.find((p) => p.id === id);

// While the mail host is down or its address is listed, invoices sent in that window are paid this many hours later.
export const MAIL_DELAY_HOURS = 72;
// The share of email orders that still arrive while delivery is impaired.
export const IMPAIRED_SHARE = 0.5;


export const mailHost = (s: GameState): Cluster | undefined => {
  const m = s.company.mail;
  return m.kind === "self" ? s.clusters.find((c) => c.id === m.clusterId) : undefined;
};

// A self-hosted mail server delivers while it runs, has a public address and that address is not listed.
export function mailImpaired(s: GameState): boolean {
  if (s.company.mail.kind !== "self" || salesHost(s) !== "self") return false;
  const c = mailHost(s), at = c && anchorOf(s, c);
  if (!c || !at || !controlPlaneUp(s, c) || !linkStatus(s, at).online) return true;
  const a = mailAddress(s, c.id);
  return !a || a.listed;
}

// The share of businesses that still write to a freemail sales address.
export const FREEMAIL_BUSINESS_SHARE = 0.5;
const PERSONS: Profile[] = ["private", "gamer", "hobbyDev"];

// What reaches the company by email: half while delivery is impaired, and half of the businesses while it uses GMix.
export const mailShare = (s: GameState, profile: Profile = "private"): number =>
  (mailImpaired(s) ? IMPAIRED_SHARE : 1) * (salesHost(s) === "gmix" && !PERSONS.includes(profile) ? FREEMAIL_BUSINESS_SHARE : 1);

// Hours an invoice sent now waits longer for its payment.
export const mailDelay = (s: GameState): number => (mailImpaired(s) ? MAIL_DELAY_HOURS : 0);

// The mailboxes a new domain tenant bills: the sales box and one for every employee.
export const seatsFor = (s: GameState): number => 1 + s.staff.length;
const hostName = (host: string): string => MAIL_PROVIDERS.find((p) => PROVIDER_HOSTS[p.id][0] === host)?.name ?? FREEMAIL;

// Monthly: every live tenant pays its billed mailboxes at the price of its plan, from the first month start after sign-up.
export function mailTick(s: GameState): void {
  if (!isMonthStart(s.hour)) return;
  const year = yearOf(s.hour);
  for (const t of s.mail.tenants) {
    if (t.since >= s.hour || (t.endsAt !== null && t.endsAt <= s.hour)) continue;
    const price = mailPlan(t.host, t.plan)?.price(year) ?? 0, seats = seatsBilled(s, t), amount = Math.round(seats * price * 100) / 100;
    if (amount <= 0) continue;
    const e: LedgerEntry = { hour: s.hour, category: "subscriptions", key: "ledger.companyMail", params: { name: hostName(t.host), seats }, amount: -amount };
    s.cash = Math.round((s.cash - amount) * 100) / 100;
    s.ledger = [...s.ledger, e];
  }
  const m = s.company.mail, target = mxTarget(s);
  if (m.kind === "external" && target) s.company = { ...s.company, mail: { ...m, seats: seatsBilled(s, target) } };
}

