// GMix and Goggle terms by date (docs/design/plans/webmail-consumer.md, 3.1 and 4.1). The rows are in mail-providers.ts.
import { hourOfMonth } from "../00-core/time";
import type { MailKind, Message } from "../42-mail/types";
import { stepAt, type Steps } from "./mail-providers";

export type GoggleBrand = "appsDomain" | "apps" | "swoot" | "workspace";
export type GmialCategory = "primary" | "social" | "promotions" | "updates" | "forums";

const BRANDS: Steps<GoggleBrand> = [["2006-08", "appsDomain"], ["2007-02", "apps"], ["2016-09", "swoot"], ["2020-10", "workspace"]];
const EDITIONS: Record<string, Steps<string>> = {
  free: [["2006-08", "standard"], ["2016-09", "legacy"]],
  paid: [["2007-02", "premier"], ["2010-11", "business"], ["2014-09", "work"], ["2016-09", "basic"], ["2020-10", "starter"]],
};

// i18n key of the product name: mail.goggle.brand.<id>.
export const brandAt = (hour: number): GoggleBrand => stepAt(BRANDS, hour);
// i18n key of a Goggle edition's label: mail.goggle.edition.<id>.
export const editionAt = (plan: string, hour: number): string => stepAt(EDITIONS[plan] ?? EDITIONS.paid, hour);

// Free legacy tenants get the notice from this month and lock on the deadline unless upgraded.
export const GOGGLE_CONVERSION = { notice: "2022-01", lock: "2022-05" } as const;

// The record that proves the domain: a CNAME before 2012, a TXT from 2012.
export const verificationAt = (hour: number, token: string): { type: "CNAME" | "TXT"; name: string; data: string } =>
  hour < hourOfMonth("2012-01")
    ? { type: "CNAME", name: `goggle${token}`, data: "goggle.com" }
    : { type: "TXT", name: "@", data: `goggle-site-verification=${token}` };

const CATEGORY: Record<MailKind, GmialCategory> = {
  support: "primary", order: "primary", reply: "primary", staff: "primary", authority: "primary",
  notice: "updates", licence: "updates", invoice: "updates", bank: "updates", registrar: "updates", host: "updates",
  system: "updates", alert: "updates", bounce: "updates",
  promotion: "promotions", newsletter: "promotions", spam: "promotions",
};
// The Inbox tab of a message; mail delivered through a group is Forums whatever its kind.
export const categoryOf = (kind: MailKind, viaGroup = false): GmialCategory => (viaGroup ? "forums" : CATEGORY[kind]);

const IMPORTANT_KINDS: MailKind[] = ["support", "order", "staff"];
// Gmial's Priority rule: an important kind, a sender the mailbox has written to, or a message it answered.
export const importantOf = (m: Message, wroteTo: Set<string>, answered: Set<string>): boolean =>
  IMPORTANT_KINDS.includes(m.kind) || wroteTo.has(m.from) || answered.has(m.id);
