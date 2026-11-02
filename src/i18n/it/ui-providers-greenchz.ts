import type { Dict } from "../lang";

export default {
  "providers.greenchz.navHome": () => "Home",
  "providers.greenchz.navSites": () => "Data center",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Centro clienti",
  "providers.greenchz.heroEarly": () => "Housing e colocation in Svizzera",
  "providers.greenchz.heroLate": () => "Data center svizzeri per dati che restano in Svizzera.",
  "providers.greenchz.text": (p) => `Il nostro data center vicino a ${p.city} conserva i vostri dati secondo il diritto svizzero, su un'infrastruttura certificata alimentata da energia rinnovabile.`,
  "providers.greenchz.cta": () => "Richiedi un'offerta",
  "providers.greenchz.point1": () => "Qualità svizzera",
  "providers.greenchz.point1Text": () => "Costruiamo e gestiamo ogni sede in proprio e teniamo i vostri dati nel Paese.",
  "providers.greenchz.point2": () => "Sicurezza certificata",
  "providers.greenchz.point2Text": () => "Controllo accessi, alimentazione ridondata e audit seguono standard riconosciuti.",
  "providers.greenchz.point3": () => "Energia rinnovabile",
  "providers.greenchz.point3Text": () => "I nostri data center funzionano con elettricità idroelettrica svizzera.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
