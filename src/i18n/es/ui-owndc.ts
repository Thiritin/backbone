import type { Dict } from "../lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Ocupado.",
  "error.noAisle": () => "Sin pasillo.",
  "error.notEmpty": () => "No está vacío.",
  "error.noWallSlot": () => "Sin sitio en la pared.",
  "ledger.transformer": (p) => `Transformador, ${p.location}`,
  "ledger.coolerRefund": (p) => `Reembolso de refrigeración, ${p.location}`,
} satisfies Dict;
