import type { Dict } from "../lang";

export default {
  "providers.docklands.navSites": () => `Notre site`,
  "providers.docklands.navColo": () => `Tarifs`,
  "providers.docklands.navPortal": () => `Espace client`,
  "providers.docklands.call": (p) => `Appelez-nous au ${p.phone}`,
  "providers.docklands.why": () => `Pourquoi Docklands Data ?`,
  "providers.docklands.why1": () => `Indépendant et dirigé par ses fondateurs`,
  "providers.docklands.why2": () => `Nos propres techniciens dans l'est de Londres`,
  "providers.docklands.why3": () => `Des prix mensuels clairs`,
  "providers.docklands.why4": () => `De quelques unités à une baie complète`,
  "providers.docklands.heroEarly": () => `Colocation dans les Docklands de Londres`,
  "providers.docklands.heroLate": () => `Une colocation à taille humaine au cœur de Londres`,
  "providers.docklands.text": (p) => `De l'espace en baie sécurisé pour les petites entreprises près de la City, à partir de ${p.price} par mois.`,
  "providers.docklands.quote": () => `Obtenir un devis`,
  "providers.docklands.quoteText": () => `L'équipe a installé nos serveurs un samedi et nous étions de nouveau en ligne à midi.`,
  "providers.docklands.quoteBy": () => `Directeur d'un studio de design à Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Immatriculée en Angleterre et au pays de Galles.`,
} satisfies Dict;
