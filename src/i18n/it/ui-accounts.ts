import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Elettricità ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Elettricità a consumo ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Fattura ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `In allegato la nostra fattura ${p.number} di ${euroCents(Number(p.amount))}. Abbiamo addebitato l'importo sulla sua carta di credito.`,
  "error.payMethod": () => 'Scelga bonifico, carta di credito o addebito diretto.',
  "error.debitAbroad": () => "L'addebito diretto è disponibile solo con fornitori tedeschi.",
  "error.payNoCard": () => 'Il conto non ha una carta di credito.',
} satisfies Dict;
