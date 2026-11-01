import type { Dict, Params } from "../lang";

const again = (p: Params) => (Number(p.round) > 1 ? "Ceci est notre deuxième relance, et le contenu est toujours en ligne. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Deuxième relance : ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

export default {
  "ticket.notice.movie.subject": (p) => second(p, `Violation de droit d'auteur sur ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}Au nom de ${p.sender}, nous avons trouvé sur ${p.url} une copie non autorisée de l'un de nos films. Retire-la sans délai.`,
  "ticket.notice.music.subject": (p) => second(p, `Musique piratée sur ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} détient les droits des enregistrements proposés au téléchargement sur ${p.url}. Retire-les sans délai.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `Supprime ${host(p)} MAINTENANT`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}TechTimo à l'appareil, 2,3 millions d'abonnés. La page ${p.url} qualifie ma vidéo ${p.video} de pire unboxing de l'année. C'est de la diffamation et probablement du droit d'auteur aussi. Supprime tout le site aujourd'hui.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Page de phishing sur ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}La page ${p.url} imite la connexion bancaire en ligne de ${p.sender} et collecte les mots de passe de nos clients. Mets-la hors ligne.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam faisant la publicité de ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}Ton réseau a envoyé 48 000 spams durant la dernière heure, tous avec un lien vers ${p.url}. Arrête l'expéditeur, sinon nous mettons ta plage d'adresses sur liste noire.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Ordonnance du tribunal : données de ${host(p)}` : `Demande de données clients : ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `Un tribunal a ordonné la remise de tous les dossiers d'abonnés et journaux pour ${p.url}. Réponds avant l'échéance, sinon des agents viendront récupérer le matériel en personne.`
    : `Dans le cadre d'une enquête, nous demandons les dossiers d'abonnés, les journaux d'accès et les données de paiement de ${p.url}. Réponds avant l'échéance.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Ordonnance du tribunal : retrait de ${host(p)}` : `Ordre de retrait : ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `Un tribunal a ordonné la mise hors ligne de ${p.url}. Réponds avant l'échéance, sinon des agents viendront récupérer le matériel en personne.`
    : `Le contenu de ${p.url} fait l'objet d'une enquête. Mets-le hors ligne et confirme avant l'échéance.`,
  "ticket.refund.outage.subject": () => "Remboursement pour la panne",
  "ticket.refund.outage.text": () => "Notre site est resté hors ligne pendant des heures. On paie pour un hébergement qui fonctionne, donc on attend le remboursement de ce mois.",
  "ticket.refund.dataLoss.subject": () => "Toutes nos données ont disparu",
  "ticket.refund.dataLoss.text": () => "Tout ce qu'on avait sur ton serveur a disparu. On veut le remboursement de ce mois, et une explication.",
  "outcome.forwarded": () => "Transmis au client",
  "outcome.takenDown": () => "Contenu retiré",
  "outcome.rejected": () => "Signalement rejeté",
  "outcome.ignored": () => "Ignoré",
  "outcome.complied": () => "Demande satisfaite",
  "outcome.objected": () => "Opposition envoyée",
  "outcome.seized": () => "Échéance dépassée, serveur saisi",
  "outcome.refunded": () => "Un mois remboursé",
  "outcome.refused": () => "Remboursement refusé",
  "ledger.refund": (p) => `Remboursement pour ${p.customer}`,
  "error.notHosted": () => "Aucun client n'utilise ce nom de domaine.",
  "event.gridDark.title": () => "Coupure de courant",
  "event.gridDark.text": (p) => `${p.location} est resté sans électricité pendant ${duration(Number(p.minutes))}.`,
  "event.gridCarried.title": () => "Panne du réseau électrique",
  "event.gridCarried.text": (p) => `${p.location} est resté en ligne malgré une panne du réseau de ${duration(Number(p.minutes))}.`,
  "event.feedDark.title": () => "Panne d'alimentation",
  "event.feedDark.text": (p) => `L'arrivée ${p.feed} de ${p.rack} est tombée en panne et ses serveurs sont restés sans électricité pendant ${duration(Number(p.minutes))}.`,
  "event.feedCarried.title": () => "Panne d'alimentation",
  "event.feedCarried.text": (p) => `${p.rack} est resté en ligne malgré une panne de ${duration(Number(p.minutes))} de l'arrivée ${p.feed}.`,
  "event.coolingFailed.title": () => "Panne de climatisation",
  "event.coolingFailed.text": (p) => `La climatisation de ${p.location} est tombée en panne pendant ${duration(Number(p.minutes))}.`,
  "event.overheated.title": () => "Serveurs en surchauffe",
  "event.overheated.text": (p) => `${Number(p.count) === 1 ? "1 serveur" : `${p.count} serveurs`} à ${p.location} ${Number(p.count) === 1 ? "s'est arrêté" : "se sont arrêtés"} à cause de la chaleur.`,
  "event.feedCascade.title": () => "Panne d'alimentation",
  "event.feedCascade.text": (p) => `L'arrivée ${p.feed} de ${p.rack} est tombée en panne et l'autre arrivée, incapable de porter toute la charge, s'est déclenchée. Tous ses serveurs sont restés sans électricité pendant ${duration(Number(p.minutes))}.`,
  "event.seized.title": () => "Serveur saisi",
  "event.seized.text": (p) => `${p.agency} a emporté ${p.device} depuis ${p.location}.`,
  "event.seizedBack.title": () => "Serveur restitué",
  "event.seizedBack.text": (p) => `${p.device} est de retour en stock à ${p.location}.`,
  "sender.bsi": () => "Office fédéral de la sécurité informatick",
  "sender.europoll": () => "Europoll",
  "sender.fbi": () => "Office central de la cyberinspection",
  "review.outage.bad": () => "Hors ligne pendant des heures et pas un mot de leur part. Plus jamais.",
  "review.outage.ok": () => "Il y a eu une panne, mais ils l'ont réglée.",
  "review.outage.good": () => "Même l'unique panne a été bien gérée.",
  "review.dataLoss.bad": () => "Ils ont perdu tous nos fichiers. Faites vos propres sauvegardes.",
  "review.dataLoss.ok": () => "Ils ont perdu nos données mais nous ont remboursés. Avis mitigé.",
  "review.dataLoss.good": () => "Données perdues, mais ils ont réparé leur erreur.",
  "review.fast.bad": () => "Machine rapide, support lent.",
  "review.fast.ok": () => "Le serveur est rapide, le reste est moyen.",
  "review.fast.good": () => "Le tick rate n'a pas baissé une seule fois. Le meilleur serveur de jeu que nous ayons loué.",
  "review.smooth.bad": () => "Ça tournait, mais chaque autre contact avec eux était pénible.",
  "review.smooth.ok": () => "Rien à redire sur la disponibilité. Sinon rien de spécial.",
  "review.smooth.good": () => "Un mois entier sans accroc. Exactement ce que doit être l'hébergement.",
} satisfies Dict;
