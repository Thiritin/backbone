import type { Dict } from "./lang";

// The cart's button to the payment step and the reason cash is off when it is short of the total.
export default {
  "payE.checkout": () => "Checkout",
  "payE.off.noCash": () => "Not enough cash",
} satisfies Dict;
