import type { Dict } from "../lang";

export default {
  "providers.arubaba.navHome": () => "Accueil",
  "providers.arubaba.navSites": () => "Data center",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Espace client",
  "providers.arubaba.heroEarly": () => "Colocation dans notre data center italien",
  "providers.arubaba.heroLate": () => "Vos serveurs dans le data center Arubaba",
  "providers.arubaba.text": (p) => `Installez vos serveurs à ${p.name}, à ${p.city} : un data center certifié avec alimentation redondante, extinction incendie et personnel présent jour et nuit.`,
  "providers.arubaba.discover": () => "Découvrir le data center",
  "providers.arubaba.from": (p) => `à partir de ${p.price}`,
  "providers.arubaba.perMonth": () => "par mois HT",
  "providers.arubaba.buy": () => "Acheter",
  "providers.arubaba.vat": () => "Les prix s'entendent hors TVA.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
