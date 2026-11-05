import { euroCents } from "../sim/00-core/money";
import type { Dict } from "./lang";

// Vendor orders: payment method names and the receipt, credit note and order confirmation mails.
export default {
  "purchase.method.cash": () => "Cash",
  "purchase.method.transfer": () => "Bank transfer",
  "purchase.method.onAccount": () => "On account",
  "purchase.method.card": () => "Card",
  "purchase.method.debit": () => "Direct debit",
  "ticket.mail.receipt.subject": (p) => `Receipt ${p.number}`,
  "ticket.mail.receipt.text": (p) => `Please find attached our receipt ${p.number} over ${euroCents(Number(p.amount))}. Thank you for your cash payment.`,
  "ticket.mail.credit.subject": (p) => `Credit note ${p.number}`,
  "ticket.mail.credit.text": (p) => `Please find attached our credit note ${p.number} over ${euroCents(Number(p.amount))}. The amount has been credited to you.`,
  "ticket.mail.contract.subject": (p) => `Order confirmation ${p.number}`,
  "ticket.mail.contract.text": (p) => `Please find attached the confirmation of your order ${p.number}.`,
} satisfies Dict;
