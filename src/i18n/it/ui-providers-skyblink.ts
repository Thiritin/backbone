import type { Dict } from "../lang";

export default {
  "providers.skyblink.navSites": () => "Data center",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "I vostri server tra le nuvole del Limburgo meridionale",
  "providers.skyblink.side": (p) => `Data center ${p.city}`,
  "providers.skyblink.more": () => "Vedi il data center",
  "providers.skyblink.heroEarly": () => "Colocation con la testa tra le nuvole e i piedi per terra",
  "providers.skyblink.heroLate": () => "Un data center al confine di tre paesi",
  "providers.skyblink.text": (p) => `${p.name} a ${p.city} ospita i vostri server vicino ad Aquisgrana, Liegi e Maastricht. Lo spazio rack parte da ${p.price} al mese.`,
  "providers.skyblink.usp1": () => "Neutrale rispetto agli operatori",
  "providers.skyblink.usp1Text": (p) => `Scegliete tra ${p.carriers} operatori nell'edificio.`,
  "providers.skyblink.usp2": () => "Tecnici in sede",
  "providers.skyblink.usp2Text": (p) => `Il remote hands risponde entro ${p.hours} ore.`,
  "providers.skyblink.usp3": () => "Contatto diretto",
  "providers.skyblink.usp3Text": () => "Parlate direttamente con chi gestisce l'edificio.",
  "providers.skyblink.from": (p) => `Spazio rack da ${p.price} al mese.`,
  "providers.skyblink.quote": () => "Richiedi un preventivo",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
