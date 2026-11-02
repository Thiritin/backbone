import type { Dict } from "../lang";

export default {
  "providers.telex.navSites": () => "Sites",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Là où les réseaux du monde se rencontrent à Manhattan",
  "providers.telex.heroLate": () => "L'interconnexion au cœur de New York",
  "providers.telex.text": (p) => `${p.name} à ${p.city} est l'un des bâtiments les mieux connectés au monde. Vos baies sont à un cross-connect de chaque grand opérateur.`,
  "providers.telex.cta": () => "Visiter le site",
  "providers.telex.box1": () => "Salles meet-me",
  "providers.telex.box1Text": () => "Les opérateurs s'échangent leurs réseaux sur nos étages.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Baies et cages avec alimentation A et B à côté des opérateurs.",
  "providers.telex.box3": () => "Cross-connects",
  "providers.telex.box3Text": () => "Commandez un cross-connect et nos techniciens le brassent pour vous.",
  "providers.telex.cardText": (p) => `Hôtel d'opérateurs avec ${p.exchange} sur place.`,
  "providers.telex.counter": () => "Opérateurs sur place",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
