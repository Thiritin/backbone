import type { Dict } from "../lang";

export default {
  "paperwork.post.open": () => "Ouvrir",
  "paperwork.letter.tax": () => "Établissement et recouvrement",
  "ui-tax.dohle.subtitle": () => "Déclarations électroniques",
  "ui-tax.dohle.home": () => "Accueil",
  "ui-tax.dohle.welcome": () => "Bienvenue sur DOHLE",
  "ui-tax.dohle.welcomeText": () => "DOHLE transmet vos déclarations au centre des impôts par voie électronique.",
  "ui-tax.dohle.foot": () => "© 2004 Administration fiscale",
  "ui-tax.dohle.questionnaire": () => "Questionnaire d'immatriculation fiscale",
  "ui-tax.dohle.company": () => "Entreprise",
  "ui-tax.dohle.expected": (p) => `Chiffre d'affaires prévu ${p.year}`,
  "ui-tax.dohle.limit": (p) => `Plafond petite entreprise ${p.year}`,
  "ui-tax.dohle.rule": () => "TVA",
  "ui-tax.dohle.ruleStandard": () => "Facturer la TVA",
  "ui-tax.dohle.ruleSmall": () => "Régime de la petite entreprise",
  "ui-tax.dohle.send": () => "Envoyer",
  "ui-tax.dohle.sentOn": () => "Envoyé le",
  "ui-tax.dohle.taxNumber": () => "Numéro fiscal",
  "ui-tax.dohle.pending": () => "En cours",
} satisfies Dict;
