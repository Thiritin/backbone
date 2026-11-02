import type { Dict } from "../lang";

export default {
  "providers.data5.navHome": () => "O grupo",
  "providers.data5.navSites": () => "Os nossos campus",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Área de cliente",
  "providers.data5.quote": () => "Pedir orçamento",
  "providers.data5.heroEarly": () => "Campus europeus de centros de dados para a sua infraestrutura crítica",
  "providers.data5.heroLate": () => "Centros de dados feitos para durar, para os dados que movem a Europa",
  "providers.data5.text": (p) => `Projetamos, construímos e operamos ${p.n} campus de centros de dados em ${p.cities}, com energia e conectividade dimensionadas para décadas de crescimento.`,
  "providers.data5.cta": () => "Conheça os nossos campus",
  "providers.data5.figSites": () => "Campus",
  "providers.data5.figCarriers": () => "Operadores no local",
  "providers.data5.figCities": () => "Cidades",
  "providers.data5.campuses": () => "Os nossos campus",
  "providers.data5.carriers": (p) => `${p.n} operadores`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
