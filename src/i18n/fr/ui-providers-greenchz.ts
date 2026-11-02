import type { Dict } from "../lang";

export default {
  "providers.greenchz.navHome": () => "Accueil",
  "providers.greenchz.navSites": () => "Data centers",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Espace client",
  "providers.greenchz.heroEarly": () => "Housing et colocation en Suisse",
  "providers.greenchz.heroLate": () => "Des data centers suisses pour des données qui restent en Suisse.",
  "providers.greenchz.text": (p) => `Notre data center près de ${p.city} conserve vos données selon le droit suisse, sur une infrastructure certifiée alimentée en énergie renouvelable.`,
  "providers.greenchz.cta": () => "Demander une offre",
  "providers.greenchz.point1": () => "Qualité suisse",
  "providers.greenchz.point1Text": () => "Nous construisons et exploitons chaque site nous-mêmes et gardons vos données dans le pays.",
  "providers.greenchz.point2": () => "Sécurité certifiée",
  "providers.greenchz.point2Text": () => "Le contrôle d'accès, l'alimentation redondante et les audits suivent des normes reconnues.",
  "providers.greenchz.point3": () => "Énergie renouvelable",
  "providers.greenchz.point3Text": () => "Nos data centers fonctionnent à l'électricité hydraulique suisse.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
