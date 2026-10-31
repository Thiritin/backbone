import type { Dict } from "./lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, first ${p.months} months`,
  "invoice.line.renewal": (p) => `${p.label}, renewal for ${p.months} months`,
  "ledger.refundUnused": (p) => `Refund of unused months: ${p.customer}, ${p.months} months`,
} satisfies Dict;
