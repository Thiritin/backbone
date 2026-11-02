import type { Dict } from "../lang";

export default {
  "providers.telex.navSites": () => "Strutture",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Dove le reti del mondo si incontrano a Manhattan",
  "providers.telex.heroLate": () => "Interconnessione nel cuore di New York",
  "providers.telex.text": (p) => `${p.name} a ${p.city} è uno degli edifici più connessi al mondo. I vostri rack sono a un cross-connect da ogni grande operatore.`,
  "providers.telex.cta": () => "Visita la struttura",
  "providers.telex.box1": () => "Sale meet-me",
  "providers.telex.box1Text": () => "Gli operatori si scambiano le reti sui nostri piani.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Armadi e cage con alimentazione A e B accanto agli operatori.",
  "providers.telex.box3": () => "Cross-connect",
  "providers.telex.box3Text": () => "Ordinate un cross-connect e i nostri tecnici lo collegano per voi.",
  "providers.telex.cardText": (p) => `Carrier hotel con ${p.exchange} in sede.`,
  "providers.telex.counter": () => "Operatori in sede",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
