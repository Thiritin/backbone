import type { Dict } from "../lang";

export default {
  "paperwork.post.open": () => "Apri",
  "paperwork.letter.tax": () => "Accertamento e riscossione",
  "ui-tax.dohle.subtitle": () => "Dichiarazioni elettroniche",
  "ui-tax.dohle.home": () => "Home",
  "ui-tax.dohle.welcome": () => "Benvenuti su DOHLE",
  "ui-tax.dohle.welcomeText": () => "DOHLE trasmette le sue dichiarazioni all'ufficio delle imposte in via elettronica.",
  "ui-tax.dohle.foot": () => "© 2004 Amministrazione finanziaria",
  "ui-tax.dohle.questionnaire": () => "Questionario di registrazione fiscale",
  "ui-tax.dohle.company": () => "Impresa",
  "ui-tax.dohle.expected": (p) => `Fatturato previsto ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Limite piccole imprese ${p.year}`,
  "ui-tax.dohle.rule": () => "IVA",
  "ui-tax.dohle.ruleStandard": () => "Applicare l'IVA",
  "ui-tax.dohle.ruleSmall": () => "Regime delle piccole imprese",
  "ui-tax.dohle.send": () => "Invia",
  "ui-tax.dohle.sentOn": () => "Inviato il",
  "ui-tax.dohle.taxNumber": () => "Codice fiscale",
  "ui-tax.dohle.pending": () => "In lavorazione",
} satisfies Dict;
