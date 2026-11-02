import type { Dict } from "../lang";

export default {
  "providers.corespite.navSites": () => "Rechenzentren",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Netzdichte Colocation in den Märkten, auf die es ankommt",
  "providers.corespite.heroLate": () => "Wo die Cloud auf das Netz trifft",
  "providers.corespite.text": (p) => `${p.n} Rechenzentren in ${p.cities}, jedes mit Carriern und einem Exchange im Gebäude.`,
  "providers.corespite.cta": () => "Angebot einholen",
  "providers.corespite.markets": () => "Märkte",
  "providers.corespite.marketFacts": (p) => `${p.carriers} Carrier, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Verbinden Sie Ihre Racks über einen Port mit Cloud-Anbietern und Carriern in allen CoreSpite-Märkten.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
