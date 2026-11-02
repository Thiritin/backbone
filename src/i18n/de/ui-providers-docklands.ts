import type { Dict } from "../lang";

export default {
  "providers.docklands.navSites": () => `Unser Rechenzentrum`,
  "providers.docklands.navColo": () => `Preise`,
  "providers.docklands.navPortal": () => `Kundenbereich`,
  "providers.docklands.call": (p) => `Rufen Sie uns an: ${p.phone}`,
  "providers.docklands.why": () => `Warum Docklands Data?`,
  "providers.docklands.why1": () => `Unabhängig und inhabergeführt`,
  "providers.docklands.why2": () => `Eigene Techniker in East London`,
  "providers.docklands.why3": () => `Klare Monatspreise`,
  "providers.docklands.why4": () => `Platz von wenigen Höheneinheiten bis zum ganzen Rack`,
  "providers.docklands.heroEarly": () => `Colocation in den Londoner Docklands`,
  "providers.docklands.heroLate": () => `Freundliche Colocation im Herzen Londons`,
  "providers.docklands.text": (p) => `Sichere Rackfläche für kleine Firmen nahe der City, ab ${p.price} im Monat.`,
  "providers.docklands.quote": () => `Angebot anfordern`,
  "providers.docklands.quoteText": () => `Das Team hat unsere Server an einem Samstag eingebaut, und mittags waren wir wieder online.`,
  "providers.docklands.quoteBy": () => `Geschäftsführer eines Designstudios in Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Eingetragen in England und Wales.`,
} satisfies Dict;
