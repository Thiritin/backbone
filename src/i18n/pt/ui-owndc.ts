import type { Dict } from "../lang";

// Own datacenter edit actions: why a placement fails and what the transformer and a refund show in the ledger.
export default {
  "error.occupied": () => "Ocupado.",
  "error.noAisle": () => "Sem corredor.",
  "error.notEmpty": () => "Não está vazio.",
  "error.noWallSlot": () => "Sem espaço na parede.",
  "ledger.transformer": (p) => `Transformador, ${p.location}`,
  "ledger.coolerRefund": (p) => `Reembolso da refrigeração, ${p.location}`,
} satisfies Dict;
