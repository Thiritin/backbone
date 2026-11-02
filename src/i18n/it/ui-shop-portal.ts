import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primi ${p.months} mesi`,
  "invoice.line.renewal": (p) => `${p.label}, rinnovo per ${p.months} mesi`,
  "invoice.line.upgradeTerm": (p) => `${p.label}, differenza per i ${p.months} mesi rimanenti`,
  "ledger.refundUnused": (p) => `Rimborso dei mesi non usati: ${p.customer}, ${p.months} mesi`,
  "error.unknownProductGroup": () => "Questo gruppo di prodotti non esiste.",
  "error.groupHasProducts": () => "Sposta o elimina prima i prodotti di questo gruppo.",
  "error.badProductName": () => "Inserisci un nome.",
  "error.badProductPrice": () => "Il prezzo deve essere tra 0 e 100000.",
  "error.cycleNotSupported": () => "Questo sistema di negozio non vende quel ciclo di fatturazione.",
  "error.badDiscount": () => "Lo sconto deve essere tra 0 e 50 per cento.",
  "error.unknownServerGroup": () => "Questo gruppo di server non esiste.",
} satisfies Dict;
