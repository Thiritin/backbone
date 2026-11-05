import type { Dict } from "../lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Pedido",
  "payA.paid": () => "Pagado",
  "payA.cancel": () => "Cancelar",
  "payA.off.cardOnly": () => "Solo tarjeta",
} satisfies Dict;
