import type { Dict } from "./lang";

// Lines an order outcome adds about its invoice.
export default {
  "payI.travelBooked": () => "Invoice filed in bookkeeping",
  "payI.cableLater": () => "Invoice follows after installation",
} satisfies Dict;
