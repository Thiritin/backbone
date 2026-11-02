import type { Dict } from "../lang";

export default {
  "providers.greenchz.navHome": () => "Home",
  "providers.greenchz.navSites": () => "Rechenzentren",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Kundencenter",
  "providers.greenchz.heroEarly": () => "Housing und Colocation in der Schweiz",
  "providers.greenchz.heroLate": () => "Schweizer Rechenzentren für Daten, die in der Schweiz bleiben.",
  "providers.greenchz.text": (p) => `Unser Rechenzentrum bei ${p.city} speichert Ihre Daten nach Schweizer Recht, auf zertifizierter Infrastruktur mit erneuerbarem Strom.`,
  "providers.greenchz.cta": () => "Offerte anfordern",
  "providers.greenchz.point1": () => "Schweizer Qualität",
  "providers.greenchz.point1Text": () => "Wir bauen und betreiben jeden Standort selbst und halten Ihre Daten im Land.",
  "providers.greenchz.point2": () => "Zertifizierte Sicherheit",
  "providers.greenchz.point2Text": () => "Zutrittskontrolle, redundante Stromversorgung und Audits folgen anerkannten Standards.",
  "providers.greenchz.point3": () => "Erneuerbarer Strom",
  "providers.greenchz.point3Text": () => "Unsere Rechenzentren laufen mit Strom aus Schweizer Wasserkraft.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
