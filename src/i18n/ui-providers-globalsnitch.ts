import type { Dict } from "./lang";

// Global Snitch's site copy.

export default {
  "providers.globalsnitch.navHome": () => `Home`,
  "providers.globalsnitch.navSites": () => `Our data centres`,
  "providers.globalsnitch.navColo": () => `Space and power`,
  "providers.globalsnitch.navPortal": () => `Customer login`,
  "providers.globalsnitch.heroEarly": () => `Carrier-neutral data centres in Tier 1 cities`,
  "providers.globalsnitch.heroLate": () => `Large-scale data centres in the world's leading cities`,
  "providers.globalsnitch.text": (p) => `Global Snitch owns and operates large-scale, multi-tenant data centres in ${p.cities}, each with resilient power and connectivity from many carriers.`,
  "providers.globalsnitch.cta": () => `View our data centres`,
  "providers.globalsnitch.owner": () => `Owner and operator`,
  "providers.globalsnitch.ownerText": () => `We own every building we run, so customers deal with one landlord for space, power and connectivity.`,
  "providers.globalsnitch.statCarriers": () => `Carrier connections`,
  "providers.globalsnitch.statPower": () => `Power per rack`,
  "providers.globalsnitch.statHands": () => `Remote hands response`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
