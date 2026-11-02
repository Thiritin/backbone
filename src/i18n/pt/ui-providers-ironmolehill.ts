import type { Dict } from "../lang";

export default {
  "providers.ironmolehill.navHome": () => `Visão geral`,
  "providers.ironmolehill.navSites": () => `Centros de dados`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Centro de conta`,
  "providers.ironmolehill.heroEarly": () => `Proteja os seus servidores com a empresa que protege os seus arquivos`,
  "providers.ironmolehill.heroLate": () => `Centros de dados concebidos para a conformidade`,
  "providers.ironmolehill.text": (p) => `Centros de dados seguros em ${p.cities}, com vigilantes, câmaras e acesso auditado 24 horas por dia.`,
  "providers.ironmolehill.cta": () => `Explorar centros de dados`,
  "providers.ironmolehill.pillar1": () => `Seguro`,
  "providers.ironmolehill.pillar1Text": () => `Segurança física em camadas e cadeia de custódia em cada visita.`,
  "providers.ironmolehill.pillar2": () => `Conforme`,
  "providers.ironmolehill.pillar2Text": () => `Auditados todos os anos segundo as normas que os seus auditores exigem.`,
  "providers.ironmolehill.pillar3": () => `Ligado`,
  "providers.ironmolehill.pillar3Text": () => `Operadores no edifício e ligações cruzadas prontas em poucos dias.`,
  "providers.ironmolehill.trusted": () => `Auditado segundo`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. Todos os direitos reservados.`,
} satisfies Dict;
