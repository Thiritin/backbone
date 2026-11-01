import type { Dict } from "../lang";

export default {
  "tg.wts": () => "VDS",
  "tg.topic": (p) => `Offres : ${p.n}`,
  "tg.talking": (p) => `Vous parlez maintenant dans ${p.channel}`,
  "tg.users": (p) => `${p.n} ${Number(p.n) === 1 ? "utilisateur" : "utilisateurs"}`,
  "tg.send": () => "Envoyer",
  "tg.notFound": () => "Message introuvable",
  "tg.max": () => "Prix max.",
  "tg.sort": () => "Trier",
  "tg.cmdSearch": () => "/cherche",
  "tg.cmdMax": () => "/max",
} satisfies Dict;
