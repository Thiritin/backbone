import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Un logiciel de cette machine utilise déjà l'un de ses ports.",
  "error.wrongOs": () => "Ce logiciel ne tourne pas sur le système d'exploitation de cette machine.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${Number(p.count) < 2 ? "machine" : "machines"}`,
  "ledger.licenceRenewal": (p) => `Abonnement ${p.name}, clé ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Abonnement ${p.name} renouvelé`,
  "ticket.mail.licenceRenewed.text": (p) => `Votre abonnement ${p.name} a été renouvelé pour un mois. ${Number(p.count) < 2 ? "1 clé" : `${p.count} clés`}, ${euroCents(Number(p.amount))} prélevés.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Abonnement ${p.name} expiré`,
  "ticket.mail.licenceLapsed.text": (p) => `Nous n'avons pas pu prélever le renouvellement de votre clé ${p.name} ${p.key}. La licence a expiré et sera renouvelée dès que le paiement aboutira.`,
  "ledger.licenseOnce": (p) => `Licence ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
