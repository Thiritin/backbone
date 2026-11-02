import type { Dict } from "./lang";

export default {
  "shop-orders.any": () => "All",
  "shop-orders.number": () => "Order #",
  "shop-orders.payment": () => "Payment Status",
  "shop-orders.invoice": () => "Invoice #",
  "shop-orders.fraud": () => "Mark as Fraud",
  "error.unknownOrder": () => "This order does not exist.",
  "error.orderNotPending": () => "This order is no longer pending.",
  "error.noShopModule": () => "The shop has no module for this server.",
  "error.manualProduct": () => "This product has no server group.",
  "error.orderInvoiced": () => "This order is already being set up by hand in Support.",
} satisfies Dict;
