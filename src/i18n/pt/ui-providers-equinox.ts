import type { Dict } from "../lang";

export default {
  "providers.equinox.navSites": () => "Data centers IBX",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Portal do cliente",
  "providers.equinox.ibx": () => "Centros IBX",
  "providers.equinox.heroEarly": () => "Data centers neutros e serviços de troca de tráfego",
  "providers.equinox.heroLate": () => "A empresa de interconexão do mundo",
  "providers.equinox.text": (p) => `${p.n} centros International Bandwidth Exchange em ${p.cities} cidades, onde operadoras, provedores de conteúdo e empresas se encontram sob o mesmo teto.`,
  "providers.equinox.cta": () => "Encontrar um data center",
  "providers.equinox.col1": () => "Certificado e redundante",
  "providers.equinox.col1Text": () => "Cada site opera com alimentação A e B, geradores e segurança auditada.",
  "providers.equinox.col2": () => "Interconexão no local",
  "providers.equinox.col2Text": () => "Cross-connect ao ponto de troca do prédio e a cada operadora da meet-me room.",
  "providers.equinox.col3": () => "Remote hands 24 horas",
  "providers.equinox.col3Text": () => "Técnicos ficam no local dia e noite e cobram por hora junto com o aluguel.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. Todos os direitos reservados.`,
} satisfies Dict;
