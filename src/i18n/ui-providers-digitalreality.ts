import type { Dict } from "./lang";

// Digital Reality's site copy.

export default {
  "providers.digitalreality.navSites": () => "Locations",
  "providers.digitalreality.navOrder": () => "Colocation",
  "providers.digitalreality.navPortal": () => "Customer Portal",
  "providers.digitalreality.investors": () => "Investors",
  "providers.digitalreality.careers": () => "Careers",
  "providers.digitalreality.ticker": () => "NYSE: DRLT",
  "providers.digitalreality.heroEarly": () => "Turn-Key Reality solutions for the enterprise",
  "providers.digitalreality.heroLate": () => "The platform where data lives",
  "providers.digitalreality.text": (p) => `Purpose-built data center space in ${p.cities} metros, owned and operated by a real estate investment trust.`,
  "providers.digitalreality.cta": () => "Explore locations",
  "providers.digitalreality.statSites": () => "Data centers",
  "providers.digitalreality.statMetros": () => "Metros",
  "providers.digitalreality.statCarriers": () => "Carrier connections",
  "providers.digitalreality.solutions": () => "Solutions",
  "providers.digitalreality.sol1": () => "Turn-Key Reality",
  "providers.digitalreality.sol1Text": () => "Move into finished, powered and cooled space on a long lease.",
  "providers.digitalreality.sol2": () => "Colocation",
  "providers.digitalreality.sol2Text": () => "Rent racks and cages by the month in a shared hall.",
  "providers.digitalreality.sol3": () => "Interconnection",
  "providers.digitalreality.sol3Text": () => "Reach carriers and exchanges in the building with a cross-connect.",
  "providers.digitalreality.markets": () => "Markets",
  "providers.digitalreality.footer": (p) => `© ${p.year} Digital Reality Trust, Inc.`,
} satisfies Dict;
