import { euroCents } from "../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "./lang";

// Supplier accounts: power lines with kWh, card payment of invoices, the payment method.
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Power ${p.location}: ${kwh(p)} kWh at ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Metered power ${p.location}: ${kwh(p)} kWh at ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Invoice ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Please find attached our invoice ${p.number} over ${euroCents(Number(p.amount))}. We have charged the amount to your credit card.`,
  "error.payMethod": () => 'Choose bank transfer, credit card or direct debit.',
  "error.debitAbroad": () => 'Direct debit is only available from German suppliers.',
  "error.payNoCard": () => 'The account has no credit card.',
} satisfies Dict;
