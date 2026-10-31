// GDD, Company email: the company starts on free GMix and can move to an external provider or a mail server of its own.
// Numbers in economy.md, Company email.
import { isMonthStart, yearOf } from "../00-core/time";
import type { GameState, LedgerEntry } from "../50-state";
import type { Profile } from "../30-customers/customers";
import { anchorOf, controlPlaneUp, type Cluster } from "../60-infra/cluster";
import { mailAddress } from "../60-infra/addresses";
import { linkStatus } from "../60-infra/status";
import { ascii, companyDomain } from "../30-customers/domains";

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

// The address customers write to: a free GMix box until the company has mail under its own domain.
export const salesAddress = (s: GameState): string =>
  s.company.mail.kind === "free" ? `${ascii(s.company.name) || "hosting"}@gmix.com` : `sales@${companyDomain(s)}`;

export const providerById = (id: string): MailProvider | undefined => MAIL_PROVIDERS.find((p) => p.id === id);

// While the mail host is down or its address is listed, invoices sent in that window are paid this many hours later.
export const MAIL_DELAY_HOURS = 72;
// The share of email orders that still arrive while delivery is impaired.
export const IMPAIRED_SHARE = 0.5;

// One seat for the owner and one for every employee.
export const seatsFor = (s: GameState): number => 1 + s.staff.length;

export const mailHost = (s: GameState): Cluster | undefined => {
  const m = s.company.mail;
  return m.kind === "self" ? s.clusters.find((c) => c.id === m.clusterId) : undefined;
};

// A self-hosted mail server delivers while it runs, has a public address and that address is not listed.
export function mailImpaired(s: GameState): boolean {
  const m = s.company.mail;
  if (m.kind !== "self") return false;
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
  (mailImpaired(s) ? IMPAIRED_SHARE : 1) * (s.company.mail.kind === "free" && !PERSONS.includes(profile) ? FREEMAIL_BUSINESS_SHARE : 1);

// Hours an invoice sent now waits longer for its payment.
export const mailDelay = (s: GameState): number => (mailImpaired(s) ? MAIL_DELAY_HOURS : 0);

// Monthly: the seats follow the staff, then the provider is paid per seat.
export function mailTick(s: GameState): void {
  const m = s.company.mail;
  if (!isMonthStart(s.hour) || m.kind !== "external") return;
  const p = providerById(m.provider)!, seats = seatsFor(s), amount = Math.round(seats * p.price(yearOf(s.hour)) * 100) / 100;
  s.company = { ...s.company, mail: { ...m, seats } };
  const e: LedgerEntry = { hour: s.hour, category: "subscriptions", key: "ledger.companyMail", params: { name: p.name, seats }, amount: -amount };
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  s.ledger = [...s.ledger, e];
}

