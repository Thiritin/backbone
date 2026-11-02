import type { Dict } from "../lang";

export default {
  "providers.tellyhouse.navSites": () => `Centres de données`,
  "providers.tellyhouse.navColo": () => `Services de colocation`,
  "providers.tellyhouse.navPortal": () => `Portail client`,
  "providers.tellyhouse.tagline": () => `La maison de la colocation neutre depuis 1990`,
  "providers.tellyhouse.welcome": () => `Bienvenue chez Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `Nos ${p.n} centres de données à ${p.cities} accueillent ${p.carriers} connexions opérateurs et les points d'échange Internet qui s'y retrouvent.`,
  "providers.tellyhouse.campuses": () => `Nos campus`,
  "providers.tellyhouse.quick": () => `Liens rapides`,
  "providers.tellyhouse.contactBox": () => `Contact commercial`,
  "providers.tellyhouse.contactText": () => `Notre équipe commerciale répond à chaque demande sous un jour ouvré.`,
  "providers.tellyhouse.heroLate": () => `Là où se rencontrent les réseaux d'Europe`,
  "providers.tellyhouse.cta": () => `Nous contacter`,
  "providers.tellyhouse.statCarriers": () => `Connexions opérateurs`,
  "providers.tellyhouse.statExchanges": () => `Points d'échange`,
  "providers.tellyhouse.view": () => `Voir le centre`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
