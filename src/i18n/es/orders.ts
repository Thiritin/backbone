import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Pedido: alojamiento para ${p.domain}` : "Pedido: alojamiento web"),
  "ticket.order.vps.subject": () => "Pedido: VPS",
  "ticket.order.gameServer.subject": () => "Pedido: servidor de juegos",
  "ticket.order.gpu.subject": () => "Pedido: servidor GPU",
  "outcome.accepted": () => "Pedido aceptado",
  "outcome.declined": () => "Pedido rechazado",
  "outcome.failed": () => "Fallo en la configuración",
  "error.orderNotOffered": () => "No ofreces este producto en esta ciudad.",
  "event.order.title": () => "Pedido nuevo",
  "event.order.text": (p) => `${p.name} pide ${p.spec}.`,
  "event.certificateSold.title": () => "Certificado SSL vendido",
  "event.certificateSold.text": (p) => `${p.name} pidió un certificado SSL para ${p.domain}.`,
  "event.certificatesFree.title": () => "Certificados SSL cancelados",
  "event.certificatesFree.text": (p) => (p.n === 1 ? "Un cliente canceló su certificado SSL." : `${p.n} clientes cancelaron sus certificados SSL.`),
  "event.orderPlaced.title": () => "Pedido nuevo",
  "event.orderPlaced.text": (p) => `${p.name} hizo un pedido en la tienda por ${euroCents(Number(p.price))} al mes: ${p.spec}.`,
  "event.orderQuoted.title": () => "Presupuesto enviado",
  "event.orderQuoted.text": (p) => `La automatización envió a ${p.name} un presupuesto de ${euroCents(Number(p.price))} al mes por ${p.spec}.`,
  "event.orderFailed.title": () => "Fallo en la configuración",
  "event.orderFailed.text": (p) => `No se pudo configurar el pedido de ${p.name}, y el cliente se fue a otro sitio. Era por ${p.spec}.`,
  "event.orderDeclined.title": () => "Pedido rechazado",
  "event.orderDeclined.text": (p) => `El pedido de ${p.name} fue rechazado en la revisión.`,
} satisfies Dict;
