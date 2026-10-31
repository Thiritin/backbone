import type { Dict } from "../lang";

export default {
  "netsvc.deferred": (p) => `Zurückgestellt: ${p.n}`,
  "netsvc.flush": () => "Warteschlange leeren und senden",
  "netsvc.deleteAll": () => "Alle löschen",
  "netsvc.queueId": () => "Warteschlangen-ID",
  "netsvc.sender": () => "Absender",
  "netsvc.recipients": () => "Empfänger",
  "netsvc.arrived": () => "Eingang",
  "netsvc.reason": () => "Grund",
  "netsvc.reasonBlocked": (p) => `host ${p.mx} refused to talk to me: 554 5.7.1 Service unavailable; Client host [${p.ip}] blocked using bl.spamhouse.example`,
  "netsvc.reasonTimeout": (p) => `connect to ${p.mx}: Connection timed out`,
  "error.mailStillListed": () => "Die Warteschlange bleibt zurückgestellt, solange die Adresse gelistet oder der Mailserver nicht erreichbar ist.",
  "error.queueDeleted": () => "Die Warteschlange wurde in den letzten 24 Stunden bereits gelöscht.",
} satisfies Dict;
