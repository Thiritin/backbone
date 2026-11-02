import type { Dict } from "../lang";

export default {
  "cl.forSale": () => "en venta",
  "cl.all": () => "piezas de ordenador",
  "cl.max": () => "Precio máximo",
  "cl.sort": () => "Ordenar",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "anuncio" : "anuncios"}`,
  "cl.posted": (p) => `Publicado: ${p.date}`,
  "cl.notFound": () => "Este anuncio se ha eliminado.",
} satisfies Dict;
