import type { Dict } from "../lang";

export default {
  "providers.docklands.navSites": () => `As nossas instalações`,
  "providers.docklands.navColo": () => `Preços`,
  "providers.docklands.navPortal": () => `Área de cliente`,
  "providers.docklands.call": (p) => `Ligue-nos para o ${p.phone}`,
  "providers.docklands.why": () => `Porquê a Docklands Data?`,
  "providers.docklands.why1": () => `Independente e gerida pelos donos`,
  "providers.docklands.why2": () => `Técnicos próprios no leste de Londres`,
  "providers.docklands.why3": () => `Preços mensais claros`,
  "providers.docklands.why4": () => `Espaço de poucas unidades a um bastidor completo`,
  "providers.docklands.heroEarly": () => `Colocation nas Docklands de Londres`,
  "providers.docklands.heroLate": () => `Colocation próxima no coração de Londres`,
  "providers.docklands.text": (p) => `Espaço em bastidor seguro para pequenas empresas perto da City, desde ${p.price} por mês.`,
  "providers.docklands.quote": () => `Pedir orçamento`,
  "providers.docklands.quoteText": () => `A equipa instalou os nossos servidores num sábado e à hora de almoço já estávamos online.`,
  "providers.docklands.quoteBy": () => `Diretor-geral de um estúdio de design em Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Registada em Inglaterra e no País de Gales.`,
} satisfies Dict;
