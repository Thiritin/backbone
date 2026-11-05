import type { Dict } from "../lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Ordinato",
  "payA.paid": () => "Pagato",
  "payA.cancel": () => "Annulla",
  "payA.off.cardOnly": () => "Solo carta",
} satisfies Dict;
