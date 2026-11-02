import type { Dict } from "../lang";

export default {
  "mailswitch.title": () => "Encore chez ce fournisseur",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 message n’a pas été importé chez le nouveau fournisseur." : `${p.n} messages n’ont pas été importés chez le nouveau fournisseur.`),
  "mailswitch.roles": () => "Une boîte ici est encore la boîte principale ou reçoit le courrier des ventes, du support ou des abus.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 boîte relève encore le courrier ici." : `${p.n} boîtes relèvent encore le courrier ici.`),
  "mailswitch.source": () => "Ancienne adresse",
  "mailswitch.password": () => "Mot de passe",
  "mailswitch.target": () => "Dans la boîte",
  "mailswitch.start": () => "Lancer l’importation",
  "mailswitch.from": () => "De",
  "mailswitch.to": () => "Vers",
  "mailswitch.status": () => "État",
  "mailswitch.running": (p) => `En cours jusqu’au ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 message importé" : `${p.n} messages importés`),
} satisfies Dict;
