import type { Dict } from "../lang";

export default {
  "providers.data5.navHome": () => "El grupo",
  "providers.data5.navSites": () => "Nuestros campus",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Área de clientes",
  "providers.data5.quote": () => "Solicitar presupuesto",
  "providers.data5.heroEarly": () => "Campus europeos de centros de datos para su infraestructura crítica",
  "providers.data5.heroLate": () => "Centros de datos hechos para durar, para los datos que mueven Europa",
  "providers.data5.text": (p) => `Diseñamos, construimos y operamos ${p.n} campus de centros de datos en ${p.cities}, con energía y conectividad pensadas para décadas de crecimiento.`,
  "providers.data5.cta": () => "Descubra nuestros campus",
  "providers.data5.figSites": () => "Campus",
  "providers.data5.figCarriers": () => "Operadores en el sitio",
  "providers.data5.figCities": () => "Ciudades",
  "providers.data5.campuses": () => "Nuestros campus",
  "providers.data5.carriers": (p) => `${p.n} operadores`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
