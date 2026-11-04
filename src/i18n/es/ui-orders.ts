import type { Dict } from "../lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Manos remotas rechazadas",
  "event.handsDeclined.text": (p) => `${p.customer} pidió manos remotas en ${p.location} y ningún técnico tenía hueco.`,
  "event.handsFailed.title": () => "Manos remotas fallidas",
  "event.handsFailed.text": (p) => `${p.name} no pudo terminar el trabajo de ${p.customer}.`,
  "ledger.hallHands": (p) => `Manos remotas para ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Montaje",
  "orders.kind.parts": () => "Piezas",
  "orders.kind.cable": () => "Cableado",
  "orders.kind.op": () => "Operación",
  "orders.kind.hands": () => "Manos remotas",
} satisfies Dict;
