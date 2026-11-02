import type { Dict } from "../lang";

export default {
  "providers.spree.navHome": () => "Start",
  "providers.spree.navSites": () => "Rechenzentrum",
  "providers.spree.navOrder": () => "Preise und Bestellung",
  "providers.spree.navAccount": () => "Kundenlogin",
  "providers.spree.tagline": (p) => `Colocation aus ${p.city}`,
  "providers.spree.news": () => "Aktuelles",
  "providers.spree.news1": () => "Unsere zweite USV ist eingebaut und in Betrieb.",
  "providers.spree.news2": () => "Wir vermieten jetzt auch einzelne Höheneinheiten.",
  "providers.spree.heroEarly": () => "Willkommen bei Spree Colo",
  "providers.spree.textEarly": () => "Wir betreiben ein kleines Rechenzentrum an der Spree und vermieten Rackplatz an Firmen, Entwickler und alle, die einen Server online bringen wollen. Sie sprechen direkt mit den Technikern, die Ihr Rack betreuen.",
  "providers.spree.from": (p) => `Rackplatz ab ${p.price} im Monat`,
  "providers.spree.heroLate": (p) => `Ihr Rack in ${p.city}`,
  "providers.spree.textLate": () => "Wir sind ein unabhängiger Colocation-Anbieter mit eigenem Rechenzentrum, kurzen Wegen und Technikern, die Sie beim Namen kennen.",
  "providers.spree.feat1": () => "Unabhängig",
  "providers.spree.feat1Text": () => "Wir gehören zu keinem Konzern, deshalb wird im selben Gebäude entschieden, in dem Ihr Server läuft.",
  "providers.spree.feat2": () => "Persönlich",
  "providers.spree.feat2Text": () => "Wenn Sie anrufen, erreichen Sie die Techniker, die Ihr Rack eingebaut haben.",
  "providers.spree.feat3": () => "Faire Preise",
  "providers.spree.feat3Text": () => "Alle Preise stehen auf der Website, und Sie unterschreiben monatlich kündbar.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
