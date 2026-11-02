import type { Dict } from "../lang";

export default {
  "providers.equinox.navSites": () => "Datacenters IBX",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Portail client",
  "providers.equinox.ibx": () => "Centres IBX",
  "providers.equinox.heroEarly": () => "Datacenters neutres et services d'échange Internet",
  "providers.equinox.heroLate": () => "L'entreprise mondiale de l'interconnexion",
  "providers.equinox.text": (p) => `${p.n} centres International Bandwidth Exchange dans ${p.cities} villes, où opérateurs, fournisseurs de contenu et entreprises se retrouvent sous un même toit.`,
  "providers.equinox.cta": () => "Trouver un datacenter",
  "providers.equinox.col1": () => "Certifié et redondant",
  "providers.equinox.col1Text": () => "Chaque site dispose d'alimentations A et B, de groupes électrogènes et d'une sécurité auditée.",
  "providers.equinox.col2": () => "Interconnexion sur site",
  "providers.equinox.col2Text": () => "Cross-connect vers le point d'échange du bâtiment et vers chaque opérateur de la meet-me room.",
  "providers.equinox.col3": () => "Remote hands 24 h/24",
  "providers.equinox.col3Text": () => "Des techniciens sont sur place jour et nuit et facturent à l'heure avec votre loyer.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. Tous droits réservés.`,
} satisfies Dict;
