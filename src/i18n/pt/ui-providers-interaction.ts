import type { Dict } from "../lang";

export default {
  "providers.interaction.navSites": () => `Centros de dados`,
  "providers.interaction.navColo": () => `Colocation`,
  "providers.interaction.navPortal": () => `Portal do cliente`,
  "providers.interaction.heroEarly": () => `O principal fornecedor europeu de colocation neutra`,
  "providers.interaction.heroLate": () => `Comunidades ligadas`,
  "providers.interaction.text": (p) => `${p.n} centros de dados neutros em ${p.cities} cidades europeias, casa das comunidades que mantêm a Internet a funcionar.`,
  "providers.interaction.cta": () => `Encontrar um centro de dados`,
  "providers.interaction.communities": () => `Comunidades`,
  "providers.interaction.com1": () => `Operadores e ISP`,
  "providers.interaction.com2": () => `Cloud e alojamento`,
  "providers.interaction.com3": () => `Media digitais`,
  "providers.interaction.com4": () => `Finanças`,
  "providers.interaction.statSites": () => `Centros de dados`,
  "providers.interaction.statCities": () => `Cidades`,
  "providers.interaction.statCarriers": () => `Ligações de operadores`,
  "providers.interaction.footer": (p) => `© ${p.year} Interaction Holding N.V. Todos os direitos reservados.`,
} satisfies Dict;
