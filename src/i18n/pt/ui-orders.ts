import type { Dict } from "../lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Mãos remotas recusadas",
  "event.handsDeclined.text": (p) => `${p.customer} pediu mãos remotas em ${p.location} e nenhum técnico tinha vaga.`,
  "event.handsFailed.title": () => "Mãos remotas falharam",
  "event.handsFailed.text": (p) => `${p.name} não conseguiu terminar o trabalho de ${p.customer}.`,
  "ledger.hallHands": (p) => `Mãos remotas para ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Montagem",
  "orders.kind.parts": () => "Peças",
  "orders.kind.cable": () => "Cabeamento",
  "orders.kind.op": () => "Operação",
  "orders.kind.hands": () => "Mãos remotas",
} satisfies Dict;
