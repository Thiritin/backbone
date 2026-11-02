import type { Dict } from "../lang";

export default {
  "providers.corespite.navSites": () => "Centros de datos",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Colocation con alta densidad de redes en los mercados que importan",
  "providers.corespite.heroLate": () => "Donde la nube se encuentra con la red",
  "providers.corespite.text": (p) => `${p.n} centros de datos en ${p.cities}, cada uno con operadores y un punto neutro en el edificio.`,
  "providers.corespite.cta": () => "Pedir presupuesto",
  "providers.corespite.markets": () => "Mercados",
  "providers.corespite.marketFacts": (p) => `${p.carriers} operadores, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Conecte sus racks con proveedores de nube y operadores de todos los mercados de CoreSpite desde un solo puerto.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
