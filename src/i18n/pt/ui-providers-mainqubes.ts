import type { Dict } from "../lang";

export default {
  "providers.mainqubes.navHome": () => `Início`,
  "providers.mainqubes.navSites": () => `Centro de dados`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Área de cliente`,
  "providers.mainqubes.heroEarly": (p) => `O seu centro de dados em ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `Espaço em bastidor de poucas unidades a uma suite privada, desde ${p.price} por mês, com ${p.carriers} operadores no edifício e técnicos próprios no local.`,
  "providers.mainqubes.heroLate": () => `Colocation segura`,
  "providers.mainqubes.textLate": (p) => `Espaço de alta segurança em ${p.cities}, certificado, neutro e ligado a ${p.carriers} operadores.`,
  "providers.mainqubes.cta": () => `Pedir proposta`,
  "providers.mainqubes.more": () => `Detalhes`,
  "providers.mainqubes.from": (p) => `desde ${p.price} / mês`,
  "providers.mainqubes.certified": () => `Certificado`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
