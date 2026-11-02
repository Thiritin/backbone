import type { Dict } from "../lang";

export default {
  "apps.about.Pear Mail": () => "Lit et envoie le courrier de tous les comptes que vous ajoutez.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Bienvenue dans Pear Mail",
  "pearMail.welcome.add": () => "Ajouter votre premier compte",
  "pearMail.activity.checked": (p) => `Courrier relevé pour ${p.account} : ${p.count} nouveaux`,
  "core.notify.newMail": () => "Nouveaux messages",
  "event.newMail.title": () => "Nouveau message",
  "event.newMail.text": (p) => `Un nouveau message est arrivé dans ${p.account}.`,
  "event.newMailMore.title": () => "Nouveaux messages",
  "event.newMailMore.text": (p) => `${p.count} autres nouveaux messages sont arrivés dans ${p.account}.`,
  "error.mailNoBox": () => "Aucune boîte aux lettres ne porte cette adresse sur le serveur.",
  "error.mailAuth": () => "Le serveur a refusé le mot de passe.",
  "error.mailExternal": () => "Le serveur n'autorise pas ce programme de messagerie à se connecter.",
  "error.mailDown": () => "Le serveur de messagerie ne répond pas.",
  "error.mailDns": () => "Le courrier du domaine n'atteint pas ce serveur.",
  "error.mailClosed": () => "Cette boîte aux lettres a été fermée.",
  "error.mailPoll": () => "Le serveur a refusé un relevé si peu de temps après le précédent.",
} satisfies Dict;
