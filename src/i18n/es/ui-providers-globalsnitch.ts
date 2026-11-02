import type { Dict } from "../lang";

export default {
  "providers.globalsnitch.navHome": () => `Inicio`,
  "providers.globalsnitch.navSites": () => `Nuestros centros de datos`,
  "providers.globalsnitch.navColo": () => `Espacio y energía`,
  "providers.globalsnitch.navPortal": () => `Acceso clientes`,
  "providers.globalsnitch.heroEarly": () => `Centros de datos neutrales en ciudades Tier 1`,
  "providers.globalsnitch.heroLate": () => `Grandes centros de datos en las principales ciudades del mundo`,
  "providers.globalsnitch.text": (p) => `Global Snitch es propietaria y operadora de grandes centros de datos multiinquilino en ${p.cities}, cada uno con energía redundante y conexión a muchos operadores.`,
  "providers.globalsnitch.cta": () => `Ver nuestros centros de datos`,
  "providers.globalsnitch.owner": () => `Propietario y operador`,
  "providers.globalsnitch.ownerText": () => `Somos dueños de cada edificio que operamos, así que nuestros clientes tratan con un solo arrendador para espacio, energía y conectividad.`,
  "providers.globalsnitch.statCarriers": () => `Conexiones de operadores`,
  "providers.globalsnitch.statPower": () => `Potencia por rack`,
  "providers.globalsnitch.statHands": () => `Respuesta de remote hands`,
  "providers.globalsnitch.footer": (p) => `© ${p.year} Global Snitch Holdings Limited`,
} satisfies Dict;
