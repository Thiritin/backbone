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
  "accounts.myAccount": () => 'A minha conta',
  "accounts.portal": () => 'Área de cliente',
  "accounts.payMethod": () => 'Forma de pagamento',
  "accounts.pay.transfer": () => 'Fatura (transferência)',
  "accounts.pay.card": () => 'Cartão de crédito',
  "accounts.pay.debit": () => 'Débito direto SEPA',
  "accounts.germanyOnly": () => 'Só Alemanha',
  "accounts.invoices": () => 'Faturas',
  "accounts.issued": () => 'Data',
  "accounts.contract": () => 'Contrato',
  "accounts.customerNo": () => 'Número de cliente',
  "accounts.customer": () => 'Cliente',
  "accounts.address": () => 'Morada de fornecimento',
  "accounts.points": () => 'Pontos de consumo',
  "accounts.point": () => 'Ponto de consumo',
  "accounts.tariff": () => 'Tarifa',
  "accounts.price": () => 'Preço da energia',
  "accounts.usage": () => 'Consumo',
  "accounts.period": () => 'Período',
  "accounts.thisMonth": () => 'Mês corrente',
  "accounts.noUsage": () => 'Sem consumo',
  "accounts.eoff.power": () => 'Eletricidade',
  "accounts.eoff.hero": () => 'Eletricidade para a sua empresa',
  "accounts.eoff.tariff": () => 'E.OFF Business Power',
} satisfies Dict;
