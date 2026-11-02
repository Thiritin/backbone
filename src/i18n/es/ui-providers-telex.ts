import type { Dict } from "../lang";

export default {
  "providers.telex.navSites": () => "Instalaciones",
  "providers.telex.navOrder": () => "Colocation",
  "providers.telex.navPortal": () => "TelexNet",
  "providers.telex.heroEarly": () => "Donde las redes del mundo se encuentran en Manhattan",
  "providers.telex.heroLate": () => "Interconexión en el corazón de Nueva York",
  "providers.telex.text": (p) => `${p.name} en ${p.city} es uno de los edificios mejor conectados del mundo. Sus racks están a una conexión cruzada de cada gran operador.`,
  "providers.telex.cta": () => "Visitar la instalación",
  "providers.telex.box1": () => "Salas meet-me",
  "providers.telex.box1Text": () => "Los operadores se entregan sus redes entre sí en nuestras plantas.",
  "providers.telex.box2": () => "Colocation",
  "providers.telex.box2Text": () => "Armarios y jaulas con alimentación A y B junto a los operadores.",
  "providers.telex.box3": () => "Conexiones cruzadas",
  "providers.telex.box3Text": () => "Pida una conexión cruzada y nuestros técnicos la instalan por usted.",
  "providers.telex.cardText": (p) => `Hotel de operadores con ${p.exchange} en el edificio.`,
  "providers.telex.counter": () => "Operadores en el edificio",
  "providers.telex.footer": (p) => `© ${p.year} The Telex Group, Inc.`,
} satisfies Dict;
