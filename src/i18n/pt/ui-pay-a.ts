import type { Dict } from "../lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Encomendado",
  "payA.paid": () => "Pago",
  "payA.cancel": () => "Cancelar",
  "payA.off.cardOnly": () => "Só cartão",
} satisfies Dict;
