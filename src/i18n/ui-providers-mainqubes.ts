import type { Dict } from "./lang";

// mainqubes's site copy.

export default {
  "providers.mainqubes.navHome": () => `Home`,
  "providers.mainqubes.navSites": () => `Data center`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Customer login`,
  "providers.mainqubes.heroEarly": (p) => `Your data center in ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `Rack space from a few height units to a private suite, from ${p.price} a month, with ${p.carriers} carriers in the building and our own technicians on site.`,
  "providers.mainqubes.heroLate": () => `Secure colocation`,
  "providers.mainqubes.textLate": (p) => `High-security data center space in ${p.cities}, certified, carrier-neutral and connected to ${p.carriers} carriers.`,
  "providers.mainqubes.cta": () => `Request an offer`,
  "providers.mainqubes.more": () => `Details`,
  "providers.mainqubes.from": (p) => `from ${p.price} / month`,
  "providers.mainqubes.certified": () => `Certified`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
