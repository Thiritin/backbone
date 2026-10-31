import type { Dict } from "../lang";

const DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

export default {
  "ticket.migration.offer.subject": (p) => `Trasferimento di ${p.hostname || p.service} su ${p.target}`,
  "ticket.migration.offer.text": (p) => `Vorremmo trasferire ${p.hostname || p.service} su ${p.target}. Facci sapere se sei d'accordo.`,
  "ticket.migration.accept.text": (p) => `Per me va bene. Fallo ${DAYS[Number(p.day)]} tra le ${clock(p.from)} e le ${clock(p.to)}.`,
  "ticket.migration.acceptAny.text": () => "Per me va bene. Procedi quando ti fa comodo.",
  "ticket.migration.decline.text": () => "Preferisco lasciare tutto com'è.",
  "ticket.migration.missed.text": () => "Il trasferimento non c'è mai stato. Non sono contento.",
  "outcome.moved": () => "Trasferito",
  "outcome.moveDeclined": () => "Rifiutato",
  "event.moveAccepted.title": () => "Trasferimento accettato",
  "event.moveAccepted.text": (p) => `${p.name} ha accettato il trasferimento di ${p.service}.`,
  "event.moveDeclined.title": () => "Trasferimento rifiutato",
  "event.moveDeclined.text": (p) => `${p.name} ha rifiutato il trasferimento di ${p.service}.`,
  "event.moveWindow.title": () => "Finestra di trasferimento aperta",
  "event.moveWindow.text": (p) => `${p.name} si aspetta che ${p.service} sia trasferito entro le ${clock(p.to)}.`,
  "event.moveDone.title": () => "Servizio trasferito",
  "event.moveDone.text": (p) => `${p.service} di ${p.name} è stato trasferito su ${p.target}.`,
  "event.moveMissed.title": () => "Trasferimento mancato",
  "event.moveMissed.text": (p) => `Il trasferimento di ${p.service} di ${p.name} non è stato eseguito.`,
  "error.moveOffered": () => "Questo servizio ha un'offerta di trasferimento in attesa di risposta.",
  "error.moveTarget": () => "Questo servizio non può essere trasferito lì.",
  "ledger.moveServer": (p) => `Trasferimento di ${p.device} a ${p.location}`,
  "error.moveServerOnly": () => "Solo un server si sposta insieme ai suoi carichi di lavoro.",
  "error.locationNotReady": () => "La sede non è ancora pronta.",
  "error.clusterSpans": () => "Il cluster gira su più server di questo.",
} satisfies Dict;
