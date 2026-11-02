// The shop's emails to its customers (shop-books-split.md 9.1): one template per occasion, logged as sent and rendered
// through t() when opened, so the log stays small and translates.
import type { Service } from "../30-customers/customers";
import { invoiceTotal, type Invoice } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { mailImpaired } from "./mail";

export const TEMPLATES = [
  "orderConfirmation", "welcome", "invoiceCreated", "paymentConfirmation", "reminder", "overdue1", "overdue2", "overdue3",
  "suspension", "unsuspension", "cancellation", "termination", "quote", "passwordChanged",
] as const;
export type MailTemplate = (typeof TEMPLATES)[number];
// customerId is null for a lead the shop writes to before the account exists; orderId lets the order's customer claim it.
export interface ShopEmail { customerId: string | null; orderId?: string; template: MailTemplate; params: Record<string, string | number>; at: number; failed?: true }

// The dunning steps' templates, in step order.
export const DUNNING: MailTemplate[] = ["reminder", "overdue1", "overdue2", "overdue3"];
const KEEP_HOURS = 365 * 24;

// Sends a template when the shop is live, the template is on and the recipient is a shop customer or a lead. It is logged as
// failed while the company's mail server cannot deliver. Returns whether it reached the customer.
export function shopMail(s: GameState, customerId: string | null, template: MailTemplate, params: Record<string, string | number> = {}, orderId?: string): boolean {
  // ponytail: any installed shop sends, broken or not; shopActive would close an import cycle through billing.ts.
  if (s.shop.variant === null || s.shop.mailOff.includes(template)) return false;
  const c = customerId ? s.customers.find((x) => x.id === customerId) : undefined;
  if (customerId && c?.source !== "shop") return false;
  const failed = mailImpaired(s);
  const mail: ShopEmail = { customerId, ...(orderId && { orderId }), template, params: { name: c?.name ?? "", company: s.company.name, ...params }, at: s.hour, ...(failed && { failed: true as const }) };
  s.shop = { ...s.shop, emails: [...s.shop.emails, mail] };
  return !failed;
}

export const invoiceMail = (s: GameState, inv: Invoice, template: MailTemplate): boolean =>
  shopMail(s, inv.customerId, template, { invoice: inv.number, total: invoiceTotal(inv), due: inv.dueAt });

export const serviceMail = (s: GameState, v: Service, template: MailTemplate, extra: Record<string, string | number> = {}): boolean =>
  shopMail(s, v.customerId, template, { service: v.label, ...extra });

export const pruneEmails = (s: GameState): void => {
  s.shop = { ...s.shop, emails: s.shop.emails.filter((m) => s.hour - m.at < KEEP_HOURS) };
};
