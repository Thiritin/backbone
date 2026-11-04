import type { Dict } from "../lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Mains distantes refusées",
  "event.handsDeclined.text": (p) => `${p.customer} a demandé des mains distantes à ${p.location}, et aucun technicien n'avait de place.`,
  "event.handsFailed.title": () => "Mains distantes en échec",
  "event.handsFailed.text": (p) => `${p.name} n'a pas pu terminer le travail pour ${p.customer}.`,
  "ledger.hallHands": (p) => `Mains distantes pour ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Montage",
  "orders.kind.parts": () => "Pièces",
  "orders.kind.cable": () => "Câblage",
  "orders.kind.op": () => "Opération",
  "orders.kind.hands": () => "Mains distantes",
} satisfies Dict;
