import type { Dict } from "../lang";

export default {
  "providers.ironmolehill.navHome": () => `Panoramica`,
  "providers.ironmolehill.navSites": () => `Data center`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Centro account`,
  "providers.ironmolehill.heroEarly": () => `Proteggete i vostri server con l'azienda che protegge i vostri archivi`,
  "providers.ironmolehill.heroLate": () => `Data center progettati per la conformità`,
  "providers.ironmolehill.text": (p) => `Data center sicuri a ${p.cities}, con guardie, telecamere e accessi verificati 24 ore su 24.`,
  "providers.ironmolehill.cta": () => `Esplora i data center`,
  "providers.ironmolehill.pillar1": () => `Sicuro`,
  "providers.ironmolehill.pillar1Text": () => `Sicurezza fisica a più livelli e catena di custodia per ogni visita.`,
  "providers.ironmolehill.pillar2": () => `Conforme`,
  "providers.ironmolehill.pillar2Text": () => `Verificati ogni anno secondo gli standard richiesti dai vostri revisori.`,
  "providers.ironmolehill.pillar3": () => `Connesso`,
  "providers.ironmolehill.pillar3Text": () => `Operatori nell'edificio e cross-connect pronti in pochi giorni.`,
  "providers.ironmolehill.trusted": () => `Certificato per`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. Tutti i diritti riservati.`,
} satisfies Dict;
