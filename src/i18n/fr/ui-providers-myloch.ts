import type { Dict } from "../lang";

export default {
  "providers.myloch.navHome": () => "Accueil",
  "providers.myloch.navSites": () => "Datacenter",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Centre client",
  "providers.myloch.claim": () => "Hébergement depuis Düsseldorf",
  "providers.myloch.heroEarly": () => "La colocation à prix justes",
  "providers.myloch.heroLate": () => "Vos serveurs dans notre datacenter de Düsseldorf",
  "providers.myloch.text": (p) => `Installez votre propre matériel dans ${p.name} à ${p.city}, électricité, réseau et support compris.`,
  "providers.myloch.from": (p) => `À partir de ${p.price} par mois`,
  "providers.myloch.units": (p) => `${p.n} unités de baie`,
  "providers.myloch.power": (p) => `${p.kw} kW de puissance`,
  "providers.myloch.hands": (p) => `Mains à distance sous ${p.hours} heures`,
  "providers.myloch.perMonth": (p) => `${p.price} / mois`,
  "providers.myloch.order": () => "Commander",
  "providers.myloch.vat": () => "Tous les prix sont mensuels et hors TVA.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
