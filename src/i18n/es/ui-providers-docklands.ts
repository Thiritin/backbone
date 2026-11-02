import type { Dict } from "../lang";

export default {
  "providers.docklands.navSites": () => `Nuestras instalaciones`,
  "providers.docklands.navColo": () => `Precios`,
  "providers.docklands.navPortal": () => `Área de clientes`,
  "providers.docklands.call": (p) => `Llámenos al ${p.phone}`,
  "providers.docklands.why": () => `¿Por qué Docklands Data?`,
  "providers.docklands.why1": () => `Independiente y gestionada por sus dueños`,
  "providers.docklands.why2": () => `Técnicos propios en el este de Londres`,
  "providers.docklands.why3": () => `Precios mensuales claros`,
  "providers.docklands.why4": () => `Espacio desde pocas unidades hasta un rack completo`,
  "providers.docklands.heroEarly": () => `Colocation en los Docklands de Londres`,
  "providers.docklands.heroLate": () => `Colocation cercana en el corazón de Londres`,
  "providers.docklands.text": (p) => `Espacio en rack seguro para pequeñas empresas cerca de la City, desde ${p.price} al mes.`,
  "providers.docklands.quote": () => `Pedir presupuesto`,
  "providers.docklands.quoteText": () => `El equipo instaló nuestros servidores un sábado y a mediodía ya estábamos en línea.`,
  "providers.docklands.quoteBy": () => `Director general de un estudio de diseño en Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Registrada en Inglaterra y Gales.`,
} satisfies Dict;
