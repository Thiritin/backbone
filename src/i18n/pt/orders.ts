import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Pedido: hospedagem para ${p.domain}` : "Pedido: hospedagem web"),
  "ticket.order.vps.subject": () => "Pedido: VPS",
  "ticket.order.gameServer.subject": () => "Pedido: servidor de jogos",
  "ticket.order.gpu.subject": () => "Pedido: servidor GPU",
  "outcome.accepted": () => "Pedido aceite",
  "outcome.declined": () => "Pedido recusado",
  "outcome.failed": () => "Falha na configuração",
  "error.orderNotOffered": () => "Não ofereces este produto nesta cidade.",
  "event.order.title": () => "Novo pedido",
  "event.order.text": (p) => `${p.name} pede ${p.spec}.`,
  "event.certificateSold.title": () => "Certificado SSL vendido",
  "event.certificateSold.text": (p) => `${p.name} pediu um certificado SSL para ${p.domain}.`,
  "event.certificatesFree.title": () => "Certificados SSL cancelados",
  "event.certificatesFree.text": (p) => (p.n === 1 ? "Um cliente cancelou o seu certificado SSL." : `${p.n} clientes cancelaram os seus certificados SSL.`),
  "event.orderPlaced.title": () => "Novo pedido",
  "event.orderPlaced.text": (p) => `${p.name} fez um pedido na loja por ${euroCents(Number(p.price))} por mês: ${p.spec}.`,
  "event.orderQuoted.title": () => "Orçamento enviado",
  "event.orderQuoted.text": (p) => `A automatização enviou a ${p.name} um orçamento de ${euroCents(Number(p.price))} por mês para ${p.spec}.`,
  "event.orderFailed.title": () => "Falha na configuração",
  "event.orderFailed.text": (p) => `O pedido de ${p.name} não pôde ser configurado, e o cliente foi para outro lado. Era para ${p.spec}.`,
  "event.orderDeclined.title": () => "Pedido recusado",
  "event.orderDeclined.text": (p) => `O pedido de ${p.name} foi recusado na verificação.`,
} satisfies Dict;
