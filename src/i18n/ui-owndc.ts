import type { Dict } from "./lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Occupied.",
  "error.noAisle": () => "No aisle.",
  "error.notEmpty": () => "Not empty.",
  "error.noWallSlot": () => "No space on the wall.",
  "ledger.transformer": (p) => `Transformer, ${p.location}`,
  "ledger.coolerRefund": (p) => `Cooling unit refund, ${p.location}`,
} satisfies Dict;
