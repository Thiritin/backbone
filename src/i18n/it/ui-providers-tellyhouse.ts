import type { Dict } from "../lang";

export default {
  "providers.tellyhouse.navSites": () => `Data center`,
  "providers.tellyhouse.navColo": () => `Servizi di colocation`,
  "providers.tellyhouse.navPortal": () => `Portale clienti`,
  "providers.tellyhouse.tagline": () => `La casa della colocation carrier-neutral dal 1990`,
  "providers.tellyhouse.welcome": () => `Benvenuti in Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `I nostri ${p.n} data center a ${p.cities} ospitano ${p.carriers} connessioni carrier e gli Internet exchange che vi si incontrano.`,
  "providers.tellyhouse.campuses": () => `I nostri campus`,
  "providers.tellyhouse.quick": () => `Link rapidi`,
  "providers.tellyhouse.contactBox": () => `Richieste commerciali`,
  "providers.tellyhouse.contactText": () => `Il nostro team commerciale risponde a ogni richiesta entro un giorno lavorativo.`,
  "providers.tellyhouse.heroLate": () => `Dove si incontrano le reti d'Europa`,
  "providers.tellyhouse.cta": () => `Richiedi ora`,
  "providers.tellyhouse.statCarriers": () => `Connessioni carrier`,
  "providers.tellyhouse.statExchanges": () => `Internet exchange`,
  "providers.tellyhouse.view": () => `Vedi data center`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
