import type { Dict } from "../lang";

export default {
  "providers.myloch.navHome": () => "Startseite",
  "providers.myloch.navSites": () => "Rechenzentrum",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Kundencenter",
  "providers.myloch.claim": () => "Hosting aus Düsseldorf",
  "providers.myloch.heroEarly": () => "Colocation zu fairen Preisen",
  "providers.myloch.heroLate": () => "Ihre Server in unserem Rechenzentrum in Düsseldorf",
  "providers.myloch.text": (p) => `Stellen Sie Ihre eigene Hardware in ${p.name} in ${p.city} unter, mit Strom, Netz und Support inklusive.`,
  "providers.myloch.from": (p) => `Ab ${p.price} im Monat`,
  "providers.myloch.units": (p) => `${p.n} Höheneinheiten`,
  "providers.myloch.power": (p) => `${p.kw} kW Strom`,
  "providers.myloch.hands": (p) => `Remote Hands innerhalb von ${p.hours} Stunden`,
  "providers.myloch.perMonth": (p) => `${p.price} / Monat`,
  "providers.myloch.order": () => "Jetzt bestellen",
  "providers.myloch.vat": () => "Alle Preise sind Monatspreise zuzüglich MwSt.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
