import { euroCents } from "../../sim/00-core/money";
import { t } from "../en";
import type { Dict, Params } from "../lang";

const gb = (x: string | number) => `${x} Go`;
const mailboxes = (n: string | number) => `${n} ${Number(n) < 2 ? "boîte mail" : "boîtes mail"}`;
const web = (p: Params) => `${gb(p.disk)} d'espace, ${gb(p.traffic)} de trafic par mois et ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU, ${gb(p.ram)} de RAM et ${gb(p.disk)} de disque`;
const cards = (p: Params) => `${p.gpu} GPU`;
const domain = (p: Params) => (Number(p.owned) ? `Je possède déjà ${p.domain} et j'aimerais la transférer chez toi.${p.auth ? ` Le code d'autorisation est ${p.auth}.` : ""}` : `Enregistre aussi ${p.domain} pour moi, s'il te plaît.`);
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}` : xs[0] ?? "plus de place");
const more = (p: Params) => (p.product === "webHosting"
  ? `de ${gb(p.disk0)} à ${gb(p.disk1)} d'espace, de ${gb(p.traffic0)} à ${gb(p.traffic1)} de trafic et de ${p.mail0} à ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `de ${p.cpu0} à ${p.cpu1} vCPU`, Number(p.ram1) > 0 && `de ${gb(p.ram0)} à ${gb(p.ram1)} de RAM`, Number(p.disk1) > 0 && `de ${gb(p.disk0)} à ${gb(p.disk1)} de disque`,
  ].filter((x): x is string => !!x)));

export default {
  "order.msg.webHosting.0": (p) => `Bonjour, il me faut un hébergement web pour ${p.domain} : environ ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `Un ami t'a recommandé. Mon site ${p.domain} a besoin de ${web(p)}. ${domain(p)} Combien ça coûterait ?`,
  "order.msg.vps.0": (p) => `Je voudrais un VPS à ${p.city} avec ${box(p)}. Accès root, s'il te plaît. Je sais ce que je fais.`,
  "order.msg.vps.1": (p) => `Monte-moi un serveur virtuel, s'il te plaît : ${box(p)}. Debiant serait top, avec facturation mensuelle.`,
  "order.msg.gameServer.0": (p) => `Il nous faut un serveur de jeu pour notre clan avec ${box(p)}. Il doit tourner d'ici vendredi soir.`,
  "order.msg.gameServer.1": (p) => `Monte-nous un serveur de jeu à ${p.city}, s'il te plaît : ${box(p)}. Un ping bas compte plus que tout pour nous.`,
  "order.msg.gpu.0": (p) => `Je voudrais un serveur GPU à ${p.city} avec ${cards(p)}, ${box(p)}. Il me sert à entraîner mes modèles.`,
  "order.msg.gpu.1": (p) => `Monte-moi un serveur virtuel avec ${cards(p)}, s'il te plaît : ${box(p)}. Des pilotes CUDA seraient top, avec facturation mensuelle.`,
  "sales.msg.upgrade": (p) => `On atteint sans cesse nos limites. Il nous faut ${more(p)}. Combien coûterait la mise à niveau ?`,
  "sales.you.upgrade": (p) => `On peut faire la mise à niveau pour ${euroCents(Number(p.price))} par mois au total.`,
  "sales.you.upgradeDone": (p) => `La mise à niveau est en ligne. Ton service tourne désormais avec les nouvelles ressources à ${euroCents(Number(p.price))} par mois.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "Mon service"} devient trop petit`,
  "ticket.upgrade.more.text": () => "On manque toujours de place. Combien coûterait la mise à niveau ?",
  "invoice.line.firstMonth": (p) => `${p.label}, premier mois`,
  "invoice.line.setupFee": (p) => `${p.label}, frais de mise en service`,
  "invoice.line.domain": (p) => `Domaine ${p.domain}, première année`,
  "invoice.line.domainTransfer": (p) => `Transfert de ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Domaine ${p.domain}, une année de plus`,
  "ledger.domain": (p) => `${p.domain} chez ${p.registry}`,
  "ledger.domainTransfer": (p) => `Transfert de ${p.domain} vers ${p.registry}`,
  "ledger.domainRenewal": (p) => `Renouvellement de ${p.domain} chez ${p.registry}`,
  "activity.renewDomain": (p) => `${p.domain} renouvelé pour un an`,
  "activity.changePackage": (p) => `Passé au forfait ${p.pkg}`,
  "activity.upgrade": (p) => `Service mis à niveau à ${euroCents(Number(p.price))} par mois`,
  "event.orderAccepted.title": () => "Devis accepté",
  "event.orderAccepted.text": (p) => `${p.name} a accepté le devis.`,
  "event.orderPaid.title": () => "Commande payée",
  "event.orderPaid.text": (p) => `${p.name} a payé la facture de la commande et attend la mise en service.`,
  "event.stepFailed.title": () => "Étape de commande échouée",
  "event.stepFailed.text": (p) => `${p.name} : ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "Domaine bientôt expiré",
  "event.domainExpiring.text": (p) => `${p.domain} expire dans ${p.days} jours.`,
  "event.domainExpired.title": () => "Domaine expiré",
  "event.domainExpired.text": (p) => `${p.domain} a expiré et son site est hors ligne.`,
  "lost.unpaid": () => "Jamais payé",
  "error.needsQuote": () => "Le client n'a pas encore accepté de devis.",
  "error.quoteSent": () => "Le client n'a pas encore répondu au devis.",
  "error.needsAutomation": () => "Choisis un hôte pour la mise en service.",
  "error.needsAccount": () => "Crée d'abord le compte client.",
  "error.addressMissing": () => "Saisis l'adresse complète.",
  "error.quoteSentAlready": () => "Ce devis est déjà envoyé.",
  "error.quoteOtherOrder": () => "Ce devis appartient à une autre commande.",
  "error.quoteNotAccepted": () => "Le client n'a pas accepté ce devis.",
  "error.quoteInvoiced": () => "Ce devis a déjà été transféré en facture.",
  "error.needsInvoice": () => "Confirme d'abord la commande et envoie la facture.",
  "error.needsDomain": () => "Enregistre d'abord le domaine.",
  "error.stepDone": () => "Cette étape est terminée.",
  "error.domainTaken": () => "Ce domaine appartient à un autre client.",
  "error.unknownDomain": () => "Ce domaine n'est enregistré pour aucun client actif.",
  "error.routeElsewhere": () => "Ce cluster se trouve dans une autre ville.",
} satisfies Dict;
