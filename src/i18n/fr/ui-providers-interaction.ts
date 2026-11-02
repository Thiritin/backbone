import type { Dict } from "../lang";

export default {
  "providers.interaction.navSites": () => `Centres de données`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Portail client`,
  "providers.interaction.heroEarly": () => `Le premier fournisseur européen de colocation neutre`,
  "providers.interaction.heroLate": () => `Des communautés connectées`,
  "providers.interaction.text": (p) => `${p.n} centres de données neutres dans ${p.cities} villes européennes, où se retrouvent les communautés qui font tourner Internet.`,
  "providers.interaction.cta": () => `Trouver un centre de données`,
  "providers.interaction.communities": () => `Communautés`,
  "providers.interaction.com1": () => `Opérateurs et FAI`,
  "providers.interaction.com2": () => `Cloud et hébergement`,
  "providers.interaction.com3": () => `Médias numériques`,
  "providers.interaction.com4": () => `Finance`,
  "providers.interaction.statSites": () => `Centres de données`,
  "providers.interaction.statCities": () => `Villes`,
  "providers.interaction.statCarriers": () => `Connexions opérateurs`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. Tous droits réservés.`,
} satisfies Dict;
