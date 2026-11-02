import type { Dict } from "../lang";

export default {
  "providers.globalsnitch.navHome": () => `Accueil`,
  "providers.globalsnitch.navSites": () => `Nos centres de données`,
  "providers.globalsnitch.navColo": () => `Espace et énergie`,
  "providers.globalsnitch.navPortal": () => `Espace client`,
  "providers.globalsnitch.heroEarly": () => `Des centres de données neutres dans les villes Tier 1`,
  "providers.globalsnitch.heroLate": () => `De grands centres de données dans les premières villes du monde`,
  "providers.globalsnitch.text": (p) => `Global Snitch possède et exploite grands centres de données multi-locataires à ${p.cities}, chacun doté d'une alimentation redondante et relié à de nombreux opérateurs.`,
  "providers.globalsnitch.cta": () => `Voir nos centres de données`,
  "providers.globalsnitch.owner": () => `Propriétaire et exploitant`,
  "providers.globalsnitch.ownerText": () => `Nous possédons chaque bâtiment que nous exploitons, et nos clients ont un seul bailleur pour l'espace, l'énergie et la connectivité.`,
  "providers.globalsnitch.statCarriers": () => `Connexions opérateurs`,
  "providers.globalsnitch.statPower": () => `Puissance par baie`,
  "providers.globalsnitch.statHands": () => `Délai d'intervention sur site`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
