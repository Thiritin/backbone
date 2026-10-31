import type { Dict } from "../lang";

export default {
  "netsvc.deferred": (p) => `Diferidos: ${p.n}`,
  "netsvc.flush": () => "Vaciar cola",
  "netsvc.deleteAll": () => "Eliminar todo",
  "netsvc.queueId": () => "ID de cola",
  "netsvc.sender": () => "Remitente",
  "netsvc.recipients": () => "Destinatarios",
  "netsvc.arrived": () => "Hora de llegada",
  "netsvc.reason": () => "Motivo",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "La cola sigue diferida mientras la dirección esté en una lista negra o el servidor de correo esté caído.",
  "error.queueDeleted": () => "La cola ya se eliminó en las últimas 24 horas.",
} satisfies Dict;
