import type { Dict } from "../lang";

export default {
  "providers.ironmolehill.navHome": () => `Aperçu`,
  "providers.ironmolehill.navSites": () => `Centres de données`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Espace compte`,
  "providers.ironmolehill.heroEarly": () => `Protégez vos serveurs chez celui qui protège vos archives`,
  "providers.ironmolehill.heroLate": () => `Des centres de données conçus pour la conformité`,
  "providers.ironmolehill.text": (p) => `Des centres de données sécurisés à ${p.cities}, avec gardiens, caméras et accès audité jour et nuit.`,
  "providers.ironmolehill.cta": () => `Découvrir les centres`,
  "providers.ironmolehill.pillar1": () => `Sécurisé`,
  "providers.ironmolehill.pillar1Text": () => `Une sécurité physique en couches et une traçabilité de chaque visite.`,
  "providers.ironmolehill.pillar2": () => `Conforme`,
  "providers.ironmolehill.pillar2Text": () => `Audités chaque année selon les normes que demandent vos auditeurs.`,
  "providers.ironmolehill.pillar3": () => `Connecté`,
  "providers.ironmolehill.pillar3Text": () => `Des opérateurs dans le bâtiment et des cross-connects prêts en quelques jours.`,
  "providers.ironmolehill.trusted": () => `Audité selon`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. Tous droits réservés.`,
} satisfies Dict;
