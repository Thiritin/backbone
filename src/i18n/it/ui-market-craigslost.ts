import type { Dict } from "../lang";

export default {
  "cl.forSale": () => "in vendita",
  "cl.all": () => "componenti pc",
  "cl.max": () => "Prezzo massimo",
  "cl.sort": () => "Ordina",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "annuncio" : "annunci"}`,
  "cl.posted": (p) => `Pubblicato: ${p.date}`,
  "cl.notFound": () => "Questo annuncio è stato eliminato.",
} satisfies Dict;
