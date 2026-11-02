import type { Dict } from "../lang";

export default {
  "providers.hetzler.overview": () => "Übersicht",
  "providers.hetzler.robot": () => "Rowbot-Login",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation in unseren eigenen Rechenzentren",
  "providers.hetzler.textEarly": (p) => `Bringen Sie Ihre eigenen Server nach ${p.cities}. Rackplatz mit Strom und Traffic gibt es ab ${p.price} im Monat.`,
  "providers.hetzler.vat": () => "Alle Preise sind Monatspreise inklusive Mehrwertsteuer. Rechnungen werden am Monatsersten per Lastschrift eingezogen.",
  "providers.hetzler.heroLate": () => "Ihre Hardware in unseren Rechenzentren",
  "providers.hetzler.textLate": (p) => `Rackplatz in ${p.cities} mit Strom, Kühlung und redundanter Anbindung.`,
  "providers.hetzler.from": (p) => `ab ${p.price} im Monat`,
  "providers.hetzler.orderNow": () => "Jetzt bestellen",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
