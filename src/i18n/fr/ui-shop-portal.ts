import type { Dict } from "../lang";

export default {
  "invoice.line.firstTerm": (p) => `${p.label}, ${p.months} premiers mois`,
  "invoice.line.renewal": (p) => `${p.label}, renouvellement pour ${p.months} mois`,
  "invoice.line.upgradeTerm": (p) => `${p.label}, supplément pour les ${p.months} mois restants`,
  "ledger.refundUnused": (p) => `Remboursement des mois inutilisés : ${p.customer}, ${p.months} mois`,
  "error.unknownProductGroup": () => "Ce groupe de produits n'existe pas.",
  "error.groupHasProducts": () => "Déplacez ou supprimez d'abord les produits de ce groupe.",
  "error.badProductName": () => "Saisissez un nom.",
  "error.badProductPrice": () => "Le prix doit être compris entre 0 et 100000.",
  "error.cycleNotSupported": () => "Ce système de boutique ne vend pas ce cycle de facturation.",
  "error.badDiscount": () => "La remise doit être comprise entre 0 et 50 pour cent.",
  "error.unknownServerGroup": () => "Ce groupe de serveurs n'existe pas.",
} satisfies Dict;
