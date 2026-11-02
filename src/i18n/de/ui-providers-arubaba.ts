import type { Dict } from "../lang";

export default {
  "providers.arubaba.navHome": () => "Startseite",
  "providers.arubaba.navSites": () => "Rechenzentrum",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Kundenbereich",
  "providers.arubaba.heroEarly": () => "Colocation in unserem italienischen Rechenzentrum",
  "providers.arubaba.heroLate": () => "Ihre Server im Arubaba-Rechenzentrum",
  "providers.arubaba.text": (p) => `Bringen Sie Ihre Server nach ${p.name} in ${p.city}: ein zertifiziertes Rechenzentrum mit redundanter Stromversorgung, Löschanlage und Personal rund um die Uhr.`,
  "providers.arubaba.discover": () => "Rechenzentrum entdecken",
  "providers.arubaba.from": (p) => `ab ${p.price}`,
  "providers.arubaba.perMonth": () => "pro Monat zzgl. MwSt.",
  "providers.arubaba.buy": () => "Kaufen",
  "providers.arubaba.vat": () => "Alle Preise verstehen sich zuzüglich MwSt.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
