import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, erste ${p.months} Monate`,
  "invoice.line.renewal": (p) => `${p.label}, Verlängerung um ${p.months} Monate`,
  "ledger.refundUnused": (p) => `Erstattung ungenutzter Monate: ${p.customer}, ${p.months} Monate`,
} satisfies Dict;
