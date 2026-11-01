import type { Dict } from "../lang";
import { euro } from "../../sim/00-core/money";

export default {
  "letter.taxQuestionnaire.subject": () => "Questionnaire d'immatriculation fiscale",
  "letter.taxQuestionnaire.body": (p) => `Le bureau du commerce nous a informés que ${p.name} a démarré une activité. Veuillez remplir le questionnaire d'immatriculation fiscale sur DOHLE, à l'adresse www.dohle.de/erfassung/. Une entreprise dont le chiffre d'affaires reste sous ${euro(Number(p.limit))} par an peut opter pour le régime de la petite entreprise et ne facture pas de TVA.`,
  "letter.taxNumber.subject": (p) => `Votre numéro fiscal ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} est enregistrée chez nous sous le numéro fiscal ${p.number}. Veuillez l'indiquer sur chaque déclaration et chaque courrier. ${p.period === "none" ? "En tant que petite entreprise, vous ne facturez pas de TVA et ne déposez pas de déclarations anticipées." : "Veuillez déposer la déclaration anticipée de TVA de chaque mois avant le 10 du mois suivant."}`,
  "sim.index.dohle": () => "Déposer ses déclarations fiscales en ligne.",
  "error.taxNoQuestionnaire": () => "Le questionnaire du centre des impôts n'est pas encore arrivé.",
  "error.taxAnswered": () => "Le questionnaire a déjà été envoyé.",
  "error.taxRevenue": () => "Saisissez le chiffre d'affaires prévu.",
  "error.taxSmallLimit": () => "Le chiffre d'affaires prévu dépasse le plafond du régime de la petite entreprise.",
} satisfies Dict;
