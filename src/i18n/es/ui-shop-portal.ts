import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, primeros ${p.months} meses`,
  "invoice.line.renewal": (p) => `${p.label}, renovación por ${p.months} meses`,
  "invoice.line.upgradeTerm": (p) => `${p.label}, diferencia por los ${p.months} meses restantes`,
  "ledger.refundUnused": (p) => `Reembolso de meses sin usar: ${p.customer}, ${p.months} meses`,
  "error.unknownProductGroup": () => "Ese grupo de productos no existe.",
  "error.groupHasProducts": () => "Mueve o elimina primero los productos de este grupo.",
  "error.badProductName": () => "Introduce un nombre.",
  "error.badProductPrice": () => "El precio debe estar entre 0 y 100000.",
  "error.cycleNotSupported": () => "Este sistema de tienda no vende ese ciclo de facturación.",
  "error.badDiscount": () => "El descuento debe estar entre 0 y 50 por ciento.",
  "error.unknownServerGroup": () => "Ese grupo de servidores no existe.",
} satisfies Dict;
