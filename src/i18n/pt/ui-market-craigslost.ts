import type { Dict } from "../lang";

export default {
  "cl.forSale": () => "à venda",
  "cl.all": () => "peças de computador",
  "cl.max": () => "Preço máximo",
  "cl.sort": () => "Ordenar",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "anúncio" : "anúncios"}`,
  "cl.posted": (p) => `Publicado: ${p.date}`,
  "cl.notFound": () => "Este anúncio foi removido.",
} satisfies Dict;
