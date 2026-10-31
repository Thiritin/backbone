import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.burninQuick.title": () => "Burn-in rapide terminé",
  "event.burninQuick.text": (p) => `${p.device} a terminé un burn-in rapide et compte ${p.found} ${Number(p.found) < 2 ? "pièce usée" : "pièces usées"}.`,
  "event.burninFull.title": () => "Burn-in complet terminé",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} a terminé un burn-in complet et ${p.found} ${Number(p.found) < 2 ? "pièce est tombée" : "pièces sont tombées"} en panne.` : `${p.device} a réussi un burn-in complet.`),
  "event.burninAborted.title": () => "Burn-in interrompu",
  "event.burninAborted.text": (p) => `${p.device} a perdu le courant pendant son burn-in.`,
  "event.usedRefund.title": () => "Protection acheteur versée",
  "event.usedRefund.text": (p) => `Une pièce de ${p.device} est tombée en panne moins de 14 jours après l'achat et ${euro(Number(p.amount))} ont été remboursés.`,
  "ledger.usedRefund": (p) => `Remboursement protection acheteur pour ${p.device}`,
  "error.burninNoServer": () => "Seul un serveur monté en baie peut passer un burn-in.",
  "error.burninRunning": () => "Un burn-in est déjà en cours.",
  "error.burninNoPower": () => "Le serveur doit être allumé et alimenté.",
  "error.burninTaken": () => "Le serveur est utilisé.",
} satisfies Dict;
