import type { Dict } from "../lang";

export default {
  "ticket.howTo.hacked.subject": () => "Mon site web affiche le slogan de quelqu'un d'autre",
  "ticket.howTo.hacked.text": (p) => `${p.domain || "Mon site web"} affiche une tête de mort et un message en anglais approximatif à la place de ma page d'accueil. Peux-tu arranger ça ?`,
  "ticket.howTo.update.subject": () => "Aide pour mettre à jour mon site web",
  "ticket.howTo.update.text": () => "Tu as écrit que le logiciel derrière mon site web a besoin d'une mise à jour. Je ne sais pas du tout comment faire. Peux-tu t'en charger pour moi ?",
  "event.siteHacked.title": () => "Site client défiguré",
  "event.siteHacked.text": (p) => `Le site ${p.site} de ${p.customer} a été défiguré via une faille dans ${p.software}. Il envoie du spam jusqu'à son nettoyage.`,
  "event.siteLeft.title": () => "Client parti",
  "event.siteLeft.text": (p) => `${p.customer} a résilié après que ${p.site} a été défiguré pour la troisième fois en un an.`,
  "event.offerDeclined.title": () => "Offre refusée",
  "event.offerDeclined.text": (p) => `${p.name} a refusé l'offre.`,
  "outcome.cleaned": () => "Site nettoyé",
  "outcome.noBackup": () => "Pas de sauvegarde, le client reconstruit le site",
  "outcome.updated": () => "Logiciel mis à jour",
  "outcome.updateSold": () => "Mise à jour vendue",
  "outcome.managedSold": () => "Mises à jour gérées vendues",
  "ledger.appUpdate": (p) => `Mise à jour de ${p.site}`,
  "error.notDefaced": () => "Ce site n'est pas défiguré.",
  "error.noBackup": () => "Ce site n'a pas de sauvegarde à restaurer.",
  "error.unknownVulnerability": () => "Cette vulnérabilité n'est pas connue.",
  "error.nobodyToNotify": () => "Aucun client à prévenir.",
} satisfies Dict;
