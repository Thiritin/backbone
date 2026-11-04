import type { Dict } from "../lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Mani remote rifiutate",
  "event.handsDeclined.text": (p) => `${p.customer} ha chiesto mani remote a ${p.location} e nessun tecnico aveva posto.`,
  "event.handsFailed.title": () => "Mani remote fallite",
  "event.handsFailed.text": (p) => `${p.name} non ha potuto finire il lavoro per ${p.customer}.`,
  "ledger.hallHands": (p) => `Mani remote per ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Montaggio",
  "orders.kind.parts": () => "Parti",
  "orders.kind.cable": () => "Cablaggio",
  "orders.kind.op": () => "Operazione",
  "orders.kind.hands": () => "Mani remote",
} satisfies Dict;
