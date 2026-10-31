import type { Dict, Params } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`; };
const FEATURE: Record<string, string> = {
  cluster: "fonctionne en un seul cluster sur plusieurs serveurs",
  balloon: "récupère la RAM invitée par ballooning, si bien qu'une machine virtuelle gagne de la RAM en cours d'exécution",
  importSame: "importe les espaces web d'un autre serveur qui l'utilise",
  importOther: "importe les espaces web d'autres panneaux d'hébergement",
};
const kind = (p: Params) => (p.kind === "panel" ? "du panneau d'hébergement" : p.kind === "game" ? "du panneau de serveurs de jeu" : "de la plateforme cloud");

export default {
  "event.news.software.title": (p) => `${p.name} est sorti`,
  "event.news.software.text": (p) => `Heize online rapporte la sortie ${kind(p)} ${p.name}, installable sur tes serveurs.`,
  "event.news.autoUpdate.title": (p) => `${p.name} se met à jour tout seul`,
  "event.news.autoUpdate.text": (p) => `Heize online rapporte que ${p.name} peut désormais installer ses mises à jour automatiquement la nuit.`,
  "event.news.generation.title": (p) => `Serveurs G${p.gen} en boutique`,
  "event.news.generation.text": (p) => `Heize online rapporte que la génération G${p.gen} apporte ${p.cores} cœurs et ${p.ramGb} Go de RAM par serveur standard, avec ${p.disk} de stockage.`,
  "event.news.endOfSale.title": (p) => `${p.name} retiré de la vente`,
  "event.news.endOfSale.text": (p) => `Heize online rapporte que ${p.name} a quitté la boutique et que le support du modèle prend fin en ${p.supportEnd}.`,
  "event.news.mail.title": (p) => `${p.name} se lance dans l'e-mail pro`,
  "event.news.mail.text": (p) => `Handelsblah rapporte que ${p.name} vend désormais des boîtes mail hébergées aux entreprises, à ${p.price} euros par poste et par mois.`,
  "event.news.ipv6Dc.title": () => "IPv6 dans les centres de données",
  "event.news.ipv6Dc.text": () => "Golem.dy rapporte que les centres de données distribuent désormais des adresses IPv6, dont personne n'a encore manqué.",
  "event.news.ipv6Home.title": () => "IPv6 sur les lignes domestiques",
  "event.news.ipv6Home.text": () => "Golem.dy rapporte que les lignes domestiques acheminent désormais l'IPv6, ce qui donne une adresse de plus à changer à la reconnexion nocturne.",
  "event.news.ripeLast.title": () => "Le RIPE distribue son dernier /8",
  "event.news.ripeLast.text": () => "Golem.dy rapporte que le RIPE en est à son dernier /8 et que les nouveaux membres reçoivent désormais un /22 au lieu d'un /21.",
  "event.news.ripeOut.title": () => "Pool IPv4 épuisé",
  "event.news.ripeOut.text": () => "Golem.dy rapporte que le RIPE n'a plus aucune adresse IPv4 libre et que les nouveaux membres sont mis sur liste d'attente pour un /24.",
  "event.news.gpu.title": (p) => `${p.name} lancé`,
  "event.news.gpu.text": (p) => `Heize online rapporte que ${p.name} sort au prix catalogue de ${p.price} euros et consomme ${p.watts} watts pour cela.`,
  "event.news.gpuDemand.title": (p) => (p.year === 2017 ? "Le deep learning a besoin de GPU" : "L'IA générative a besoin de GPU"),
  "event.news.gpuDemand.text": (p) => (p.year === 2017
    ? "Handelsblah rapporte que le deep learning pousse des équipes à chercher des serveurs GPU en location, et que agences et développeurs en demandent désormais aux hébergeurs."
    : "Handelsblah rapporte que l'IA générative fait faire la queue aux entreprises pour des serveurs GPU en location, et que les hébergeurs avec des cartes libres peuvent fixer leur prix."),
  "event.news.design.title": (p) => `Web design ${p.year}`,
  "event.news.design.text": (p) => `Handelsblah rapporte que les visiteurs attendent désormais le style ${p.year} de tous les sites web, et que les designs plus anciens perdent des requêtes.`,
  "event.news.line.title": (p) => `${p.line} pourrait se vendre`,
  "event.news.line.text": (p) => `Handelsblah rapporte que tu peux livrer ${p.line} dès aujourd'hui sans l'avoir listé sur ton site web.`,
  "event.news.models.title": () => "Nouveau matériel en boutique",
  "event.news.models.text": (p) => `Heize online rapporte que la boutique vend désormais ${list(p.names)}.`,
  "event.news.shape.title": (p) => `Serveurs ${p.name} en boutique`,
  "event.news.shape.text": (p) => `Heize online rapporte que la boutique vend désormais des serveurs ${p.name}.`,
  "event.news.feature.title": (p) => `Mise à jour de ${p.name}`,
  "event.news.feature.text": (p) => `Heize online rapporte que la nouvelle version de ${p.name} ${FEATURE[p.feature] ?? p.feature}.`,
  "event.news.desk.title": (p) => `${p.name} est sorti`,
  "event.news.desk.text": (p) => `Heize online rapporte que le logiciel de support ${p.name} est sorti et qu'on peut s'y abonner dans le Pear Store.`,
  "event.news.training.title": (p) => `Formation ${p.name} proposée`,
  "event.news.training.text": (p) => `Heize online rapporte qu'une formation ${p.name} est désormais proposée et que ton équipe peut la suivre dans Recherche.`,
  "event.news.release.title": (p) => `Versions logicielles ${p.year}`,
  "event.news.release.text": (p) => `Heize online rapporte que les versions ${p.year} de ${list(p.names)} sont sorties et peuvent être installées sur tes serveurs.`,
  "event.news.homeLines.title": () => "Nouvelles lignes domestiques",
  "event.news.homeLines.text": (p) => `Golem.dy rapporte que ${list(p.names)} peuvent désormais être commandées pour la maison.`,
  "event.news.ports.title": (p) => `Ports ${p.gbit} Gbit/s`,
  "event.news.ports.text": (p) => `Golem.dy rapporte que les opérateurs et points d'échange internet vendent désormais des ports ${p.gbit} Gbit/s.`,
  "event.news.freeSsl.title": () => "Certificats SSL gratuits",
  "event.news.freeSsl.text": () => "Handelsblah rapporte que Let's Encryptly délivre désormais des certificats SSL gratuitement et que les clients ne s'attendent plus à en payer un.",
} satisfies Dict;
