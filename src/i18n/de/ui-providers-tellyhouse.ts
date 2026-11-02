import type { Dict } from "../lang";

export default {
  "providers.tellyhouse.navSites": () => `Rechenzentren`,
  "providers.tellyhouse.navColo": () => `Colocation-Leistungen`,
  "providers.tellyhouse.navPortal": () => `Kundenportal`,
  "providers.tellyhouse.tagline": () => `Die Heimat carrierneutraler Colocation seit 1990`,
  "providers.tellyhouse.welcome": () => `Willkommen bei Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `Unsere ${p.n} Rechenzentren in ${p.cities} beherbergen ${p.carriers} Carrier-Anbindungen und die Internetknoten, die sich darin treffen.`,
  "providers.tellyhouse.campuses": () => `Unsere Standorte`,
  "providers.tellyhouse.quick": () => `Schnellzugriff`,
  "providers.tellyhouse.contactBox": () => `Vertriebsanfragen`,
  "providers.tellyhouse.contactText": () => `Unser Vertrieb beantwortet jede Anfrage innerhalb eines Werktags.`,
  "providers.tellyhouse.heroLate": () => `Wo sich die Netze Europas treffen`,
  "providers.tellyhouse.cta": () => `Jetzt anfragen`,
  "providers.tellyhouse.statCarriers": () => `Carrier-Anbindungen`,
  "providers.tellyhouse.statExchanges": () => `Internetknoten`,
  "providers.tellyhouse.view": () => `Rechenzentrum ansehen`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
