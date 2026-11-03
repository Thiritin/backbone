import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Strom ${p.location}: ${kwh(p)} kWh zu ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Strom nach Verbrauch ${p.location}: ${kwh(p)} kWh zu ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Rechnung ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Anbei erhalten Sie unsere Rechnung ${p.number} über ${euroCents(Number(p.amount))}. Wir haben den Betrag Ihrer Kreditkarte belastet.`,
  "error.payMethod": () => 'Wählen Sie Überweisung, Kreditkarte oder Lastschrift.',
  "error.debitAbroad": () => 'Lastschrift ist nur bei deutschen Lieferanten möglich.',
  "error.payNoCard": () => 'Das Konto hat keine Kreditkarte.',
} satisfies Dict;
