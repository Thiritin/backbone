import type { Dict } from "../lang";

export default {
  "paperwork.post.open": () => "Abrir",
  "paperwork.letter.tax": () => "Liquidação e cobrança",
  "ui-tax.dohle.subtitle": () => "Declarações eletrónicas",
  "ui-tax.dohle.home": () => "Início",
  "ui-tax.dohle.welcome": () => "Bem-vindo ao DOHLE",
  "ui-tax.dohle.welcomeText": () => "O DOHLE envia as suas declarações às Finanças por via eletrónica.",
  "ui-tax.dohle.foot": () => "© 2004 Administração fiscal",
  "ui-tax.dohle.questionnaire": () => "Questionário de registo fiscal",
  "ui-tax.dohle.company": () => "Empresa",
  "ui-tax.dohle.expected": (p) => `Faturação prevista ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Limite de pequena empresa ${p.year}`,
  "ui-tax.dohle.rule": () => "IVA",
  "ui-tax.dohle.ruleStandard": () => "Cobrar IVA",
  "ui-tax.dohle.ruleSmall": () => "Regime de pequena empresa",
  "ui-tax.dohle.send": () => "Enviar",
  "ui-tax.dohle.sentOn": () => "Enviado em",
  "ui-tax.dohle.taxNumber": () => "Número fiscal",
  "ui-tax.dohle.pending": () => "Em curso",
} satisfies Dict;
