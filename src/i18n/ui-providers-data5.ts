import type { Dict } from "./lang";

// Data5's site copy.

export default {
  "providers.data5.navHome": () => "The group",
  "providers.data5.navSites": () => "Our campuses",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Customer area",
  "providers.data5.quote": () => "Get a quote",
  "providers.data5.heroEarly": () => "European data centre campuses for your critical infrastructure",
  "providers.data5.heroLate": () => "Data centres built to last, for the data that drives Europe",
  "providers.data5.text": (p) => `We design, build and run ${p.n} data centre campuses in ${p.cities}, with power and connectivity sized for decades of growth.`,
  "providers.data5.cta": () => "Discover our campuses",
  "providers.data5.figSites": () => "Campuses",
  "providers.data5.figCarriers": () => "Carriers on site",
  "providers.data5.figCities": () => "Cities",
  "providers.data5.campuses": () => "Our campuses",
  "providers.data5.carriers": (p) => `${p.n} carriers`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
