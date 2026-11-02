import type { Dict } from "../lang";

export default {
  "providers.spree.navHome": () => "Accueil",
  "providers.spree.navSites": () => "Data center",
  "providers.spree.navOrder": () => "Tarifs et commande",
  "providers.spree.navAccount": () => "Espace client",
  "providers.spree.tagline": (p) => `Colocation depuis ${p.city}`,
  "providers.spree.news": () => "Actualités",
  "providers.spree.news1": () => "Notre deuxième onduleur est installé et en service.",
  "providers.spree.news2": () => "Nous louons désormais aussi des unités de hauteur à l'unité.",
  "providers.spree.heroEarly": () => "Bienvenue chez Spree Colo",
  "providers.spree.textEarly": () => "Nous exploitons un petit data center au bord de la rivière et louons de l'espace en baie aux entreprises, aux développeurs et à tous ceux qui veulent mettre un serveur en ligne. Vous parlez directement aux techniciens qui s'occupent de votre baie.",
  "providers.spree.from": (p) => `Espace en baie à partir de ${p.price} par mois`,
  "providers.spree.heroLate": (p) => `Votre baie à ${p.city}`,
  "providers.spree.textLate": () => "Nous sommes un hébergeur de colocation indépendant, avec notre propre data center, des circuits courts et des techniciens qui vous connaissent par votre nom.",
  "providers.spree.feat1": () => "Indépendants",
  "providers.spree.feat1Text": () => "Nous n'appartenons à aucun groupe, les décisions se prennent donc dans le bâtiment où tourne votre serveur.",
  "providers.spree.feat2": () => "Proches",
  "providers.spree.feat2Text": () => "Quand vous appelez, vous tombez sur les techniciens qui ont installé votre baie.",
  "providers.spree.feat3": () => "Prix justes",
  "providers.spree.feat3Text": () => "Tous les prix sont affichés sur le site et le contrat est résiliable chaque mois.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
