import type { Dict } from "../lang";

export default {
  "providers.mainqubes.navHome": () => `Inicio`,
  "providers.mainqubes.navSites": () => `Centro de datos`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Acceso clientes`,
  "providers.mainqubes.heroEarly": (p) => `Su centro de datos en ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `Espacio en rack desde unas pocas unidades hasta una suite privada, desde ${p.price} al mes, con ${p.carriers} operadores en el edificio y técnicos propios in situ.`,
  "providers.mainqubes.heroLate": () => `Colocation segura`,
  "providers.mainqubes.textLate": (p) => `Espacio de alta seguridad en ${p.cities}, certificado, neutral y conectado a ${p.carriers} operadores.`,
  "providers.mainqubes.cta": () => `Solicitar oferta`,
  "providers.mainqubes.more": () => `Detalles`,
  "providers.mainqubes.from": (p) => `desde ${p.price} / mes`,
  "providers.mainqubes.certified": () => `Certificado`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
