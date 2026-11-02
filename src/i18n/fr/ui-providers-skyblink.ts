import type { Dict } from "../lang";

export default {
  "providers.skyblink.navSites": () => "Datacenter",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "Vos serveurs dans les nuages du Limbourg du Sud",
  "providers.skyblink.side": (p) => `Datacenter ${p.city}`,
  "providers.skyblink.more": () => "Voir le datacenter",
  "providers.skyblink.heroEarly": () => "La colocation la tête dans les nuages et les pieds sur terre",
  "providers.skyblink.heroLate": () => "Un datacenter à la frontière de trois pays",
  "providers.skyblink.text": (p) => `${p.name} à ${p.city} héberge vos serveurs près d'Aix-la-Chapelle, de Liège et de Maastricht. L'espace en baie commence à ${p.price} par mois.`,
  "providers.skyblink.usp1": () => "Neutre vis-à-vis des opérateurs",
  "providers.skyblink.usp1Text": (p) => `Choisissez parmi ${p.carriers} opérateurs présents dans le bâtiment.`,
  "providers.skyblink.usp2": () => "Techniciens sur place",
  "providers.skyblink.usp2Text": (p) => `Les mains à distance interviennent sous ${p.hours} heures.`,
  "providers.skyblink.usp3": () => "Circuits courts",
  "providers.skyblink.usp3Text": () => "Vous parlez directement aux personnes qui exploitent le bâtiment.",
  "providers.skyblink.from": (p) => `Espace en baie à partir de ${p.price} par mois.`,
  "providers.skyblink.quote": () => "Demander un devis",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
