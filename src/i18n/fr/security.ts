import type { Dict, Params } from "../lang";

const VULN: Record<string, string> = {
  mopb: "un bogue de corruption mémoire dans le moteur Zend, l'un des trente découverts ce mois-ci",
  cgi: "un bogue qui permet à une chaîne de requête de passer des options de ligne de commande à PHP-CGI",
  fpm: "un dépassement de tampon par le bas dans PHP-FPM qui exécute du code depuis une URL forgée",
  argv: "une injection d'arguments dans PHP-CGI que peut déclencher un trait d'union conditionnel",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export default {
  "event.vuln.announced.title": () => "Vulnérabilité de sécurité dans PHP",
  "event.vuln.announced.text": (p) => `Les médias signalent ${vuln(p)}, qui touche PHP ${p.versions}. Le projet PHP le confirme, n'a pas encore de correctif et en attend un le ${p.date}.`,
  "event.vuln.poc.title": () => "Preuve de concept publiée",
  "event.vuln.poc.text": (p) => `Quelqu'un sur Twister a publié un exploit fonctionnel pour PHP ${p.versions}, avec une capture d'écran et trois émojis feu. Il a été repartagé 4 000 fois.`,
  "event.vuln.warning.title": () => "L'office fédéral alerte",
  "event.vuln.warning.text": (p) => `Le Bundesamt für Sicherheit in der Informationstechnick signale des scans massifs visant PHP ${p.versions} et conseille de mettre hors ligne les systèmes touchés jusqu'à la sortie du correctif.`,
  "event.vuln.patch.title": () => "Correctif PHP publié",
  "event.vuln.patch.text": (p) => `Le projet PHP a publié le correctif pour PHP ${p.versions} à la date annoncée, à la surprise générale.`,
  "event.vuln.hacked.title": () => "Nœud compromis",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) < 2 ? "client a reçu" : "clients ont reçu"} un avis de fuite de données.`;
    if (p.kind === "mail") return `Des attaquants ont pris le contrôle de ${p.device} et y envoient du spam.`;
    const hit = p.kind === "cloud" ? "ont pris le contrôle des machines virtuelles sur" : p.kind === "game" ? "ont pris le contrôle des serveurs de jeu sur" : "ont défiguré les sites sur";
    return `Des attaquants ${hit} ${p.device} et y envoient du spam. ${leak}`;
  },
  "error.patchPending": () => "Le correctif de cette vulnérabilité n'est pas encore sorti.",
  "error.sitesOffline": () => "Les sites de ce nœud sont déjà hors ligne.",
  "error.sitesOnline": () => "Les sites de ce nœud sont déjà en ligne.",
  "error.notHacked": () => "Ce nœud n'est pas compromis.",
} satisfies Dict;
