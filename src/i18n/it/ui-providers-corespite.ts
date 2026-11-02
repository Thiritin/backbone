import type { Dict } from "../lang";

export default {
  "providers.corespite.navSites": () => "Data center",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Colocation ricca di reti nei mercati che contano",
  "providers.corespite.heroLate": () => "Dove il cloud incontra la rete",
  "providers.corespite.text": (p) => `${p.n} data center a ${p.cities}, ognuno con operatori e un punto di interscambio nell'edificio.`,
  "providers.corespite.cta": () => "Richiedi un preventivo",
  "providers.corespite.markets": () => "Mercati",
  "providers.corespite.marketFacts": (p) => `${p.carriers} operatori, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Collegate i vostri rack a provider cloud e operatori in tutti i mercati CoreSpite da un'unica porta.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
