import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primeros ${p.months} meses`,
  "invoice.line.renewal": (p) => `${p.label}, renovación por ${p.months} meses`,
  "ledger.refundUnused": (p) => `Reembolso de meses sin usar: ${p.customer}, ${p.months} meses`,
} satisfies Dict;
