import type { Dict } from "../lang";

export default {
  "providers.data5.navHome": () => "Le groupe",
  "providers.data5.navSites": () => "Nos campus",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Espace client",
  "providers.data5.quote": () => "Demander un devis",
  "providers.data5.heroEarly": () => "Des campus de data centers européens pour votre infrastructure critique",
  "providers.data5.heroLate": () => "Des data centers bâtis pour durer, pour les données qui font avancer l'Europe",
  "providers.data5.text": (p) => `Nous concevons, construisons et exploitons ${p.n} campus de data centers à ${p.cities}, avec une puissance et une connectivité dimensionnées pour des décennies de croissance.`,
  "providers.data5.cta": () => "Découvrir nos campus",
  "providers.data5.figSites": () => "Campus",
  "providers.data5.figCarriers": () => "Opérateurs sur site",
  "providers.data5.figCities": () => "Villes",
  "providers.data5.campuses": () => "Nos campus",
  "providers.data5.carriers": (p) => `${p.n} opérateurs`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
