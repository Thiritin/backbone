import type { Dict } from "../lang";

export default {
  "paperwork.post.open": () => "Öffnen",
  "paperwork.letter.tax": () => "Veranlagung und Erhebung",
  "ui-tax.dohle.subtitle": () => "Elektronische Steuererklärung",
  "ui-tax.dohle.home": () => "Startseite",
  "ui-tax.dohle.welcome": () => "Willkommen bei DOHLE",
  "ui-tax.dohle.welcomeText": () => "DOHLE übermittelt Ihre Steuererklärungen elektronisch an das Finanzamt.",
  "ui-tax.dohle.foot": () => "© 2004 Steuerverwaltung",
  "ui-tax.dohle.questionnaire": () => "Fragebogen zur steuerlichen Erfassung",
  "ui-tax.dohle.company": () => "Unternehmen",
  "ui-tax.dohle.expected": (p) => `Voraussichtlicher Umsatz ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Kleinunternehmergrenze ${p.year}`,
  "ui-tax.dohle.rule": () => "Umsatzsteuer",
  "ui-tax.dohle.ruleStandard": () => "Regelbesteuerung",
  "ui-tax.dohle.ruleSmall": () => "Kleinunternehmerregelung",
  "ui-tax.dohle.send": () => "Absenden",
  "ui-tax.dohle.sentOn": () => "Gesendet am",
  "ui-tax.dohle.taxNumber": () => "Steuernummer",
  "ui-tax.dohle.pending": () => "In Bearbeitung",
} satisfies Dict;
