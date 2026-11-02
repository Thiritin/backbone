import type { Dict } from "../lang";

export default {
  "providers.telex.navSites": () => "Standorte",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Wo sich die Netze der Welt in Manhattan treffen",
  "providers.telex.heroLate": () => "Interconnection im Herzen von New York",
  "providers.telex.text": (p) => `${p.name} in ${p.city} ist eines der am besten angebundenen Gebäude der Welt. Ihre Racks sind nur einen Cross-Connect von jedem großen Carrier entfernt.`,
  "providers.telex.cta": () => "Standort besichtigen",
  "providers.telex.box1": () => "Meet-Me-Räume",
  "providers.telex.box1Text": () => "Carrier übergeben ihre Netze auf unseren Etagen aneinander.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Schränke und Cages mit A- und B-Strom direkt neben den Carriern.",
  "providers.telex.box3": () => "Cross-Connects",
  "providers.telex.box3Text": () => "Bestellen Sie einen Cross-Connect, und unsere Techniker patchen ihn für Sie.",
  "providers.telex.cardText": (p) => `Carrier-Hotel mit ${p.exchange} vor Ort.`,
  "providers.telex.counter": () => "Carrier vor Ort",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
