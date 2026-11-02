import type { Dict } from "../lang";

export default {
  "providers.skyblink.navSites": () => "Centro de datos",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "Sus servidores en las nubes de Limburgo del Sur",
  "providers.skyblink.side": (p) => `Centro de datos ${p.city}`,
  "providers.skyblink.more": () => "Ver el centro de datos",
  "providers.skyblink.heroEarly": () => "Colocation con la cabeza en las nubes y los pies en la tierra",
  "providers.skyblink.heroLate": () => "Un centro de datos en la frontera de tres países",
  "providers.skyblink.text": (p) => `${p.name} en ${p.city} aloja sus servidores cerca de Aquisgrán, Lieja y Maastricht. El espacio en rack empieza en ${p.price} al mes.`,
  "providers.skyblink.usp1": () => "Neutral respecto a operadores",
  "providers.skyblink.usp1Text": (p) => `Elija entre ${p.carriers} operadores en el edificio.`,
  "providers.skyblink.usp2": () => "Técnicos in situ",
  "providers.skyblink.usp2Text": (p) => `Las manos remotas responden en ${p.hours} horas.`,
  "providers.skyblink.usp3": () => "Trato directo",
  "providers.skyblink.usp3Text": () => "Usted habla directamente con quienes gestionan el edificio.",
  "providers.skyblink.from": (p) => `Espacio en rack desde ${p.price} al mes.`,
  "providers.skyblink.quote": () => "Solicitar presupuesto",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
