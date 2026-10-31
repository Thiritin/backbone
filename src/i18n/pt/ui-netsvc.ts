import type { Dict } from "../lang";

export default {
  "netsvc.deferred": (p) => `Adiados: ${p.n}`,
  "netsvc.flush": () => "Esvaziar fila",
  "netsvc.deleteAll": () => "Eliminar tudo",
  "netsvc.queueId": () => "ID da fila",
  "netsvc.sender": () => "Remetente",
  "netsvc.recipients": () => "Destinatários",
  "netsvc.arrived": () => "Hora de chegada",
  "netsvc.reason": () => "Motivo",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "A fila continua adiada enquanto o endereço estiver em lista de bloqueio ou o servidor de correio estiver em baixo.",
  "error.queueDeleted": () => "A fila já foi eliminada nas últimas 24 horas.",
} satisfies Dict;
