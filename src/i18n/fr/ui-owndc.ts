import type { Dict } from "../lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Occupé.",
  "error.noAisle": () => "Pas d'allée.",
  "error.notEmpty": () => "Pas vide.",
  "error.noWallSlot": () => "Pas de place au mur.",
  "ledger.transformer": (p) => `Transformateur, ${p.location}`,
  "ledger.coolerRefund": (p) => `Remboursement du refroidissement, ${p.location}`,
} satisfies Dict;
