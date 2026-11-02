import type { Dict } from "./lang";

// Docklands Data's site copy.

export default {
  "providers.docklands.navSites": () => `Our facility`,
  "providers.docklands.navColo": () => `Prices`,
  "providers.docklands.navPortal": () => `Client area`,
  "providers.docklands.call": (p) => `Call us on ${p.phone}`,
  "providers.docklands.why": () => `Why Docklands Data?`,
  "providers.docklands.why1": () => `Independent and owner-managed`,
  "providers.docklands.why2": () => `Our own engineers in East London`,
  "providers.docklands.why3": () => `Clear monthly prices`,
  "providers.docklands.why4": () => `Space from a few units to a full rack`,
  "providers.docklands.heroEarly": () => `Colocation in London Docklands`,
  "providers.docklands.heroLate": () => `Friendly colocation in the heart of London`,
  "providers.docklands.text": (p) => `Secure rack space for small businesses close to the City, from ${p.price} a month.`,
  "providers.docklands.quote": () => `Get a quote`,
  "providers.docklands.quoteText": () => `The team moved our servers in on a Saturday and had us back online by lunch.`,
  "providers.docklands.quoteBy": () => `Managing director of a design studio in Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Registered in England and Wales.`,
} satisfies Dict;
