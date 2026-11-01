import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE, type Dict } from "../lang";

const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

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
  "software.support.updatesEnded": () => "Mises à jour terminées",
  "software.support.securityEnded": () => "Mises à jour de sécurité terminées",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version} : fin des mises à jour de sécurité`,
  "ticket.mail.securityEnding.text": (p) => `Les mises à jour de sécurité de ${p.software} ${p.version} prennent fin le ${day(p.until)}. Après cette date, nous ne publions plus de correctifs de vulnérabilités pour cette version.`,
} satisfies Dict;
