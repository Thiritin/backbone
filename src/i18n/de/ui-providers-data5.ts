import type { Dict } from "../lang";

export default {
  "providers.data5.navHome": () => "Die Gruppe",
  "providers.data5.navSites": () => "Unsere Campusse",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Kundenbereich",
  "providers.data5.quote": () => "Angebot anfordern",
  "providers.data5.heroEarly": () => "Europäische Rechenzentrums-Campusse für Ihre kritische Infrastruktur",
  "providers.data5.heroLate": () => "Rechenzentren für Jahrzehnte, für die Daten, die Europa antreiben",
  "providers.data5.text": (p) => `Wir planen, bauen und betreiben ${p.n} Rechenzentrums-Campusse in ${p.cities}, mit Strom und Anbindung für Jahrzehnte des Wachstums.`,
  "providers.data5.cta": () => "Campusse entdecken",
  "providers.data5.figSites": () => "Campusse",
  "providers.data5.figCarriers": () => "Carrier vor Ort",
  "providers.data5.figCities": () => "Städte",
  "providers.data5.campuses": () => "Unsere Campusse",
  "providers.data5.carriers": (p) => `${p.n} Carrier`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
