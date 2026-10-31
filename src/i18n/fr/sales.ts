import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` Il nous faut le SLA ${SLA[p.sla] ?? p.sla}.`);
const price = (p: Params) => euroCents(Number(p.price));
const web = (p: Params) => `${p.disk} Go d'espace et ${p.mail} ${Number(p.mail) <= 1 ? "boîte mail" : "boîtes mail"}`;
const cards = (p: Params) => `${p.gpu} GPU`;
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} Go de RAM et ${p.disk} Go de disque`;

const STUDY_NAME: Record<string, string> = {
  private: "Particuliers", gamer: "Joueurs", hobbyDev: "Développeurs amateurs", soleProp: "Indépendants", smallBiz: "Petites entreprises",
  agency: "Agences et startups", office: "Cabinets médicaux et juridiques", onlineShop: "Boutiques en ligne", enterprise: "Grandes entreprises",
};

export default {
  "request.use.private": () => "Ce n'est qu'un petit site perso, donc rien n'est jamais urgent.",
  "request.use.gamer": () => "On joue presque tous les soirs et tout le week-end, il faut que ça tienne à ces moments-là.",
  "request.use.hobbyDev": () => "C'est un projet perso sur lequel je bidouille quand j'ai le temps.",
  "request.use.soleProp": () => "Mes clients me trouvent via le site, et je le consulte tous les quelques jours.",
  "request.use.smallBiz": () => "Notre équipe travaille dessus tous les jours pendant les heures de bureau.",
  "request.use.agency": () => "Nos clients sont dessus toute la journée, donc on repère vite les problèmes.",
  "request.use.office": () => "Les patients y prennent rendez-vous chaque matin.",
  "request.use.onlineShop": () => "Les commandes arrivent jour et nuit, chaque minute hors ligne nous coûte de l'argent.",
  "request.use.enterprise": () => "Notre personnel en dépend jour et nuit.",
  "sales.msg.webHosting.0": (p) => `Bonjour, je cherche un hébergement pour ${p.domain || "mon site web"} : environ ${web(p)}. Combien cela coûterait-il par mois ?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `Un ami t'a recommandé. Il nous faut ${web(p)} pour ${p.domain || "notre site"}, hébergé à ${p.city} si possible.${sla(p)} Quel est ton prix ?`,
  "sales.msg.vps.0": (p) => `Il nous faut un VPS avec ${box(p)} et un accès root à ${p.city}.${sla(p)} Merci de m'envoyer ton prix mensuel.`,
  "sales.msg.vps.1": (p) => `Notre application est trop à l'étroit sur l'hébergement mutualisé. Peux-tu proposer un VPS avec ${box(p)} ?${sla(p)} Une facturation mensuelle nous conviendrait le mieux.`,
  "sales.msg.gameServer.0": (p) => `Notre clan cherche un serveur de jeu avec ${box(p)} qui ne lague pas le vendredi soir. Combien par mois ?`,
  "sales.msg.gameServer.1": (p) => `On cherche un serveur de jeu avec ${box(p)} près de ${p.city} pour un ping bas. Quel est ton tarif ?`,
  "sales.msg.dedicated.0": (p) => `Nous cherchons un serveur dédié avec au moins ${p.ram} Go de RAM à ${p.city}, sur un contrat de douze mois.${sla(p)} Merci de nous indiquer un prix mensuel.`,
  "sales.msg.dedicated.1": (p) => `Notre équipe veut son propre matériel. Pourrais-tu fournir un serveur avec au moins ${p.ram} Go de RAM ?${sla(p)}`,
  "sales.msg.gpu.0": (p) => `Nous entraînons des modèles et il nous faut ${cards(p)} avec ${box(p)} à ${p.city}.${sla(p)} Combien cela coûterait-il par mois ?`,
  "sales.msg.gpu.1": (p) => `Notre équipe a besoin de serveurs GPU pour le rendu et l'inférence : ${cards(p)}, ${box(p)}.${sla(p)} Merci de nous envoyer ton prix mensuel.`,
  "sales.msg.shady": (p) => `Il nous faut un VPS avec ${box(p)} aujourd'hui. Beaucoup de trafic, pas de questions, pas de paperasse. On paie en crypto, toujours à temps. Donne ton prix.`,
  "sales.msg.discount": (p) => `Ta campagne parlait de ${p.discount} % de remise pour les agences. On aimerait en profiter.`,
  "sales.reply.accept": (p) => `Ça nous convient. Merci de le mettre en place. Cordialement, ${p.name}`,
  "sales.reply.counter": (p) => `C'est un peu au-dessus de notre budget. On pourrait faire ${price(p)} par mois. Dis-nous.`,
  "sales.reply.noBudget": (p) => `Merci, mais nous n'avons pas le budget pour ça. Nous allons chercher un autre fournisseur. ${p.name}`,
  "sales.reply.refused": (p) => `Merci pour l'offre. Nous avons trouvé une meilleure affaire ailleurs. ${p.name}`,
  "sales.you.decline": () => "Merci pour l'intérêt porté à notre offre. Nous ne pouvons pas nous en charger pour le moment.",
  "sales.need.location": (p) => `Nécessite un site à ${p.city}`,
  "sales.need.age": (p) => `Nécessite une entreprise d'au moins ${p.months} mois`,
  "sales.need.reviews": (p) => `Nécessite une note d'au moins ${p.stars} étoiles`,
  "sales.req.location": (p) => `Site à ${p.city}`,
  "sales.req.cluster": (p) => `Cluster à ${p.city}`,
  "sales.req.server": (p) => `Serveur libre à ${p.city}`,
  "sales.req.datacenter": (p) => `Centre de données à ${p.city}`,
  "sales.req.age": (p) => `Entreprise d'au moins ${p.months} mois`,
  "sales.req.reviews": (p) => `Note de ${p.stars} étoiles`,
  "lost.expired": () => "Pas de réponse à temps",
  "lost.price": () => "Trop cher",
  "lost.declined": () => "Refusé",
  "lost.noCapacity": (p) => `Pas de capacité à ${p.city}`,
  "event.salesWon.title": () => "Contrat décroché",
  "event.salesWon.text": (p) => `${p.name} a signé à ${price(p)} par mois pour ${p.spec}.`,
  "event.salesCounter.title": () => "Contre-offre",
  "event.salesCounter.text": (p) => `${p.name} propose ${price(p)} par mois.`,
  "event.salesRefused.title": () => "Devis refusé",
  "event.salesRefused.text": (p) => `${p.name} a refusé ton devis.`,
  "error.unknownRequest": () => "Cette demande n'est plus ouverte.",
  "error.quotePrice": () => "Saisis un prix mensuel supérieur à zéro.",
  "error.requestMissing": () => "Tu ne peux pas encore répondre à cette demande.",
  "error.yearlyPrice": () => "Les produits annuels gardent leur prix jusqu'au renouvellement.",
  "error.unknownProfile": () => "Ce groupe de clients n'existe pas.",
  "error.studyDone": () => "Tu as déjà cette étude.",
  "ledger.marketStudy": (p) => `Étude de marché par Gartnah : ${STUDY_NAME[p.profile] ?? p.profile}`,
} satisfies Dict;
