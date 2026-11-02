import type { Dict } from "../lang";

export default {
  "providers.mainqubes.navHome": () => `Accueil`,
  "providers.mainqubes.navSites": () => `Centre de données`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Espace client`,
  "providers.mainqubes.heroEarly": (p) => `Votre centre de données à ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `De l'espace en baie, de quelques unités à une suite privée, à partir de ${p.price} par mois, avec ${p.carriers} opérateurs dans le bâtiment et nos propres techniciens sur place.`,
  "providers.mainqubes.heroLate": () => `Colocation sécurisée`,
  "providers.mainqubes.textLate": (p) => `Des espaces hautement sécurisés à ${p.cities}, certifiés, neutres et reliés à ${p.carriers} opérateurs.`,
  "providers.mainqubes.cta": () => `Demander une offre`,
  "providers.mainqubes.more": () => `Détails`,
  "providers.mainqubes.from": (p) => `dès ${p.price} / mois`,
  "providers.mainqubes.certified": () => `Certifié`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
