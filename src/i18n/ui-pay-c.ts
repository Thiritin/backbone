import type { Dict } from "./lang";

// Payment outcomes of orders placed in apps outside the browser.
export default {
  "purchase.done.ordered": () => "Ordered",
  "purchase.done.paid": () => "Paid",
} satisfies Dict;
