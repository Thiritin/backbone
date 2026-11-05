import type { Dict } from "../lang";

// Outcomes and labels of the buy buttons and the shop cart.
export default {
  "payA.ordered": () => "Bestellt",
  "payA.paid": () => "Bezahlt",
  "payA.cancel": () => "Abbrechen",
  "payA.off.cardOnly": () => "Nur Kreditkarte",
} satisfies Dict;
