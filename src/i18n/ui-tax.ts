import type { Dict } from "./lang";

export default {
  "paperwork.post.open": () => "Open",
  "paperwork.letter.tax": () => "Assessment and collection",
  "ui-tax.dohle.subtitle": () => "Electronic tax returns",
  "ui-tax.dohle.home": () => "Home",
  "ui-tax.dohle.welcome": () => "Welcome to DOHLE",
  "ui-tax.dohle.welcomeText": () => "DOHLE sends your tax returns to the tax office electronically.",
  "ui-tax.dohle.foot": () => "© 2004 Tax administration",
  "ui-tax.dohle.questionnaire": () => "Questionnaire for tax registration",
  "ui-tax.dohle.company": () => "Company",
  "ui-tax.dohle.expected": (p) => `Expected revenue ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Small business limit ${p.year}`,
  "ui-tax.dohle.rule": () => "VAT",
  "ui-tax.dohle.ruleStandard": () => "Charge VAT",
  "ui-tax.dohle.ruleSmall": () => "Small business rule",
  "ui-tax.dohle.send": () => "Send",
  "ui-tax.dohle.sentOn": () => "Sent on",
  "ui-tax.dohle.taxNumber": () => "Tax number",
  "ui-tax.dohle.pending": () => "Pending",
} satisfies Dict;
