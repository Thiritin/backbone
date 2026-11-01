import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primeiros ${p.months} meses`,
  "invoice.line.renewal": (p) => `${p.label}, renovação por ${p.months} meses`,
  "ledger.refundUnused": (p) => `Reembolso de meses não usados: ${p.customer}, ${p.months} meses`,
  "error.unknownProductGroup": () => "Esse grupo de produtos não existe.",
  "error.groupHasProducts": () => "Mova ou apague primeiro os produtos deste grupo.",
  "error.badProductName": () => "Introduza um nome.",
  "error.badProductPrice": () => "O preço tem de estar entre 0 e 100000.",
  "error.cycleNotSupported": () => "Este sistema de loja não vende esse ciclo de faturação.",
  "error.badDiscount": () => "O desconto tem de estar entre 0 e 50 por cento.",
  "error.unknownServerGroup": () => "Esse grupo de servidores não existe.",
} satisfies Dict;
