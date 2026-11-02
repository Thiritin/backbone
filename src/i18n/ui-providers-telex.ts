import type { Dict } from "./lang";

// Telex's site copy.

export default {
  "providers.telex.navSites": () => "Facilities",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Where the world's networks meet in Manhattan",
  "providers.telex.heroLate": () => "Interconnection at the heart of New York",
  "providers.telex.text": (p) => `${p.name} in ${p.city} is one of the most connected buildings in the world. Your racks sit one cross-connect away from every major carrier.`,
  "providers.telex.cta": () => "Tour the facility",
  "providers.telex.box1": () => "Meet-me rooms",
  "providers.telex.box1Text": () => "Carriers hand off their networks to each other on our floors.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Cabinets and cages with A and B power next to the carriers.",
  "providers.telex.box3": () => "Cross-connects",
  "providers.telex.box3Text": () => "Order a cross-connect and our technicians patch it for you.",
  "providers.telex.cardText": (p) => `Carrier hotel with ${p.exchange} on site.`,
  "providers.telex.counter": () => "Carriers on site",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
