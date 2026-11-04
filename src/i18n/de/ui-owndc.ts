import type { Dict } from "../lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Belegt.",
  "error.noAisle": () => "Kein Gang.",
  "error.notEmpty": () => "Nicht leer.",
  "error.noWallSlot": () => "Kein Platz an der Wand.",
  "ledger.transformer": (p) => `Transformator, ${p.location}`,
  "ledger.coolerRefund": (p) => `Kühlgerät erstattet, ${p.location}`,
} satisfies Dict;
