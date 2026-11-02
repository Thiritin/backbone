import type { Dict } from "../lang";

export default {
  "providers.ironmolehill.navHome": () => `Übersicht`,
  "providers.ironmolehill.navSites": () => `Rechenzentren`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Kundencenter`,
  "providers.ironmolehill.heroEarly": () => `Schützen Sie Ihre Server bei dem Unternehmen, das Ihre Akten schützt`,
  "providers.ironmolehill.heroLate": () => `Rechenzentren, gebaut für Compliance`,
  "providers.ironmolehill.text": (p) => `Sichere Rechenzentren in ${p.cities}, rund um die Uhr mit Wachpersonal, Kameras und geprüfter Zutrittskontrolle.`,
  "providers.ironmolehill.cta": () => `Rechenzentren entdecken`,
  "providers.ironmolehill.pillar1": () => `Sicher`,
  "providers.ironmolehill.pillar1Text": () => `Mehrstufige physische Sicherheit und lückenlose Nachweise für jeden Besuch.`,
  "providers.ironmolehill.pillar2": () => `Konform`,
  "providers.ironmolehill.pillar2Text": () => `Jedes Jahr nach den Standards geprüft, die Ihre Prüfer verlangen.`,
  "providers.ironmolehill.pillar3": () => `Vernetzt`,
  "providers.ironmolehill.pillar3Text": () => `Carrier im Gebäude und Cross-Connects innerhalb weniger Tage.`,
  "providers.ironmolehill.trusted": () => `Geprüft nach`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. Alle Rechte vorbehalten.`,
} satisfies Dict;
