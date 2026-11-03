import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Eletricidade ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Eletricidade por consumo ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Fatura ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Segue em anexo a nossa fatura ${p.number} de ${euroCents(Number(p.amount))}. Debitámos o valor no seu cartão de crédito.`,
  "error.payMethod": () => 'Escolha transferência, cartão de crédito ou débito direto.',
  "error.debitAbroad": () => 'O débito direto só está disponível com fornecedores alemães.',
  "error.payNoCard": () => 'A conta não tem cartão de crédito.',
} satisfies Dict;
