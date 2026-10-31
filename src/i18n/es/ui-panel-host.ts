import type { Dict } from "../lang";

export default {
  "error.holdPayment": () => "La factura de esta cuenta sigue sin pagar.",
  "error.holdReason": () => "Elige un motivo válido.",
  "error.oversellCap": () => "Este host superaría su límite de sobreventa.",
  "error.licenceCap": () => "Tu licencia no permite más cuentas.",
  "error.licenceExpired": () => "Tu licencia ha caducado.",
  "event.updateBroke.title": () => "Actualización fallida",
  "event.updateBroke.text": (p) => `La actualización de ${p.cluster} ha salido mal y sus clientes seguirán sin servicio unas horas más.`,
} satisfies Dict;
