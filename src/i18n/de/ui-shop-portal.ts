import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, erste ${p.months} Monate`,
  "invoice.line.renewal": (p) => `${p.label}, Verlängerung um ${p.months} Monate`,
  "invoice.line.upgradeTerm": (p) => `${p.label}, Aufpreis für die restlichen ${p.months} Monate`,
  "ledger.refundUnused": (p) => `Erstattung ungenutzter Monate: ${p.customer}, ${p.months} Monate`,
  "error.unknownProductGroup": () => "Diese Produktgruppe gibt es nicht.",
  "error.groupHasProducts": () => "Verschiebe oder lösche zuerst die Produkte dieser Gruppe.",
  "error.badProductName": () => "Gib einen Namen ein.",
  "error.badProductPrice": () => "Der Preis muss zwischen 0 und 100000 liegen.",
  "error.cycleNotSupported": () => "Dieses Shopsystem bietet den Abrechnungszeitraum nicht an.",
  "error.badDiscount": () => "Der Rabatt muss zwischen 0 und 50 Prozent liegen.",
  "error.unknownServerGroup": () => "Diese Servergruppe gibt es nicht.",
} satisfies Dict;
