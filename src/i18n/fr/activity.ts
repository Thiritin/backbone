import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const KIND: Record<string, string> = {
  howTo: "ticket d'aide", billing: "ticket de facturation", outage: "ticket de panne", upgrade: "ticket de mise à niveau", cancellation: "ticket de résiliation", abuse: "ticket d'abus",
  appeal: "ticket de contestation", notice: "ticket d'avis", legal: "ticket juridique", refund: "ticket de remboursement", order: "ticket de commande",
};
const RESOLVED: Record<string, string> = {
  credit: "10 % de la facture mensuelle crédités", "retain.half": "50 % de remise offerts sur le mois suivant", "retain.free": "Un mois gratuit offert",
  "retain.d3": "20 % de remise offerts pendant 3 mois", "retain.d6": "20 % de remise offerts pendant 6 mois", "retain.d12": "20 % de remise offerts pendant 12 mois",
  "retain.upgrade": "Une mise à niveau gratuite offerte", "retain.fix": "Une correction promise", "retain.move": "Un transfert vers un meilleur serveur proposé", cancel: "Résiliation traitée",
  unsuspend: "Services rétablis avec un délai de paiement", keep: "Services laissés suspendus", forward: "Signalement d'abus transmis",
  takedown: "Contenu retiré", reject: "Demande rejetée", comply: "Demande acceptée", object: "Opposition à la demande",
  refund: "Paiement remboursé", accept: "Commande acceptée", quote: "Devis envoyé", account: "Compte client créé",
  invoice: "Commande confirmée et facture envoyée", domain: "Nom de domaine enregistré", provision: "Service mis en place",
};
const ticket = (p: Params) => KIND[p.kind] ?? "ticket";

export default {
  "activity.reply": (p) => `Réponse au ${ticket(p)}`,
  "activity.escalate": (p) => `Escalade du ${ticket(p)}`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `Résolution du ${ticket(p)}`,
  "activity.checkInvoice": (p) => `Facture ${p.invoice} vérifiée`,
  "activity.reminder": (p) => `Rappel de paiement envoyé pour la facture ${p.invoice}`,
  "activity.sendInvoice": (p) => `Facture ${p.invoice} envoyée en PDF`,
  "activity.matchTransfer": (p) => `Virement imputé à la facture ${p.invoice}`,
  "activity.dunning": (p) => `Relance envoyée pour la facture ${p.invoice}`,
  "activity.final": (p) => `Dernière relance envoyée pour la facture ${p.invoice}`,
  "activity.collections": (p) => `Facture ${p.invoice} confiée au recouvrement`,
  "activity.suspend": (p) => `Services suspendus pour la facture ${p.invoice}`,
  "activity.unsuspend": (p) => `Services rétablis pour la facture ${p.invoice}`,
  "activity.writeOff": (p) => `Facture ${p.invoice} passée en perte`,
  "activity.price": (p) => `Prix changé à ${euroCents(Number(p.price))} par mois`,
} satisfies Dict;
