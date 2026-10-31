import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.breach.title": () => "Données clients volées",
  "event.breach.text": (p) => `Des attaquants ont copié les données clients de ${p.host} et exigent ${euro(Number(p.ransom))} sous ${p.hours} heures.`,
  "event.breachPress.title": () => "Violation de données dans la presse",
  "event.breachPress.text": (p) => `Des sites tech rapportent que des données clients de ${p.host} sont en vente en ligne. ${p.customers} ${Number(p.customers) < 2 ? "client était concerné" : "clients étaient concernés"}.`,
  "event.breachFine.title": () => "Amende de protection des données",
  "event.breachFine.text": (p) => `L'autorité de protection des données a infligé à l'entreprise une amende de ${euro(Number(p.amount))} pour la violation sur ${p.host}.`,
  "ticket.extortion.data.subject": () => "Les données de tes clients sont en vente",
  "ticket.extortion.data.text": (p) =>
    `Nous détenons les données clients de ${p.host} et les avons mises en vente en ligne. Envoie ${euro(Number(p.ransom))} sous 72 heures et nous retirons l'annonce. Passé ce délai, le plus offrant récupère tout.`,
  "ledger.ransom": (p) => `Rançon pour ${p.host}`,
  "ledger.fine": (p) => `Amende de protection des données pour ${p.host}`,
  "outcome.ransomPaid": () => "Rançon payée",
  "outcome.ransomRefused": () => "Rançon refusée",
} satisfies Dict;
