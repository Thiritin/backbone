import type { Dict } from "../lang";

export default {
  "providers.myloch.navHome": () => "Inicio",
  "providers.myloch.navSites": () => "Centro de datos",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Centro de clientes",
  "providers.myloch.claim": () => "Hosting desde Düsseldorf",
  "providers.myloch.heroEarly": () => "Colocation a precios justos",
  "providers.myloch.heroLate": () => "Sus servidores en nuestro centro de datos de Düsseldorf",
  "providers.myloch.text": (p) => `Instale su propio hardware en ${p.name} en ${p.city}, con energía, red y soporte incluidos.`,
  "providers.myloch.from": (p) => `Desde ${p.price} al mes`,
  "providers.myloch.units": (p) => `${p.n} unidades de rack`,
  "providers.myloch.power": (p) => `${p.kw} kW de potencia`,
  "providers.myloch.hands": (p) => `Manos remotas en ${p.hours} horas`,
  "providers.myloch.perMonth": (p) => `${p.price} / mes`,
  "providers.myloch.order": () => "Pedir ahora",
  "providers.myloch.vat": () => "Todos los precios son mensuales y no incluyen IVA.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
