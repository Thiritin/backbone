import type { Dict } from "../lang";

export default {
  "providers.arubaba.navHome": () => "Inicio",
  "providers.arubaba.navSites": () => "Centro de datos",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Área de clientes",
  "providers.arubaba.heroEarly": () => "Colocation en nuestro centro de datos italiano",
  "providers.arubaba.heroLate": () => "Sus servidores en el centro de datos de Arubaba",
  "providers.arubaba.text": (p) => `Traiga sus servidores a ${p.name} en ${p.city}: un centro de datos certificado con energía redundante, extinción de incendios y personal día y noche.`,
  "providers.arubaba.discover": () => "Conocer el centro de datos",
  "providers.arubaba.from": (p) => `desde ${p.price}`,
  "providers.arubaba.perMonth": () => "al mes + IVA",
  "providers.arubaba.buy": () => "Comprar",
  "providers.arubaba.vat": () => "Los precios no incluyen el IVA.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
