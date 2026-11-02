import type { Dict } from "../lang";

export default {
  "providers.tellyhouse.navSites": () => `Centros de datos`,
  "providers.tellyhouse.navColo": () => `Servicios de colocation`,
  "providers.tellyhouse.navPortal": () => `Portal de clientes`,
  "providers.tellyhouse.tagline": () => `El hogar de la colocation neutral desde 1990`,
  "providers.tellyhouse.welcome": () => `Bienvenido a Tellyhouse Europe`,
  "providers.tellyhouse.text": (p) => `Nuestros ${p.n} centros de datos en ${p.cities} albergan ${p.carriers} conexiones de operadores y los puntos de intercambio que se reúnen en ellos.`,
  "providers.tellyhouse.campuses": () => `Nuestros campus`,
  "providers.tellyhouse.quick": () => `Accesos rápidos`,
  "providers.tellyhouse.contactBox": () => `Consultas comerciales`,
  "providers.tellyhouse.contactText": () => `Nuestro equipo comercial responde cada consulta en un día laborable.`,
  "providers.tellyhouse.heroLate": () => `Donde se encuentran las redes de Europa`,
  "providers.tellyhouse.cta": () => `Consultar ahora`,
  "providers.tellyhouse.statCarriers": () => `Conexiones de operadores`,
  "providers.tellyhouse.statExchanges": () => `Puntos de intercambio`,
  "providers.tellyhouse.view": () => `Ver centro de datos`,
  "providers.tellyhouse.footer": (p) => `© ${p.year} Tellyhouse International Corporation of Europe Ltd.`,
} satisfies Dict;
