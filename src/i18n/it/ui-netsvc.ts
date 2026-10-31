import type { Dict } from "../lang";

export default {
  "netsvc.deferred": (p) => `In coda: ${p.n}`,
  "netsvc.flush": () => "Svuota la coda",
  "netsvc.deleteAll": () => "Elimina tutto",
  "netsvc.queueId": () => "ID coda",
  "netsvc.sender": () => "Mittente",
  "netsvc.recipients": () => "Destinatari",
  "netsvc.arrived": () => "Ora di arrivo",
  "netsvc.reason": () => "Motivo",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "La coda resta in sospeso finché l'indirizzo è in una blocklist o il server di posta è fermo.",
  "error.queueDeleted": () => "La coda è già stata eliminata nelle ultime 24 ore.",
} satisfies Dict;
