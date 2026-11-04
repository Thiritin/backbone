import type { Dict } from "../lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Occupato.",
  "error.noAisle": () => "Nessun corridoio.",
  "error.notEmpty": () => "Non vuoto.",
  "error.noWallSlot": () => "Nessuno spazio sulla parete.",
  "ledger.transformer": (p) => `Trasformatore, ${p.location}`,
  "ledger.coolerRefund": (p) => `Rimborso del raffreddamento, ${p.location}`,
} satisfies Dict;
