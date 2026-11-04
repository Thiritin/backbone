import type { Dict } from "../lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Remote Hands abgelehnt",
  "event.handsDeclined.text": (p) => `${p.customer} wollte Remote Hands in ${p.location}, und kein Techniker hatte Platz.`,
  "event.handsFailed.title": () => "Remote Hands fehlgeschlagen",
  "event.handsFailed.text": (p) => `${p.name} konnte den Auftrag für ${p.customer} nicht abschließen.`,
  "ledger.hallHands": (p) => `Remote Hands für ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Einbau",
  "orders.kind.parts": () => "Teile",
  "orders.kind.cable": () => "Verkabelung",
  "orders.kind.op": () => "Arbeit",
  "orders.kind.hands": () => "Remote Hands",
} satisfies Dict;
