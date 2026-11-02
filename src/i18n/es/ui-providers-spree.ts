import type { Dict } from "../lang";

export default {
  "providers.spree.navHome": () => "Inicio",
  "providers.spree.navSites": () => "Centro de datos",
  "providers.spree.navOrder": () => "Precios y pedido",
  "providers.spree.navAccount": () => "Acceso clientes",
  "providers.spree.tagline": (p) => `Colocation desde ${p.city}`,
  "providers.spree.news": () => "Noticias",
  "providers.spree.news1": () => "Nuestro segundo SAI está instalado y en marcha.",
  "providers.spree.news2": () => "Ahora también alquilamos unidades de altura sueltas.",
  "providers.spree.heroEarly": () => "Bienvenido a Spree Colo",
  "providers.spree.textEarly": () => "Llevamos un pequeño centro de datos junto al río y alquilamos espacio en rack a empresas, desarrolladores y a quien necesite un servidor en línea. Usted habla directamente con los técnicos que cuidan su rack.",
  "providers.spree.from": (p) => `Espacio en rack desde ${p.price} al mes`,
  "providers.spree.heroLate": (p) => `Su rack en ${p.city}`,
  "providers.spree.textLate": () => "Somos un proveedor independiente de colocation con centro de datos propio, trato cercano y técnicos que le conocen por su nombre.",
  "providers.spree.feat1": () => "Independientes",
  "providers.spree.feat1Text": () => "No pertenecemos a ningún grupo, así que las decisiones se toman en el edificio donde funciona su servidor.",
  "providers.spree.feat2": () => "Cercanos",
  "providers.spree.feat2Text": () => "Cuando llama, habla con los técnicos que instalaron su rack.",
  "providers.spree.feat3": () => "Precios justos",
  "providers.spree.feat3Text": () => "Todos los precios están en la web y el contrato se renueva mes a mes.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
