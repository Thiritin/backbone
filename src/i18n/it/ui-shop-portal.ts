import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primi ${p.months} mesi`,
  "invoice.line.renewal": (p) => `${p.label}, rinnovo per ${p.months} mesi`,
  "ledger.refundUnused": (p) => `Rimborso dei mesi non usati: ${p.customer}, ${p.months} mesi`,
} satisfies Dict;
