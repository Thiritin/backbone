import type { Dict } from "./lang";

// Interaction's site copy.

export default {
  "providers.interaction.navSites": () => `Data centres`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Customer portal`,
  "providers.interaction.heroEarly": () => `Europe's leading provider of carrier-neutral colocation`,
  "providers.interaction.heroLate": () => `Connected communities`,
  "providers.interaction.text": (p) => `${p.n} carrier-neutral data centres in ${p.cities} European cities, home to the communities that keep the Internet running.`,
  "providers.interaction.cta": () => `Find a data centre`,
  "providers.interaction.communities": () => `Communities`,
  "providers.interaction.com1": () => `Carriers and ISPs`,
  "providers.interaction.com2": () => `Cloud and hosting`,
  "providers.interaction.com3": () => `Digital media`,
  "providers.interaction.com4": () => `Finance`,
  "providers.interaction.statSites": () => `Data centres`,
  "providers.interaction.statCities": () => `Cities`,
  "providers.interaction.statCarriers": () => `Carrier connections`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. All rights reserved.`,
} satisfies Dict;
