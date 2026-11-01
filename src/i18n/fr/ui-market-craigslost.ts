import type { Dict } from "../lang";

export default {
  "cl.forSale": () => "à vendre",
  "cl.all": () => "pièces informatiques",
  "cl.max": () => "Prix max.",
  "cl.sort": () => "Trier",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "annonce" : "annonces"}`,
  "cl.posted": (p) => `Publiée : ${p.date}`,
  "cl.notFound": () => "Cette annonce a été supprimée.",
} satisfies Dict;
