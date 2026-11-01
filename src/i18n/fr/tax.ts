import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { day, period } from "../tax";

type Params = Record<string, string | number>;
const pay = (p: Params) => `Merci de virer ${euroCents(Number(p.amount))} avant le ${day(p.due)} sur ${p.iban ? `l'IBAN ${p.iban}` : `le compte ${p.account}, code banque ${p.code}`}, avec la référence ${p.number}.`;
const PERIOD: Record<string, string> = {"month": "dépose une déclaration anticipée de TVA chaque mois, avant le 10 du mois suivant", "quarter": "dépose une déclaration anticipée de TVA chaque trimestre, avant le 10 du mois qui suit le trimestre", "year": "ne dépose plus de déclarations anticipées et régularise la TVA avec la déclaration annuelle", "none": "ne facture pas de TVA et ne dépose pas de déclarations anticipées"};

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
  "letter.taxSurcharge.subject": () => "Majoration pour dépôt tardif",
  "letter.taxSurcharge.body": (p) => `Numéro fiscal ${p.taxNo}. La déclaration anticipée de TVA pour ${period(p)} était due le ${day(p.deadline)} et ne nous est pas parvenue. Nous fixons une majoration pour dépôt tardif de ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `Estimation de la TVA pour ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Numéro fiscal ${p.taxNo}. La déclaration anticipée de TVA pour ${period(p)} n'a toujours pas été déposée ; nous avons donc estimé la TVA à ${euroCents(Number(p.amount))}. Le dépôt de la déclaration remplace cette estimation. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "Fin du régime de la petite entreprise",
  "letter.taxSmallEnd.body": (p) => `Le chiffre d'affaires de ${p.name} l'an dernier était de ${euro(Number(p.revenue))}, au-dessus du plafond de ${euro(Number(p.limit))}. À partir du 1er janvier ${p.year}, l'entreprise facture la TVA et dépose des déclarations anticipées.`,
  "letter.taxPeriod.subject": (p) => `Période de TVA ${p.year}`,
  "letter.taxPeriod.body": (p) => `À partir du 1er janvier ${p.year}, ${p.name} ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Déclaration anticipée de TVA ${period(p)}`,
  "ledger.vatEstimate": (p) => `Estimation de TVA ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Majoration pour dépôt tardif ${period(p)}`,
  "error.taxNumber": () => "L'entreprise n'a pas encore de numéro fiscal.",
  "error.taxReturn": () => "Cette déclaration n'existe pas.",
  "error.taxNotSmall": () => "L'entreprise n'applique pas le régime de la petite entreprise.",
  "error.taxReturnFiled": () => "Cette déclaration a déjà été déposée.",
} satisfies Dict;
