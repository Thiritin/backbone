import type { Dict } from "../lang";

export default {
  "providers.corespite.navSites": () => "Data centers",
  "providers.corespite.navOrder": () => "Colocation",
  "providers.corespite.navPortal": () => "myCoreSpite",
  "providers.corespite.heroEarly": () => "Colocation rica em redes nos mercados que importam",
  "providers.corespite.heroLate": () => "Onde a cloud encontra a rede",
  "providers.corespite.text": (p) => `${p.n} data centers em ${p.cities}, cada um com operadoras e um ponto de troca no edifício.`,
  "providers.corespite.cta": () => "Pedir orçamento",
  "providers.corespite.markets": () => "Mercados",
  "providers.corespite.marketFacts": (p) => `${p.carriers} operadoras, ${p.exchange}`,
  "providers.corespite.cloud": () => "Open Cloud Swap",
  "providers.corespite.cloudText": () => "Ligue os seus racks a fornecedores de cloud e operadoras em todos os mercados CoreSpite a partir de uma única porta.",
  "providers.corespite.footer": (p) => `© ${p.year} CoreSpite Realty Corporation`,
} satisfies Dict;
