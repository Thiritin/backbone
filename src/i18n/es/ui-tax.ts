import type { Dict } from "../lang";

export default {
  "paperwork.post.open": () => "Abrir",
  "paperwork.letter.tax": () => "Liquidación y recaudación",
  "ui-tax.dohle.subtitle": () => "Declaraciones electrónicas",
  "ui-tax.dohle.home": () => "Inicio",
  "ui-tax.dohle.welcome": () => "Bienvenido a DOHLE",
  "ui-tax.dohle.welcomeText": () => "DOHLE envía sus declaraciones a Hacienda por vía electrónica.",
  "ui-tax.dohle.foot": () => "© 2004 Administración tributaria",
  "ui-tax.dohle.questionnaire": () => "Cuestionario de alta fiscal",
  "ui-tax.dohle.company": () => "Empresa",
  "ui-tax.dohle.expected": (p) => `Facturación prevista ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Límite de pequeña empresa ${p.year}`,
  "ui-tax.dohle.rule": () => "IVA",
  "ui-tax.dohle.ruleStandard": () => "Cobrar IVA",
  "ui-tax.dohle.ruleSmall": () => "Régimen de pequeña empresa",
  "ui-tax.dohle.send": () => "Enviar",
  "ui-tax.dohle.sentOn": () => "Enviado el",
  "ui-tax.dohle.taxNumber": () => "Número fiscal",
  "ui-tax.dohle.pending": () => "En trámite",
} satisfies Dict;
