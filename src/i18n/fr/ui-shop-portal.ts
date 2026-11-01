import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, ${p.months} premiers mois`,
  "invoice.line.renewal": (p) => `${p.label}, renouvellement pour ${p.months} mois`,
  "ledger.refundUnused": (p) => `Remboursement des mois inutilisés : ${p.customer}, ${p.months} mois`,
} satisfies Dict;
