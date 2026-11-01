import type { Dict, Params } from "../lang";

const ITEM: Record<string, [string, string]> = {
  gameServer: ["serveur de jeu", "serveurs de jeu"], vps: ["VPS", "VPS"], storage: ["volume de stockage", "volumes de stockage"], webHosting: ["espace web", "espaces web"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const size = p.product === "storage" || p.product === "webHosting" ? `${p.diskGb} Go de disque` : `${p.vcpu} vCPU et ${p.ramGb} Go de RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} avec ${size}${Number(p.count) === 1 ? "" : " chacun"}`;
};
const span = (p: Params) => ({ 3: "le week-end", 7: "une semaine", 90: "trois mois", 365: "un an" })[Number(p.days) as 3] ?? `${p.days} jours`;
const PEOPLE: Record<string, string> = { gamer: "joueurs", private: "particuliers", hobbyDev: "développeurs" };
const term = (p: Params) => (Number(p.months) === 1 ? "un mois" : `${p.months} mois`);
const ask = (p: Params) => `${what(p)} pour ${term(p)}, ${Number(p.free) ? "gratuitement" : "à moitié prix"}`;
const reach = (p: Params) => `${p.audience} ${PEOPLE[String(p.profile)]}`;
const plural = (n: unknown, one: string, many: string) => (Number(n) <= 1 ? one : many);

export default {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} a besoin de serveurs`,
  "ticket.sponsor.lanTastic.text": (p) => `Bonjour, nous organisons ${p.event}, la plus grosse LAN party du département, et l'an dernier les serveurs ramaient plus que nos joueurs. Pourrais-tu sponsoriser ${what(p)} pendant ${span(p)} ? Ton logo passera sur le grand écran entre deux pauses pizza.`,
  "ticket.sponsor.chaosClub.subject": (p) => `Rencontre ${p.event}`,
  "ticket.sponsor.chaosClub.text": (p) => `On se retrouve chaque jeudi pour démonter des trucs qui marchaient très bien. Un hébergeur pour faire tourner nos outils nous aiderait : ${what(p)} pendant ${span(p)}. On ne peut pas payer, mais on te dira ce qu'on trouve.`,
  "ticket.sponsor.hackASorus.subject": (p) => `Hackathon ${p.event}`,
  "ticket.sponsor.hackASorus.text": (p) => `Quarante développeurs, un week-end, trop peu de sommeil. Il nous faut ${what(p)} pendant ${span(p)} pour faire tourner les projets. Rien n'est déployé en production, et tout ce qu'on casse reste dans le bac à sable.`,
  "ticket.sponsor.mirror.subject": (p) => `Miroir pour ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `Notre distribution cherche un miroir proche de ses utilisateurs. Il nous faudrait ${what(p)} pendant ${span(p)}. Ton entreprise figurera sur notre page des miroirs, entre une université et un monsieur nommé Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `Tournoi ${p.event}`,
  "ticket.sponsor.fragFest.text": (p) => `Les finales de ${p.event} approchent et les vieux serveurs tiennent avec des colliers de serrage. On cherche ${what(p)} pendant ${span(p)}. Le nom du sponsor est annoncé avant chaque match, alors s'il te plaît, ne tombe pas en panne.`,
  "ticket.sponsor.userGroup.subject": (p) => `Site web de ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `Notre groupe se réunit depuis les années quatre-vingt-dix et notre site vit dans la cave d'un membre depuis presque aussi longtemps. Pourrais-tu nous offrir ${what(p)} pendant ${span(p)} ? On te citera comme sponsor, juste sous le compte rendu des réunions.`,
  "ticket.sponsor.codeClub.subject": (p) => `Sites web pour ${p.event}`,
  "ticket.sponsor.codeClub.text": (p) => `Cette année, nos élèves créent leurs premiers sites web et adoreraient les mettre en ligne pour de vrai. Pourrais-tu sponsoriser ${what(p)} pendant ${span(p)} ? On te remerciera sur chaque page.`,
  "ticket.sponsor.shelter.subject": (p) => `Un foyer pour le site de ${p.event}`,
  "ticket.sponsor.shelter.text": (p) => `On trouve des foyers pour des chats, des chiens et un perroquet très bruyant, et notre site web en cherche un aussi. Pourrais-tu sponsoriser ${what(p)} pendant ${span(p)} ? Ton logo serait placé à côté de la liste d'adoption.`,
  "ticket.sponsor.pixelJam.subject": (p) => `${p.event} a besoin d'un terrain de jeu`,
  "ticket.sponsor.pixelJam.text": (p) => `À ${p.event}, les équipes créent un jeu en un week-end et tout le monde joue aux résultats le dimanche. Il nous faut ${what(p)} pendant ${span(p)} pour que le test de jeu ne plante pas.`,
  "ticket.sponsor.openData.subject": (p) => `Stockage pour ${p.event}`,
  "ticket.sponsor.openData.text": (p) => `Nous récupérons des jeux de données publics de la ville et en faisons des cartes et des outils pendant une semaine. Pourrais-tu sponsoriser ${what(p)} pendant ${span(p)} pour stocker les données brutes ?`,
  "ticket.sponsor.devOops.subject": (p) => `Streaming pour ${p.event}`,
  "ticket.sponsor.devOops.text": (p) => `Nous attendons deux mille participants et une keynote qui ne doit surtout pas ramer. Il nous faut ${what(p)} pendant ${span(p)} pour diffuser les conférences. Les intervenants te citeront au moins une fois, généralement par accident.`,
  "outcome.sponsored": () => "Sponsoring accepté",
  "outcome.sponsorDeclined": () => "Sponsoring refusé",
  "review.sponsor.bad": () => "Leur logo était sur le grand écran, leurs serveurs non.",
  "review.sponsor.ok": () => "Un sponsor qui s'est présenté. Plus ou moins.",
  "review.sponsor.good": () => "Des serveurs gratuits qui ont tenu tout le week-end. On s'en souviendra.",
  "event.sponsorRequest.title": () => "Demande de sponsoring",
  "event.sponsorRequest.text": (p) => `${p.event} cherche un sponsor.`,
  "event.sponsorDone.title": (p) => `${p.event} est terminé`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} de savoir-faire`,
      Number(p.awareness) > 0 && `${p.awareness} % de notoriété en plus`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "prospect", "prospects")}`,
      Number(p.stars) > 0 && `un avis ${p.stars} étoiles`,
      Number(p.recommendation) > 0 && "une recommandation pour une embauche qualifiée",
    ].filter(Boolean);
    return `Les serveurs de ${p.event} ont tenu. Tu gagnes ${gains.length ? gains.join(", ") : "un merci"}.`;
  },
  "ticket.sponsor.board.clan.subject": (p) => `Candidature de ${p.event}`,
  "ticket.sponsor.board.clan.text": (p) => `Ici ${p.event}. Notre clan compte ${reach(p)} qui ne se sont jamais mis d'accord sur rien, sauf sur le lag. On a vu ton offre sur Sponsor-Bored et on voudrait ${ask(p)}. Ta bannière passera sur la page d'accueil de notre site.`,
  "ticket.sponsor.board.lanParty.subject": (p) => `Candidature de ${p.event}`,
  "ticket.sponsor.board.lanParty.text": (p) => `On organise ${p.event} dans un gymnase loué pour ${reach(p)} et une quantité dangereuse de câbles. On voudrait ${ask(p)}. On te citera sur scène entre deux livraisons de pizzas.`,
  "ticket.sponsor.board.fanSite.subject": (p) => `Candidature de ${p.event}`,
  "ticket.sponsor.board.fanSite.text": (p) => `${p.event} est lu chaque mois par ${reach(p)}, surtout la nuit. On voudrait ${ask(p)}. Ta bannière sera en haut de chaque page, juste au-dessus des disputes.`,
  "ticket.sponsor.board.student.subject": (p) => `Candidature de ${p.event}`,
  "ticket.sponsor.board.student.text": (p) => `Nous sommes un projet étudiant avec ${reach(p)} dans le cursus, et notre professeur dit que la démo doit tourner quelque part de réel. On voudrait ${ask(p)}. Ton nom ira dans chaque signature de forum de l'équipe.`,
  "ticket.sponsor.board.mirror.subject": (p) => `Candidature de ${p.event}`,
  "ticket.sponsor.board.mirror.text": (p) => `Nous hébergeons un miroir de logiciels open source pour ${reach(p)} qui préféreraient les compiler eux-mêmes. On voudrait ${ask(p)}. Chaque mainteneur termine ses messages de forum par un merci pour toi.`,
  "event.boardApplication.title": () => "Candidature de sponsoring",
  "event.boardApplication.text": (p) => `${p.event} a candidaté à un sponsoring.`,
  "event.halfAccepted.title": (p) => `${p.event} accepte ton offre`,
  "event.halfAccepted.text": (p) => `${p.event} a accepté ton offre à moitié prix, et les services tournent.`,
  "event.halfDeclined.title": (p) => `${p.event} a choisi un autre sponsor`,
  "event.halfDeclined.text": (p) => `${p.event} a refusé ton offre à moitié prix.`,
  "event.boardDropped.title": (p) => `${p.event} a retiré ta bannière`,
  "event.boardDropped.text": (p) => `${p.event} a retiré ta bannière, le sponsoring n'apporte donc plus de notoriété ni de prospects.`,
  "event.boardDone.title": (p) => `${p.event} est terminé`,
  "event.boardDone.text": (p) => `Le sponsoring de ${p.event} est terminé.`,
  "error.badOffer": () => "Cette offre ne peut pas être publiée.",
  "error.offersOpen": () => "Trois offres sont déjà ouvertes.",
  "error.unknownOffer": () => "Cette offre n'est plus ouverte.",
  "error.offerFull": () => "Toutes les places de cette offre sont prises.",
  "ticket.sponsor.board.held.subject": (p) => `${p.event} : notre serveur est hors ligne`,
  "ticket.sponsor.board.held.text": () => `Bonjour, notre serveur est soudain hors ligne. Nous avons seulement retiré votre bannière pour la nouvelle mise en page, ce n'est quand même pas une raison pour nous bloquer ? Merci de le réactiver.`,
  "error.sponsorNotDropped": () => "Ce sponsoring affiche encore votre bannière.",
  "event.sponsorFailed.title": (p) => `${p.event} a mal tourné`,
  "event.sponsorFailed.text": (p) => `Les serveurs de ${p.event} ont été en panne pendant ${p.hours} ${plural(p.hours, "heure", "heures")}. Deux mauvais avis ont été publiés et ta notoriété a chuté.`,
} satisfies Dict;
