import type { Dict } from "../lang";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

export default {
  "ticket.migration.offer.subject": (p) => `Migration de ${p.hostname || p.service} vers ${p.target}`,
  "ticket.migration.offer.text": (p) => `Nous aimerions migrer ${p.hostname || p.service} vers ${p.target}. Dis-nous si tu es d'accord.`,
  "ticket.migration.accept.text": (p) => `D'accord pour moi. Fais-le ${DAYS[Number(p.day)]} entre ${clock(p.from)} et ${clock(p.to)}.`,
  "ticket.migration.acceptAny.text": () => "D'accord pour moi. Vas-y quand ça t'arrange.",
  "ticket.migration.decline.text": () => "Je préfère que tout reste comme c'est.",
  "ticket.migration.missed.text": () => "La migration n'a jamais eu lieu. Je ne suis pas content.",
  "outcome.moved": () => "Migré",
  "outcome.moveDeclined": () => "Refusé",
  "event.moveAccepted.title": () => "Migration acceptée",
  "event.moveAccepted.text": (p) => `${p.name} a accepté la migration de ${p.service}.`,
  "event.moveDeclined.title": () => "Migration refusée",
  "event.moveDeclined.text": (p) => `${p.name} a refusé la migration de ${p.service}.`,
  "event.moveWindow.title": () => "Fenêtre de migration ouverte",
  "event.moveWindow.text": (p) => `${p.name} attend que ${p.service} soit migré d'ici ${clock(p.to)}.`,
  "event.moveDone.title": () => "Service migré",
  "event.moveDone.text": (p) => `${p.service} de ${p.name} a été migré vers ${p.target}.`,
  "event.moveMissed.title": () => "Migration manquée",
  "event.moveMissed.text": (p) => `La migration de ${p.service} de ${p.name} n'a pas eu lieu.`,
  "error.moveOffered": () => "Ce service a une offre de migration en attente de réponse.",
  "error.moveTarget": () => "Ce service ne peut pas migrer là-bas.",
  "ledger.moveServer": (p) => `Déplacement de ${p.device} vers ${p.location}`,
  "error.moveServerOnly": () => "Seul un serveur se déplace avec ses charges de travail.",
  "error.locationNotReady": () => "Le site n'est pas encore prêt.",
  "error.clusterSpans": () => "Le cluster tourne sur plus de serveurs que celui-ci.",
} satisfies Dict;
