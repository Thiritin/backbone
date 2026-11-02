import type { Dict } from "../lang";

export default {
  "providers.globalsnitch.navHome": () => `Home`,
  "providers.globalsnitch.navSites": () => `I nostri data center`,
  "providers.globalsnitch.navColo": () => `Spazio ed energia`,
  "providers.globalsnitch.navPortal": () => `Area clienti`,
  "providers.globalsnitch.heroEarly": () => `Data center carrier-neutral nelle città Tier 1`,
  "providers.globalsnitch.heroLate": () => `Grandi data center nelle principali città del mondo`,
  "providers.globalsnitch.text": (p) => `Global Snitch possiede e gestisce grandi data center multi-tenant a ${p.cities}, ciascuno con alimentazione ridondata e connessione a molti operatori.`,
  "providers.globalsnitch.cta": () => `Scopri i nostri data center`,
  "providers.globalsnitch.owner": () => `Proprietario e gestore`,
  "providers.globalsnitch.ownerText": () => `Possediamo ogni edificio che gestiamo, così i clienti hanno un solo locatore per spazio, energia e connettività.`,
  "providers.globalsnitch.statCarriers": () => `Connessioni carrier`,
  "providers.globalsnitch.statPower": () => `Potenza per rack`,
  "providers.globalsnitch.statHands": () => `Risposta remote hands`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
