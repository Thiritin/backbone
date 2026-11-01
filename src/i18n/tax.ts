import { euro } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// The tax office's letters and DOHLE's answers, the tax bookings and the filing errors.
export const TAX_EN: Record<string, (p: Params) => string> = {
  "letter.taxQuestionnaire.subject": () => "Questionnaire for tax registration",
  "letter.taxQuestionnaire.body": (p) => `The trade office has informed us that ${p.name} has started a business. Please answer the questionnaire for tax registration on DOHLE at www.dohle.de/erfassung/. A business whose revenue stays under ${euro(Number(p.limit))} a year may use the small business rule and charge no VAT.`,
  "letter.taxNumber.subject": (p) => `Your tax number ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} is registered with us under tax number ${p.number}. Please quote it on every return and letter. ${p.period === "none" ? "As a small business you charge no VAT and file no advance VAT returns." : "Please file an advance VAT return for every month by the 10th of the following month."}`,

  "sim.index.dohle": () => "File tax returns online with the tax office.",

  "error.taxNoQuestionnaire": () => "The questionnaire from the tax office has not arrived yet.",
  "error.taxAnswered": () => "The questionnaire has already been sent.",
  "error.taxRevenue": () => "Enter the expected revenue.",
  "error.taxSmallLimit": () => "The expected revenue is above the limit of the small business rule.",
};
