import type { Dict } from "../lang";

export default {
  "providers.interaction.navSites": () => `Centros de datos`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Portal de clientes`,
  "providers.interaction.heroEarly": () => `El proveedor líder en Europa de colocation neutral`,
  "providers.interaction.heroLate": () => `Comunidades conectadas`,
  "providers.interaction.text": (p) => `${p.n} centros de datos neutrales en ${p.cities} ciudades europeas, hogar de las comunidades que mantienen Internet en marcha.`,
  "providers.interaction.cta": () => `Buscar un centro de datos`,
  "providers.interaction.communities": () => `Comunidades`,
  "providers.interaction.com1": () => `Operadores e ISP`,
  "providers.interaction.com2": () => `Cloud y hosting`,
  "providers.interaction.com3": () => `Medios digitales`,
  "providers.interaction.com4": () => `Finanzas`,
  "providers.interaction.statSites": () => `Centros de datos`,
  "providers.interaction.statCities": () => `Ciudades`,
  "providers.interaction.statCarriers": () => `Conexiones de operadores`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. Todos los derechos reservados.`,
} satisfies Dict;
