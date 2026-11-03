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
  "accounts.myAccount": () => 'Il mio account',
  "accounts.portal": () => 'Area clienti',
  "accounts.payMethod": () => 'Metodo di pagamento',
  "accounts.pay.transfer": () => 'Fattura (bonifico)',
  "accounts.pay.card": () => 'Carta di credito',
  "accounts.pay.debit": () => 'Addebito diretto SEPA',
  "accounts.germanyOnly": () => 'Solo Germania',
  "accounts.invoices": () => 'Fatture',
  "accounts.issued": () => 'Data',
  "accounts.contract": () => 'Contratto',
  "accounts.customerNo": () => 'Numero cliente',
  "accounts.customer": () => 'Cliente',
  "accounts.address": () => 'Indirizzo di fornitura',
  "accounts.points": () => 'Punti di prelievo',
  "accounts.point": () => 'Punto di prelievo',
  "accounts.tariff": () => 'Tariffa',
  "accounts.price": () => "Prezzo dell'energia",
  "accounts.usage": () => 'Consumi',
  "accounts.period": () => 'Periodo',
  "accounts.thisMonth": () => 'Mese in corso',
  "accounts.noUsage": () => 'Nessun consumo',
  "accounts.eoff.power": () => 'Elettricità',
  "accounts.eoff.hero": () => 'Elettricità per la tua azienda',
  "accounts.eoff.tariff": () => 'E.OFF Business Power',
} satisfies Dict;
