import { euro, euroCents } from "../sim/00-core/money";
import { dateOf } from "../sim/00-core/time";
import { LOCALE } from "./lang";

type Params = Record<string, string | number>;
export const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monthName = (hour: number, year = false) => dateOf(hour).toLocaleDateString(LOCALE, { month: "long", ...(year && { year: "numeric" }), timeZone: "UTC" });
// A return's period from its first hour and length in months: a month, a span of months or a year.
export function period(p: Params): string {
  const from = Number(p.from), months = Number(p.months), year = dateOf(from).getUTCFullYear();
  if (months >= 12) return String(year);
  if (months <= 1) return monthName(from, true);
  return `${monthName(from)}–${monthName(from + (months - 1) * 31 * 24)} ${year}`;
}
const pay = (p: Params) => `Please transfer ${euroCents(Number(p.amount))} by ${day(p.due)} to ${p.iban ? `IBAN ${p.iban}` : `account ${p.account}, bank code ${p.code}`}, quoting reference ${p.number}.`;
const PERIOD: Record<string, string> = {
  month: "files an advance VAT return every month, due by the 10th of the following month",
  quarter: "files an advance VAT return every quarter, due by the 10th of the month after the quarter",
  year: "files no advance VAT returns and settles the VAT with the yearly return",
  none: "charges no VAT and files no advance VAT returns",
};

// The tax office's letters and DOHLE's answers, the tax bookings and the filing errors.
export const TAX_EN: Record<string, (p: Params) => string> = {
  "letter.taxQuestionnaire.subject": () => "Questionnaire for tax registration",
  "letter.taxQuestionnaire.body": (p) => `The trade office has informed us that ${p.name} has started a business. Please answer the questionnaire for tax registration on DOHLE at www.dohle.de/erfassung/. A business whose revenue stays under ${euro(Number(p.limit))} a year may use the small business rule and charge no VAT.`,
  "letter.taxNumber.subject": (p) => `Your tax number ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} is registered with us under tax number ${p.number}. Please quote it on every return and letter. ${p.period === "none" ? "As a small business you charge no VAT and file no advance VAT returns." : "Please file an advance VAT return for every month by the 10th of the following month."}`,

  "letter.taxSurcharge.subject": () => "Late filing surcharge",
  "letter.taxSurcharge.body": (p) => `Tax number ${p.taxNo}. The advance VAT return for ${period(p)} was due on ${day(p.deadline)} and has not reached us. We set a late filing surcharge of ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `VAT estimate for ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Tax number ${p.taxNo}. The advance VAT return for ${period(p)} has still not been filed, so we have estimated the VAT at ${euroCents(Number(p.amount))}. Filing the return replaces this estimate. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "End of the small business rule",
  "letter.taxSmallEnd.body": (p) => `The revenue of ${p.name} was ${euro(Number(p.revenue))} last year, above the limit of ${euro(Number(p.limit))}. From 1 January ${p.year} the company charges VAT and files advance VAT returns.`,
  "letter.taxPeriod.subject": (p) => `VAT period ${p.year}`,
  "letter.taxPeriod.body": (p) => `From 1 January ${p.year}, ${p.name} ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Advance VAT return ${period(p)}`,
  "ledger.vatEstimate": (p) => `VAT estimate ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Late filing surcharge ${period(p)}`,

  "sim.index.dohle": () => "File tax returns online with the tax office.",

  "error.taxNoQuestionnaire": () => "The questionnaire from the tax office has not arrived yet.",
  "error.taxAnswered": () => "The questionnaire has already been sent.",
  "error.taxRevenue": () => "Enter the expected revenue.",
  "error.taxNumber": () => "The company has no tax number yet.",
  "error.taxReturn": () => "This return does not exist.",
  "error.taxNotSmall": () => "The company does not use the small business rule.",
  "error.taxReturnFiled": () => "This return has already been filed.",
  "error.taxSmallLimit": () => "The expected revenue is above the limit of the small business rule.",
  "ticket.mail.dohleId.subject": () => "Your DOHLE registration",
  "ticket.mail.dohleId.text": (p) => `Thank you for registering for tax number ${p.number}. Your activation ID is ${p.id}. The activation code follows by post. Enter both on www.dohle.de/registrieren/ to receive your certificate file.`,
  "letter.dohleCode.subject": () => "Your DOHLE activation code",
  "letter.dohleCode.body": (p) => `For your registration with tax number ${p.number} the activation code is ${p.code}. Enter it together with the activation ID from our email on www.dohle.de/registrieren/.`,
  "error.dohleCert": () => "The DOHLE certificate file was not found on the desktop.",
  "error.dohleTaxNumber": () => "The tax number does not match.",
  "error.dohleMail": () => "Enter the company's email address.",
  "error.dohleNoCode": () => "The activation code has not arrived yet.",
  "error.dohleCode": () => "The activation ID or code is wrong.",
};
