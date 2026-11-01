import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primeiros ${p.months} meses`,
  "invoice.line.renewal": (p) => `${p.label}, renovação por ${p.months} meses`,
  "ledger.refundUnused": (p) => `Reembolso de meses não usados: ${p.customer}, ${p.months} meses`,
} satisfies Dict;
