import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "purchase.method.cash": () => "Dinheiro",
  "purchase.method.transfer": () => "Transferência",
  "purchase.method.onAccount": () => "Em conta",
  "purchase.method.card": () => "Cartão",
  "purchase.method.debit": () => "Débito direto",
  "ticket.mail.receipt.subject": (p) => `Recibo ${p.number}`,
  "ticket.mail.receipt.text": (p) => `Segue em anexo o nosso recibo ${p.number} de ${euroCents(Number(p.amount))}. Obrigado pelo pagamento em dinheiro.`,
  "ticket.mail.credit.subject": (p) => `Nota de crédito ${p.number}`,
  "ticket.mail.credit.text": (p) => `Segue em anexo a nossa nota de crédito ${p.number} de ${euroCents(Number(p.amount))}. Creditámos o valor na sua conta.`,
  "ticket.mail.contract.subject": (p) => `Confirmação de encomenda ${p.number}`,
  "ticket.mail.contract.text": (p) => `Segue em anexo a confirmação da sua encomenda ${p.number}.`,
} satisfies Dict;
