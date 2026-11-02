import type { Dict } from "./lang";

// CoreSpite's site copy.

export default {
  "providers.corespite.navSites": () => "Data Centers",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Network-dense colocation in the markets that matter",
  "providers.corespite.heroLate": () => "Where the cloud meets the network",
  "providers.corespite.text": (p) => `${p.n} data centers in ${p.cities}, each with carriers and an exchange in the building.`,
  "providers.corespite.cta": () => "Get a quote",
  "providers.corespite.markets": () => "Markets",
  "providers.corespite.marketFacts": (p) => `${p.carriers} carriers, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Connect your racks to cloud providers and carriers across every CoreSpite market from one port.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
