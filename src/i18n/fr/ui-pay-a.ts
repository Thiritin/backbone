import type { Dict } from "../lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Commandé",
  "payA.paid": () => "Payé",
  "payA.cancel": () => "Annuler",
  "payA.off.cardOnly": () => "Carte uniquement",
} satisfies Dict;
