import type { Dict } from "./lang";

// The note a payment step shows when the selected method was switched to another one.
export default {
  "payG.methodNow": (p) => `Payment method changed to ${p.method}`,
} satisfies Dict;
