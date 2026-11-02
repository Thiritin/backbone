import type { Dict } from "../lang";

export default {
  "providers.equinox.navSites": () => "Centros de datos IBX",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Portal de clientes",
  "providers.equinox.ibx": () => "Centros IBX",
  "providers.equinox.heroEarly": () => "Centros de datos neutrales y servicios de intercambio de Internet",
  "providers.equinox.heroLate": () => "La empresa de interconexión del mundo",
  "providers.equinox.text": (p) => `${p.n} centros International Bandwidth Exchange en ${p.cities} ciudades, donde operadores, proveedores de contenido y empresas se encuentran bajo un mismo techo.`,
  "providers.equinox.cta": () => "Buscar un centro de datos",
  "providers.equinox.col1": () => "Certificado y redundante",
  "providers.equinox.col1Text": () => "Cada centro funciona con alimentación A y B, generadores y seguridad auditada.",
  "providers.equinox.col2": () => "Interconexión en el centro",
  "providers.equinox.col2Text": () => "Cross-connect al punto neutro del edificio y a cada operador de la meet-me room.",
  "providers.equinox.col3": () => "Manos remotas las 24 horas",
  "providers.equinox.col3Text": () => "Hay técnicos en el centro día y noche, facturados por horas junto con su alquiler.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. Todos los derechos reservados.`,
} satisfies Dict;
