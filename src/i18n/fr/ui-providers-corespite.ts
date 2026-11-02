import type { Dict } from "../lang";

export default {
  "providers.corespite.navSites": () => "Datacenters",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Une colocation riche en réseaux sur les marchés qui comptent",
  "providers.corespite.heroLate": () => "Là où le cloud rencontre le réseau",
  "providers.corespite.text": (p) => `${p.n} datacenters à ${p.cities}, chacun avec des opérateurs et un point d'échange dans le bâtiment.`,
  "providers.corespite.cta": () => "Obtenir un devis",
  "providers.corespite.markets": () => "Marchés",
  "providers.corespite.marketFacts": (p) => `${p.carriers} opérateurs, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Reliez vos baies aux fournisseurs cloud et aux opérateurs de tous les marchés CoreSpite depuis un seul port.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
