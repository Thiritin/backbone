import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const KIND: Record<string, string> = {
  howTo: "ticket de ajuda", billing: "ticket de faturação", outage: "ticket de indisponibilidade", upgrade: "ticket de upgrade", cancellation: "ticket de cancelamento", abuse: "ticket de abuso",
  appeal: "ticket de recurso", notice: "ticket de aviso", legal: "ticket jurídico", refund: "ticket de reembolso", order: "ticket de pedido",
};
const RESOLVED: Record<string, string> = {
  credit: "Creditados 10% da fatura mensal", "retain.half": "Oferecidos 50% de desconto no mês seguinte", "retain.free": "Oferecido um mês grátis",
  "retain.d3": "Oferecidos 20% de desconto durante 3 meses", "retain.d6": "Oferecidos 20% de desconto durante 6 meses", "retain.d12": "Oferecidos 20% de desconto durante 12 meses",
  "retain.upgrade": "Oferecido um upgrade grátis", "retain.fix": "Prometida uma correção", "retain.move": "Oferecida a mudança para um servidor melhor", cancel: "Cancelamento processado",
  unsuspend: "Serviços reativados com prorrogação de pagamento", keep: "Serviços mantidos suspensos", forward: "Denúncia de abuso reencaminhada",
  takedown: "Conteúdo removido", reject: "Pedido rejeitado", comply: "Pedido satisfeito", object: "Pedido contestado",
  refund: "Pagamento reembolsado", accept: "Pedido aceite", quote: "Orçamento enviado", account: "Conta de cliente criada",
  invoice: "Pedido confirmado e fatura enviada", domain: "Domínio registado", provision: "Serviço configurado",
};
const ticket = (p: Params) => KIND[p.kind] ?? "ticket";

export default {
  "activity.reply": (p) => `Respondido ao ${ticket(p)}`,
  "activity.escalate": (p) => `Escalado o ${ticket(p)}`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `Resolvido o ${ticket(p)}`,
  "activity.checkInvoice": (p) => `Verificada a fatura ${p.invoice}`,
  "activity.reminder": (p) => `Enviado um lembrete de pagamento da fatura ${p.invoice}`,
  "activity.sendInvoice": (p) => `Enviada a fatura ${p.invoice} em PDF`,
  "activity.dunning": (p) => `Enviada uma cobrança da fatura ${p.invoice}`,
  "activity.final": (p) => `Enviado o aviso final da fatura ${p.invoice}`,
  "activity.collections": (p) => `Fatura ${p.invoice} entregue à cobrança de dívidas`,
  "activity.suspend": (p) => `Serviços suspensos por causa da fatura ${p.invoice}`,
  "activity.unsuspend": (p) => `Serviços retomados por causa da fatura ${p.invoice}`,
  "activity.writeOff": (p) => `Fatura ${p.invoice} dada como incobrável`,
  "activity.price": (p) => `Preço alterado para ${euroCents(Number(p.price))} por mês`,
} satisfies Dict;
