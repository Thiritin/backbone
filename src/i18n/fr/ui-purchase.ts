import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "purchase.method.cash": () => "Espèces",
  "purchase.method.transfer": () => "Virement",
  "purchase.method.onAccount": () => "Sur facture",
  "purchase.method.card": () => "Carte",
  "purchase.method.debit": () => "Prélèvement",
  "ticket.mail.receipt.subject": (p) => `Reçu ${p.number}`,
  "ticket.mail.receipt.text": (p) => `Veuillez trouver ci-joint notre reçu ${p.number} de ${euroCents(Number(p.amount))}. Merci pour votre paiement en espèces.`,
  "ticket.mail.credit.subject": (p) => `Avoir ${p.number}`,
  "ticket.mail.credit.text": (p) => `Veuillez trouver ci-joint notre avoir ${p.number} de ${euroCents(Number(p.amount))}. Nous avons crédité le montant sur votre compte.`,
  "ticket.mail.contract.subject": (p) => `Confirmation de commande ${p.number}`,
  "ticket.mail.contract.text": (p) => `Veuillez trouver ci-joint la confirmation de votre commande ${p.number}.`,
} satisfies Dict;
