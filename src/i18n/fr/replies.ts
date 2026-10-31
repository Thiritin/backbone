import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Dict, Params } from "../lang";

type Mail = (p: Params) => string;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const hi = (p: Params) => (p.name ? `Bonjour ${p.name},` : "Bonjour,");
const SIGN: Mail[] = [
  (p) => `Cordialement,\nL'équipe ${p.company}`,
  (p) => `Bien cordialement,\nSupport ${p.company}\nsupport@${p.host}`,
  (p) => `Bien à toi,\nTon service client ${p.company}`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Madame, Monsieur,"), lead = to((p) => `Bonjour ${p.name},`);
const siteOf = (p: Params) => new URL(String(p.url)).hostname;
const site = (p: Params) => p.domain || p.service || "ton site";
const svc = (p: Params) => p.hostname || p.service || "ton service";
const day = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} à ${String(d.getUTCHours()).padStart(2, "0")} h`;
};
const setupFee = (p: Params) => (Number(p.setup) > 0 ? ` plus des frais de mise en service uniques de ${euroCents(Number(p.setup))}` : "");
const hosting = (p: Params) => (p.domain ? `${p.line} pour ${p.domain}` : p.line);
const plural = (n: unknown, one: string, many: string) => (Number(n) <= 1 ? one : many);
const domainLine = (p: Params) => (Number(p.owned) ? `Le transfert de ${p.domain} chez nous est terminé, et nous nous occupons de ses renouvellements à partir de maintenant.` : `Nous avons enregistré ${p.domain} pour toi.`);

const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Merci de nous avoir prévenus. Nous savons que ${svc(p)} est injoignable et nos techniciens y travaillent en ce moment même. Nous te réécrirons dès que ce sera rétabli.`,
    (p) => `Nous confirmons la panne de ${svc(p)}. La cause est en cours de réparation, et tu auras de nos nouvelles dès que tout refonctionnera.`,
    (p) => `Désolés pour l'interruption. ${svc(p)} est en panne de notre côté et le correctif est en cours. Tu n'as rien à faire.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} est de nouveau en ligne et tout fonctionne normalement. Nous nous excusons pour l'interruption.`,
    (p) => `Bonne nouvelle : le problème est résolu et ${svc(p)} répond de nouveau. Merci de ta patience.`,
    (p) => `La panne est terminée et ${svc(p)} est de nouveau joignable. Dis-nous si quelque chose cloche encore.`,
  ],
  "tpl.askDetails": [
    () => "Merci pour ton message. Peux-tu nous en dire un peu plus sur ce que tu constates, idéalement avec le message d'erreur exact et l'heure à laquelle c'est arrivé ?",
    () => "Nous voulons bien t'aider. Peux-tu nous envoyer une capture d'écran ou le texte exact du message que tu reçois ?",
    () => "Pour examiner cela correctement, il nous faut quelques détails. Que faisais-tu quand c'est arrivé, et qu'as-tu vu ?",
  ],
  "tpl.ftp": [
    (p) => `Connecte-toi avec un client FTP comme FileZilla à ftp.${p.host} avec tes identifiants du panneau, puis copie tes fichiers dans le dossier htdocs de ${site(p)}. Ils sont en ligne tout de suite.`,
    (p) => `Tu peux envoyer tes pages en FTP : le serveur est ftp.${p.host}, l'identifiant et le mot de passe sont ceux de ton panneau. Tout ce qui est dans le dossier htdocs apparaît sur ${site(p)}.`,
    (p) => `Le plus rapide, c'est le FTP. Pointe ton logiciel FTP vers ftp.${p.host}, connecte-toi avec les identifiants de ton panneau et dépose les fichiers dans htdocs. ${site(p)} les affiche aussitôt.`,
  ],
  "tpl.mail": [
    (p) => `Saisis mail.${p.host} comme serveur entrant et sortant, avec ton adresse e-mail complète comme identifiant, le port 993 pour IMAP et le port 587 pour l'envoi.`,
    (p) => `Le nom du serveur pour le courrier entrant et sortant est mail.${p.host}. Utilise ton adresse e-mail complète comme identifiant et le mot de passe de ta boîte.`,
    (p) => `Dans Outlook, choisis IMAP et saisis mail.${p.host} pour les deux serveurs. L'identifiant est ton adresse complète${p.domain ? ` chez ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Indique ns1.${p.host} et ns2.${p.host} comme serveurs de noms de ${site(p)} chez ton registrar. La modification peut mettre jusqu'à un jour à se propager partout.`,
    (p) => `Chez le registrar où tu as acheté ${site(p)}, remplace les serveurs de noms par ns1.${p.host} et ns2.${p.host}. En un jour au plus, le domaine affiche ton site.`,
    (p) => `${p.domain ? `${p.domain} doit` : "Ton nom de domaine doit"} pointer vers nous : saisis ns1.${p.host} et ns2.${p.host} comme serveurs de noms chez ton registrar. Il faut en général quelques heures, un jour au maximum.`,
  ],
  "tpl.panel": [
    (p) => `Nous avons envoyé un nouveau mot de passe du panneau de contrôle à ton adresse de contact. Tu peux te connecter sur panel.${p.host}.`,
    (p) => `Un nouveau mot de passe du panneau arrive dans ta boîte. La page de connexion est panel.${p.host}.`,
    (p) => `Nous avons réinitialisé l'accès à ton panneau de contrôle et t'avons envoyé le nouveau mot de passe par e-mail. Connecte-toi sur panel.${p.host} et change-le.`,
  ],
  "tpl.ssl": [
    (p) => `Nous pouvons installer un certificat SSL pour ${site(p)}. Une fois commandé, le cadenas apparaît en moins d'une heure et l'avertissement disparaît.`,
    (p) => `L'avertissement disparaît avec un certificat SSL. Commande-en un pour ${site(p)} et nous l'installons pour toi.`,
    (p) => `${site(p)} a besoin d'un certificat SSL pour afficher le cadenas. Nous le mettons en place dès que tu le commandes.`,
  ],
  "tpl.ssh": [
    (p) => `Ouvre un client SSH comme PuTTYcat et connecte-toi à ${p.hostname || "ton serveur"} en tant que root. Le mot de passe figure dans l'e-mail d'installation envoyé depuis ${p.host}.`,
    (p) => `Tu te connectes en SSH : rends-toi sur ${p.hostname || "ton serveur"} avec l'utilisateur root et le mot de passe de ton e-mail d'installation.`,
    (p) => `Utilise n'importe quel client SSH et connecte-toi à ${p.hostname || "ton serveur"} en tant que root. Si tu as perdu l'e-mail d'installation avec le mot de passe, réponds ici et nous t'en envoyons un nouveau.`,
  ],
  "tpl.addon": [
    (p) => `Oui, il peut partager l'offre. Ajoute le nouveau domaine dans le panneau de contrôle sur panel.${p.host}, sous Domaines, et choisis un dossier pour lui.`,
    (p) => `Pas besoin d'une deuxième offre. Dans le panneau de contrôle sur panel.${p.host}, ajoute le domaine sous Domaines et dirige-le vers son propre dossier.`,
    (p) => `Tu peux faire tourner le nouveau domaine sur le même hébergement. Ouvre Domaines dans le panneau de contrôle sur panel.${p.host}, ajoute-le et choisis un dossier.`,
  ],
  "tpl.php": [
    (p) => `Tu choisis toi-même la version de PHP de ${site(p)} dans le panneau de contrôle sur panel.${p.host}, sous Paramètres PHP. Elle s'applique tout de suite.`,
    (p) => `Ouvre les Paramètres PHP dans le panneau de contrôle sur panel.${p.host} et choisis la version plus récente. ${site(p)} l'utilise immédiatement.`,
    (p) => `Dans le panneau de contrôle sur panel.${p.host}, les Paramètres PHP te permettent de changer de version pour ${site(p)}. Nous recommandons la plus récente que tes extensions prennent en charge.`,
  ],
  offerOnce: [
    (p) => `Nous pouvons mettre ${site(p)} à jour pour toi. C'est une intervention unique à ${euroCents(Number(p.once))}, et tu n'as rien à faire.`,
    (p) => `Le logiciel derrière ${site(p)} n'a pas ses mises à jour de sécurité. Nous les installons pour un forfait unique de ${euroCents(Number(p.once))}.`,
    (p) => `Nous nous occupons volontiers de la mise à jour de ${site(p)}. Le prix unique est de ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `Nous pouvons maintenir ${site(p)} à jour pour toi dès maintenant. Les mises à jour gérées coûtent ${euroCents(Number(p.managed))} par mois, et nous installons chaque correctif de sécurité en moins d'un jour.`,
    (p) => `Avec les mises à jour gérées à ${euroCents(Number(p.managed))} par mois, nous mettons à jour le logiciel derrière ${site(p)} dès qu'un correctif sort, pour que tu n'aies plus à y penser.`,
    (p) => `Nous te proposons de nous occuper des mises à jour de ${site(p)} pour ${euroCents(Number(p.managed))} par mois. Chaque correctif de sécurité est installé en moins d'un jour.`,
  ],
  free: [
    (p) => `Nous avons mis à jour gratuitement le logiciel derrière ${site(p)}. Tout tourne de nouveau sur la dernière version.`,
    (p) => `Ta mise à jour de ${site(p)} est faite, et il n'y a rien à payer. Le site tourne sur la dernière version.`,
    (p) => `Nous nous sommes occupés de la mise à jour de ${site(p)}. C'est gratuit cette fois, et le site est à jour.`,
  ],
  clean: [
    (p) => `Nous avons nettoyé ${site(p)} et restauré ta page d'accueil. Change tes mots de passe et garde le logiciel à jour.`,
    (p) => `${site(p)} est de nouveau propre et affiche ta propre page d'accueil. Mettre le logiciel à jour et changer tes mots de passe te garantira que ça dure.`,
    (p) => `Ton site ${site(p)} est revenu à la normale. Nous avons supprimé les fichiers de l'intrus ; mets le logiciel à jour et choisis de nouveaux mots de passe.`,
  ],
  noBackup: [
    (p) => `Nous n'avons aucune sauvegarde de ${site(p)} à restaurer. Renvoie le site depuis ta propre copie et choisis de nouveaux mots de passe.`,
    (p) => `Malheureusement, nous n'avons pas de sauvegarde de ${site(p)}. Tu devras le restaurer à partir de tes propres fichiers et changer tes mots de passe.`,
    (p) => `Nous ne pouvons pas restaurer ${site(p)} faute de sauvegarde. Reconstruis-le à partir de ta propre copie et garde le logiciel à jour.`,
  ],
  "tpl.explain": [
    () => "Le deuxième paiement correspond à la consommation du mois dernier, que nous facturons à terme échu. Tu n'as pas été débité deux fois.",
    () => "Il y a deux factures parce que la consommation est facturée à la fin de chaque mois pour le mois précédent. Les deux sont correctes, et rien n'a été débité deux fois.",
    () => "Un paiement correspond à la facture en cours, l'autre à la consommation du mois dernier, que nous facturons à terme échu. Ton compte est en ordre.",
  ],
  "tpl.resend": [
    () => "Nous t'avons envoyé une copie de la facture. Dis-nous si elle n'arrive pas.",
    () => "Une copie de la facture est en route vers ton adresse de contact.",
    () => "Bien sûr. Nous t'avons renvoyé la facture par e-mail, elle devrait arriver dans ta boîte d'ici quelques minutes.",
  ],
  "tpl.extension": [
    () => "Pas de problème, tu peux payer la facture deux semaines plus tard cette fois. Tes services restent en ligne.",
    () => "Nous avons repoussé l'échéance de ta facture de deux semaines. Rien d'autre ne change.",
    () => "C'est d'accord. Paie dans les deux semaines suivant la date habituelle, tes services continuent de fonctionner entre-temps.",
  ],
  "tpl.newPrice": [
    (p) => `Nos coûts ont augmenté cette année, et le nouveau prix de ${svc(p)} nous permet de le garder rapide et fiable.`,
    (p) => `Nous comprenons que cette hausse soit mal accueillie. L'électricité et le matériel ont renchéri, et le nouveau prix maintient ${svc(p)} à la qualité que tu connais.`,
    (p) => `Le nouveau prix de ${svc(p)} reflète la hausse des coûts d'électricité et de matériel. Il finance aussi les personnes qui répondent à des e-mails comme celui-ci.`,
  ],
  "tpl.awaitPayment": [
    () => "Merci. Tes services reviennent en ligne dès que le paiement arrive.",
    () => "Merci de nous avoir prévenus. Dès que le paiement nous parvient, tout est automatiquement remis en route.",
    () => "Compris. Tes services reviennent dès que le paiement est enregistré chez nous.",
  ],
  "tpl.offer": [
    (p) => `Nous pouvons donner plus de ressources à ${svc(p)} sans interruption. Les prix figurent dans l'aperçu joint, réponds simplement et nous basculons.`,
    (p) => `Plus de ressources, aucun problème. La mise à niveau prend quelques minutes, ${svc(p)} reste en ligne, et tu trouves les prix en pièce jointe.`,
    (p) => `Merci de grandir avec nous. Nous avons joint les prix des ressources supplémentaires, et nous faisons passer ${svc(p)} à l'offre supérieure le jour même de ta réponse.`,
  ],
  "tpl.warn": [
    (p) => `${svc(p)} émet du trafic abusif que d'autres réseaux nous signalent. Corrige cela sous 24 heures, sinon nous devrons le suspendre.`,
    (p) => `Nous avons reçu des signalements d'abus concernant ${svc(p)}. Sécurise-le sous 24 heures pour éviter une suspension.`,
    (p) => `D'autres fournisseurs signalent des attaques ou du spam provenant de ${svc(p)}. Il est probablement compromis. Nettoie-le sous 24 heures, sinon nous le suspendrons.`,
  ],
  credit: [
    (p) => `Nous sommes désolés pour le désagrément. Nous avons crédité ${euroCents(Number(p.credit))} sur ton compte, ce qui sera déduit de ta prochaine facture.`,
    (p) => `Pour nous excuser, ta prochaine facture est réduite de ${euroCents(Number(p.credit))}. Merci de rester avec nous.`,
    (p) => `Nous avons ajouté un crédit de ${euroCents(Number(p.credit))} sur ton compte. Il sera déduit automatiquement de ta prochaine facture.`,
  ],
  refund: [
    (p) => `Nous avons remboursé un mois, soit ${euroCents(Number(p.refund))}, sur ton compte. Nous sommes désolés que cela soit arrivé.`,
    (p) => `Tu recevras un remboursement de ${euroCents(Number(p.refund))} pour ce mois. Merci d'accepter nos excuses.`,
    (p) => `Nous avons émis le remboursement d'un mois complet, soit ${euroCents(Number(p.refund))}. L'argent arrive sur ton compte en quelques jours.`,
  ],
  refuse: [
    () => "Nous avons examiné ta demande avec attention. L'interruption est couverte par les conditions de ton contrat, nous ne pouvons donc pas proposer de remboursement cette fois.",
    () => "Merci pour ton message. Ton niveau de service couvre ce cas, un remboursement n'est donc pas possible. Nous sommes désolés pour la gêne.",
    () => "Nous comprenons ta frustration, mais nous ne pouvons pas rembourser cette période. Les conditions de ton contrat s'appliquent ici.",
  ],
  revert: [
    (p) => `Nous avons remis le prix de ${svc(p)} à ce que tu payais avant. Le changement s'applique à partir de ta prochaine facture.`,
    (p) => `Tu as raison de poser la question. ${svc(p)} revient à son ancien prix dès la prochaine facture.`,
    (p) => `Nous avons annulé la hausse de prix de ${svc(p)}. Ta prochaine facture affichera de nouveau l'ancien prix.`,
  ],
  "retain.half": [
    () => "Nous serions désolés de te voir partir. Si tu restes, ton prochain mois te coûte moitié moins, avec tout comme aujourd'hui.",
    () => "Avant que tu partes, nous aimerions t'offrir 50 % sur ton prochain mois. Réponds si tu veux rester.",
    () => "Nous tenons à toi comme client. Reste avec nous et nous divisons ton prochain mois par deux.",
  ],
  "retain.free": [
    () => "Nous serions désolés de te voir partir. Si tu restes, ton prochain mois est offert, avec tout comme aujourd'hui.",
    () => "Avant que tu partes, nous aimerions t'offrir un mois gratuit pour nous faire pardonner. Réponds si tu veux rester.",
    () => "Nous tenons à toi comme client. Reste avec nous et le mois prochain ne te coûte rien.",
  ],
  "retain.discount": [
    (p) => `Nous serions désolés de te voir partir. Si tu restes, nous t'accordons 20 % de réduction sur tes services pendant ${p.months} mois.`,
    (p) => `Avant que tu partes, nous aimerions t'offrir 20 % de réduction pendant ${p.months} mois. Réponds si tu veux rester.`,
    (p) => `Nous tenons à toi comme client. Reste avec nous et ton prix baisse d'un cinquième pendant ${p.months} mois.`,
  ],
  "retain.upgrade": [
    () => "Nous serions désolés de te voir partir. Si tu restes, nous faisons passer ton service à la taille supérieure au prix que tu paies aujourd'hui.",
    () => "Avant que tu partes, nous aimerions te donner plus de ressources sans supplément. Réponds si tu veux rester.",
    () => "Nous tenons à toi comme client. Reste avec nous et nous améliorons ton service gratuitement.",
  ],
  "retain.fix": [
    (p) => `Nous sommes désolés pour le désagrément. Nous le corrigerons sous ${p.fixDays} ${plural(p.fixDays, "jour", "jours")} et nous reviendrons vers toi à ce moment-là. Laisse-nous la chance de réparer cela.`,
    (p) => `Accepte nos excuses. Notre équipe s'en occupe, et d'ici ${p.fixDays} ${plural(p.fixDays, "jour", "jours")} ton service fonctionnera comme il le doit.`,
    (p) => `Nous t'avons déçu, et nous en sommes désolés. Donne-nous ${p.fixDays} ${plural(p.fixDays, "jour", "jours")} pour corriger cela avant de te décider.`,
  ],
  "retain.move": [
    () => "Nous sommes désolés pour le désagrément. Si tu restes, nous déplaçons ton service vers un meilleur serveur de notre centre de données et nous nous occupons du déménagement.",
    () => "Avant que tu partes, laisse-nous déplacer ton service vers un meilleur serveur. Nous organisons le déménagement au moment qui te convient.",
    () => "Nous tenons à toi comme client. Reste avec nous et nous déplaçons ton service vers un serveur plus récent sans frais.",
  ],
  cancel: [
    () => "Nous avons traité ta résiliation. Tes services s'arrêtent aujourd'hui et tu recevras une facture finale. Merci d'avoir été hébergé chez nous.",
    () => "Ton contrat est résilié comme demandé. Télécharge tout ce que tu veux garder, les services s'arrêtent aujourd'hui.",
    () => "Nous confirmons la résiliation de tes services. Merci pour le temps passé avec nous, et bonne chance avec ton nouvel hébergeur.",
  ],
  unsuspend: [
    (p) => `Tes services sont de nouveau en ligne. Tu as encore ${p.days} ${plural(p.days, "jour", "jours")} pour régler la facture ouverte.`,
    (p) => `Nous avons tout remis en route et prolongé le délai de paiement de ${p.days} ${plural(p.days, "jour", "jours")}.`,
    (p) => `Tes services fonctionnent de nouveau. Règle la facture dans les ${p.days} ${plural(p.days, "prochain jour", "prochains jours")}.`,
  ],
  keep: [
    () => "Nous comprenons la situation, mais tes services restent suspendus jusqu'au paiement de la facture ouverte. Ils reviennent automatiquement ensuite.",
    () => "Nous sommes désolés, mais nous ne pouvons pas lever la suspension avant l'arrivée du paiement. Dès qu'il arrive, tout revient immédiatement.",
    () => "Tes services restent suspendus pour le moment. Dès que la facture est payée, ils sont remis en route sans autre démarche.",
  ],
  forward: [
    (p) => `Nous vous remercions de votre signalement concernant ${p.url}. Nous l'avons transmis à notre client en lui demandant de répondre.`,
    (p) => `Nous avons transmis votre signalement concernant ${p.url} au client responsable du site.`,
    (p) => `Votre signalement concernant ${p.url} a été transmis à notre client. Pour la suite, veuillez le contacter directement.`,
  ],
  takedown: [
    (p) => `Nous vous remercions de votre signalement. Le contenu à l'adresse ${p.url} a été mis hors ligne pendant ${p.hours} ${plural(p.hours, "heure", "heures")}, le temps que notre client l'examine.`,
    (p) => `Nous avons désactivé l'accès à ${p.url} pendant ${p.hours} ${plural(p.hours, "heure", "heures")} et informé notre client.`,
    (p) => `Le contenu à l'adresse ${p.url} est hors ligne dès maintenant. Notre client dispose de ${p.hours} ${plural(p.hours, "heure", "heures")} pour répondre à votre signalement.`,
  ],
  notOurs: [
    (p) => `Nous vous remercions de votre signalement concernant ${p.url}. Ce site ne se trouve pas sur notre réseau, nous ne pouvons donc pas intervenir. Exécutez « whois ${siteOf(p)} » pour trouver son registrar, puis whois sur l'adresse IP vers laquelle le domaine pointe : le résultat indique l'hébergeur et son contact pour les abus.`,
    (p) => `Nous avons vérifié ${p.url}, et il n'est pas hébergé sur notre réseau. Une recherche whois sur ${siteOf(p)} donne le registrar, et une recherche whois sur l'adresse IP du site donne le réseau qui l'héberge, généralement avec une adresse d'abus à laquelle écrire.`,
    (p) => `Le site à l'adresse ${p.url} n'est pas chez nous. Pour trouver le bon interlocuteur, faites un whois sur ${siteOf(p)} pour le registrar, et un whois sur son adresse IP pour le service des abus de l'hébergeur.`,
  ],
  reject: [
    (p) => `Nous avons examiné votre signalement concernant ${p.url}. Il ne remplit pas les conditions de forme requises, nous n'y donnerons donc pas suite.`,
    (p) => `Nous vous remercions de votre message concernant ${p.url}. Après examen, nous ne voyons aucun motif de retirer le contenu.`,
    (p) => `Nous avons étudié votre signalement concernant ${p.url} et ne pouvons y donner suite en l'état.`,
  ],
  comply: [
    (p) => `Nous accusons réception de votre demande concernant ${p.url}. Nous y donnons suite et fournirons les informations demandées dans le délai indiqué.`,
    (p) => `Votre demande concernant ${p.url} nous est bien parvenue. Nous coopérerons et vous enverrons les informations demandées.`,
    (p) => `Nous donnerons suite à votre demande concernant ${p.url}. Notre équipe prépare les documents demandés.`,
  ],
  object: [
    (p) => `Nous avons reçu votre demande concernant ${p.url}. Nous nous y opposons sous cette forme et exigeons une décision de justice avant de divulguer des données ou de retirer du contenu.`,
    (p) => `Concernant ${p.url}, nous ne pouvons pas donner suite sans décision de justice. Nous répondrons bien sûr rapidement à une telle décision.`,
    (p) => `Nous déclinons respectueusement votre demande concernant ${p.url}. Les données de nos clients ne sont transmises que sur la base d'une décision de justice.`,
  ],
  "decline.notOffered": [
    (p) => `Merci de ton intérêt pour ${hosting(p)}. Malheureusement, nous ne proposons pas ce produit à ${p.city} pour le moment, nous ne pouvons donc pas prendre ta commande.`,
    (p) => `Merci pour ta commande. Nous sommes désolés, mais ${p.line} n'est pas encore disponible à ${p.city}. Nous espérons pouvoir t'aider à l'avenir.`,
    (p) => `Merci d'avoir pensé à nous. ${p.line} ne fait pas partie de notre offre à ${p.city} pour l'instant, nous devons donc refuser cette commande.`,
  ],
  "decline.noCapacity": [
    (p) => `Merci pour ta commande de ${hosting(p)}. Nos serveurs à ${p.city} sont complets pour le moment, nous ne pouvons donc pas le mettre en place pour toi.`,
    (p) => `Nous sommes désolés, mais nous n'avons plus de capacité libre à ${p.city} et ne pouvons pas accepter ta commande. Nous espérons t'accueillir une autre fois.`,
    (p) => `Merci de nous avoir choisis. Malheureusement, ${p.city} est à pleine capacité, et nous préférons refuser plutôt que de mal installer ${p.line}.`,
  ],
  "decline.busy": [
    (p) => `Merci de ton intérêt pour ${hosting(p)}. Nous n'acceptons pas de nouvelles commandes de ce type pour le moment.`,
    () => "Merci pour ta commande. Malheureusement, nous ne pouvons pas la prendre en charge actuellement. Nous te souhaitons plein succès pour ton projet.",
    (p) => `Nous apprécions ta demande pour ${hosting(p)}, mais nous ne pouvons pas l'accepter pour l'instant.`,
  ],
  accept: [
    (p) => `Merci pour ta commande. ${hosting(p)} est installé à ${p.city} et en ligne depuis le ${day(p)}, à ${euroCents(Number(p.price))} par mois. Tes identifiants suivent dans un e-mail séparé.`,
    (p) => `Bienvenue à bord ! Nous avons installé ${hosting(p)} à ${p.city} le ${day(p)}. Le prix mensuel est de ${euroCents(Number(p.price))}, et tes accès sont en route.`,
    (p) => `Ta commande est terminée : ${hosting(p)} tourne à ${p.city} depuis le ${day(p)} pour ${euroCents(Number(p.price))} par mois. Tu recevras bientôt tes identifiants.`,
  ],
  failed: [
    (p) => `Merci pour ta commande. Nous avons essayé de mettre en place ${hosting(p)}, mais cela n'a pas pu aboutir de notre côté. Nous sommes désolés, et nous avons annulé la commande.`,
    (p) => `Nous sommes désolés : l'installation de ${hosting(p)} à ${p.city} a échoué, nous devons donc annuler ta commande. Tu n'as pas été débité.`,
    (p) => `Malheureusement, nous n'avons pas pu installer ${hosting(p)} comme commandé. La commande est annulée et rien ne sera facturé.`,
  ],
  "order.quote": [
    (p) => `Merci pour ta demande concernant ${hosting(p)}. Nous pouvons te le proposer à ${euroCents(Number(p.price))} par mois${setupFee(p)}. Dis-nous si cela te convient.`,
    (p) => `Voici notre offre pour ${hosting(p)} à ${p.city} : ${euroCents(Number(p.price))} par mois${setupFee(p)}. Nous installons tout dès que tu confirmes.`,
    (p) => `Merci de nous avoir contactés. Pour ${hosting(p)}, nous demanderions ${euroCents(Number(p.price))} par mois${setupFee(p)}. Dis-nous si tu veux continuer.`,
  ],
  "order.invoice": [
    (p) => `Nous confirmons ta commande de ${hosting(p)} à ${euroCents(Number(p.price))} par mois. La facture ${p.invoice} de ${euroCents(Number(p.total))} est jointe. Nous installons tout dès qu'elle est payée.`,
    (p) => `Ta commande est confirmée : ${hosting(p)} à ${p.city} pour ${euroCents(Number(p.price))} par mois. Règle la facture ${p.invoice} (${euroCents(Number(p.total))}) et nous nous mettons au travail.`,
    (p) => `Merci, la commande est validée. ${hosting(p)} coûte ${euroCents(Number(p.price))} par mois ; la première facture, ${p.invoice}, s'élève à ${euroCents(Number(p.total))}.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${domainLine(p)} Il est en ligne sur nos serveurs à ${p.city} depuis le ${day(p)}. Connecte-toi sur panel.${p.host} avec l'identifiant ${String(p.domain).split(".")[0]} ; le mot de passe suit dans un e-mail séparé. Envoie ton site en FTP sur ftp.${p.domain}.`
      : `Ton ${p.line} à ${p.city} tourne depuis le ${day(p)}. Connecte-toi en root via SSH ; l'adresse et le mot de passe suivent dans un e-mail séparé.`),
    (p) => (p.domain
      ? `${domainLine(p)} Ton espace web est prêt depuis le ${day(p)}. Le panneau de contrôle est sur panel.${p.host}, et tes boîtes mail sont configurées sur mail.${p.host}.`
      : `${p.line} est en ligne à ${p.city} depuis le ${day(p)}. Ton accès root arrive par e-mail séparé.`),
    (p) => `Tout est installé : ${hosting(p)} tourne à ${p.city} depuis le ${day(p)}.${p.domain ? ` ${domainLine(p)}` : ""} Tes accès suivent dans un e-mail séparé.`,
  ],
};
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.quote", "order.invoice", "order.live"];
const SENDER = ["forward", "takedown", "notOurs", "reject", "comply", "object"];

export default Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)]))) as Dict;
