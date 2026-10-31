import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const KIND: Record<string, string> = {
  howTo: "ticket de consulta", billing: "ticket de facturación", outage: "ticket de caída", upgrade: "ticket de actualización", cancellation: "ticket de baja", abuse: "ticket de abuso",
  appeal: "ticket de apelación", notice: "ticket de aviso", legal: "ticket legal", refund: "ticket de reembolso", order: "ticket de pedido",
};
const RESOLVED: Record<string, string> = {
  credit: "Abonado el 10 % de la factura mensual", "retain.half": "Ofrecido un 50 % de descuento el mes siguiente", "retain.free": "Ofrecido un mes gratis",
  "retain.d3": "Ofrecido un 20 % de descuento durante 3 meses", "retain.d6": "Ofrecido un 20 % de descuento durante 6 meses", "retain.d12": "Ofrecido un 20 % de descuento durante 12 meses",
  "retain.upgrade": "Ofrecida una actualización gratis", "retain.fix": "Prometida una solución", "retain.move": "Ofrecido un traslado a un servidor mejor", cancel: "Baja tramitada",
  unsuspend: "Servicios reactivados con una prórroga de pago", keep: "Servicios mantenidos suspendidos", forward: "Denuncia de abuso reenviada",
  takedown: "Contenido retirado", reject: "Solicitud rechazada", comply: "Solicitud atendida", object: "Solicitud impugnada",
  refund: "Pago reembolsado", accept: "Pedido aceptado", quote: "Presupuesto enviado", account: "Cuenta de cliente creada",
  invoice: "Pedido confirmado y factura enviada", domain: "Dominio registrado", provision: "Servicio configurado",
};
const ticket = (p: Params) => KIND[p.kind] ?? "ticket";

export default {
  "activity.reply": (p) => `Respondido el ${ticket(p)}`,
  "activity.escalate": (p) => `Escalado el ${ticket(p)}`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `Resuelto el ${ticket(p)}`,
  "activity.checkInvoice": (p) => `Revisada la factura ${p.invoice}`,
  "activity.reminder": (p) => `Enviado un recordatorio de pago de la factura ${p.invoice}`,
  "activity.sendInvoice": (p) => `Enviada la factura ${p.invoice} en PDF`,
  "activity.dunning": (p) => `Enviada una reclamación de pago de la factura ${p.invoice}`,
  "activity.final": (p) => `Enviado el aviso final de la factura ${p.invoice}`,
  "activity.collections": (p) => `Factura ${p.invoice} pasada a cobros`,
  "activity.suspend": (p) => `Servicios suspendidos por la factura ${p.invoice}`,
  "activity.unsuspend": (p) => `Servicios reactivados por la factura ${p.invoice}`,
  "activity.writeOff": (p) => `Factura ${p.invoice} dada de baja`,
  "activity.price": (p) => `Precio cambiado a ${euroCents(Number(p.price))} al mes`,
} satisfies Dict;
