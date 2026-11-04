import type { Dict } from "./lang";

// Work orders: remote hands booked by customers of the own hall and the names of the order kinds.
export default {
  "event.handsDeclined.title": () => "Remote hands declined",
  "event.handsDeclined.text": (p) => `${p.customer} asked for remote hands at ${p.location}, and no technician had room.`,
  "event.handsFailed.title": () => "Remote hands failed",
  "event.handsFailed.text": (p) => `${p.name} could not finish the job for ${p.customer}.`,
  "ledger.hallHands": (p) => `Remote hands for ${p.customer}, ${p.kind}`,
  "orders.kind.mount": () => "Mount",
  "orders.kind.parts": () => "Parts",
  "orders.kind.cable": () => "Cabling",
  "orders.kind.op": () => "Operation",
  "orders.kind.hands": () => "Remote hands",
} satisfies Dict;
