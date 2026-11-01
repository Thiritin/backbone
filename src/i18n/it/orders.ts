import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Ordine: hosting per ${p.domain}` : "Ordine: web hosting"),
  "ticket.order.vps.subject": () => "Ordine: VPS",
  "ticket.order.gameServer.subject": () => "Ordine: server di gioco",
  "ticket.order.gpu.subject": () => "Ordine: server GPU",
  "outcome.accepted": () => "Ordine accettato",
  "outcome.declined": () => "Ordine rifiutato",
  "outcome.failed": () => "Configurazione fallita",
  "error.orderNotOffered": () => "Non offri questo prodotto in questa città.",
  "event.order.title": () => "Nuovo ordine",
  "event.order.text": (p) => `${p.name} ordina ${p.spec}.`,
  "event.certificateSold.title": () => "Certificato SSL venduto",
  "event.certificateSold.text": (p) => `${p.name} ha ordinato un certificato SSL per ${p.domain}.`,
  "event.orderPlaced.title": () => "Nuovo ordine",
  "event.orderPlaced.text": (p) => `${p.name} ha ordinato nel negozio a ${euroCents(Number(p.price))} al mese: ${p.spec}.`,
  "event.orderQuoted.title": () => "Preventivo inviato",
  "event.orderQuoted.text": (p) => `L'automazione ha inviato a ${p.name} un preventivo di ${euroCents(Number(p.price))} al mese per ${p.spec}.`,
  "event.orderFailed.title": () => "Configurazione fallita",
  "event.orderFailed.text": (p) => `L'ordine di ${p.name} non ha potuto essere configurato, e il cliente è andato altrove. Riguardava ${p.spec}.`,
  "event.orderDeclined.title": () => "Ordine rifiutato",
  "event.orderDeclined.text": (p) => `L'ordine di ${p.name} è stato rifiutato nella verifica.`,
} satisfies Dict;
