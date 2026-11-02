import type { Dict } from "../lang";

export default {
  "providers.interaction.navSites": () => `Data center`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Portale clienti`,
  "providers.interaction.heroEarly": () => `Il fornitore leader in Europa di colocation carrier-neutral`,
  "providers.interaction.heroLate": () => `Community connesse`,
  "providers.interaction.text": (p) => `${p.n} data center carrier-neutral in ${p.cities} città europee, casa delle community che fanno funzionare Internet.`,
  "providers.interaction.cta": () => `Trova un data center`,
  "providers.interaction.communities": () => `Community`,
  "providers.interaction.com1": () => `Operatori e ISP`,
  "providers.interaction.com2": () => `Cloud e hosting`,
  "providers.interaction.com3": () => `Media digitali`,
  "providers.interaction.com4": () => `Finanza`,
  "providers.interaction.statSites": () => `Data center`,
  "providers.interaction.statCities": () => `Città`,
  "providers.interaction.statCarriers": () => `Connessioni carrier`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. Tutti i diritti riservati.`,
} satisfies Dict;
