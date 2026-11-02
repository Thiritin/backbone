import type { Dict } from "../lang";

export default {
  "providers.globalsnitch.navHome": () => `Startseite`,
  "providers.globalsnitch.navSites": () => `Unsere Rechenzentren`,
  "providers.globalsnitch.navColo": () => `Fläche und Strom`,
  "providers.globalsnitch.navPortal": () => `Kundenlogin`,
  "providers.globalsnitch.heroEarly": () => `Carrierneutrale Rechenzentren in Tier-1-Städten`,
  "providers.globalsnitch.heroLate": () => `Großflächige Rechenzentren in den führenden Städten der Welt`,
  "providers.globalsnitch.text": (p) => `Global Snitch besitzt und betreibt großflächige Rechenzentren für viele Mieter in ${p.cities}, jedes mit ausfallsicherer Stromversorgung und Anbindung an viele Carrier.`,
  "providers.globalsnitch.cta": () => `Unsere Rechenzentren ansehen`,
  "providers.globalsnitch.owner": () => `Eigentümer und Betreiber`,
  "providers.globalsnitch.ownerText": () => `Uns gehört jedes Gebäude, das wir betreiben, und Kunden haben für Fläche, Strom und Anbindung einen einzigen Vermieter.`,
  "providers.globalsnitch.statCarriers": () => `Carrier-Anbindungen`,
  "providers.globalsnitch.statPower": () => `Strom pro Rack`,
  "providers.globalsnitch.statHands": () => `Reaktionszeit Remote Hands`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
