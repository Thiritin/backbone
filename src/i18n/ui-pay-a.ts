import type { Dict } from "./lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Ordered",
  "payA.paid": () => "Paid",
  "payA.cancel": () => "Cancel",
  "payA.off.cardOnly": () => "Card only",
} satisfies Dict;
