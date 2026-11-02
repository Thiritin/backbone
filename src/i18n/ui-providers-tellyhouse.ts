import type { Dict } from "./lang";

// Tellyhouse's site copy.

export default {
  "providers.tellyhouse.navSites": () => `Data centres`,
  "providers.tellyhouse.navColo": () => `Colocation services`,
  "providers.tellyhouse.navPortal": () => `Customer portal`,
  "providers.tellyhouse.tagline": () => `The home of carrier-neutral colocation since 1990`,
  "providers.tellyhouse.welcome": () => `Welcome to Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `Our ${p.n} data centres in ${p.cities} host ${p.carriers} carrier connections and the Internet exchanges that meet inside them.`,
  "providers.tellyhouse.campuses": () => `Our campuses`,
  "providers.tellyhouse.quick": () => `Quick links`,
  "providers.tellyhouse.contactBox": () => `Sales enquiries`,
  "providers.tellyhouse.contactText": () => `Our sales team answers every enquiry within one working day.`,
  "providers.tellyhouse.heroLate": () => `Where the networks of Europe meet`,
  "providers.tellyhouse.cta": () => `Enquire now`,
  "providers.tellyhouse.statCarriers": () => `Carrier connections`,
  "providers.tellyhouse.statExchanges": () => `Internet exchanges`,
  "providers.tellyhouse.view": () => `View data centre`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
