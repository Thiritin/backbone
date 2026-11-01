import type { Dict } from "./lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, first ${p.months} months`,
  "invoice.line.renewal": (p) => `${p.label}, renewal for ${p.months} months`,
  "ledger.refundUnused": (p) => `Refund of unused months: ${p.customer}, ${p.months} months`,
  "error.unknownProductGroup": () => "There is no such product group.",
  "error.groupHasProducts": () => "Move or delete the products in this group first.",
  "error.badProductName": () => "Enter a name.",
  "error.badProductPrice": () => "The price must be between 0 and 100000.",
  "error.cycleNotSupported": () => "This shop system does not sell that billing cycle.",
  "error.badDiscount": () => "The discount must be between 0 and 50 percent.",
  "error.unknownServerGroup": () => "There is no such server group.",
} satisfies Dict;
