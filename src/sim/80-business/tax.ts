// docs/design/plans/tax-office.md: the tax office (Finanzamt) and DOHLE, its online filing service.
import { yearOf } from "../00-core/time";
import { post } from "../40-support/letters";
import type { GameState } from "../50-state";
import { newTax, type TaxState } from "./tax-state";

export { newTax, type TaxState };

export const TAX_OFFICE_NAME = "Finanzamt";
export const DOHLE_HOST = "dohle.de";
export const DOHLE_URL = `www.${DOHLE_HOST}/`;
export const ERFASSUNG_URL = `www.${DOHLE_HOST}/erfassung/`;
// Working days: the questionnaire lands two days after the trade office's confirmation, the number five after the answer.
export const ASK_DAYS = 4;
export const NUMBER_DAYS = 5;

const pad = (n: number, len: number) => String(n).padStart(len, "0");
export const taxNumberOf = (seed: number): string => `045 ${pad(100 + (seed % 900), 3)} ${pad(10000 + ((seed * 7919) % 90000), 5)}`;

// The tax number once its letter has arrived, or null.
export const taxNumber = (s: GameState): string | null => (s.tax.numberAt !== null && s.hour >= s.tax.numberAt ? s.tax.number : null);

// The highest prior-year revenue that keeps the small business rule in a year.
export const smallLimit = (year: number): number => (year <= 2019 ? 17_500 : year <= 2024 ? 22_000 : 25_000);

// Saves registered before the tax office hold a tax number with the standard rule and the monthly period.
export const legacyTax = (s: GameState): TaxState => ({ ...newTax(), asked: 0, answered: 0, number: taxNumberOf(s.seed), numberAt: 0, since: yearOf(s.hour) });

// Hourly: once registered, the tax office sends its questionnaire.
export function taxTick(s: GameState): void {
  if (!s.registration || s.tax.asked !== null) return;
  post(s, TAX_OFFICE_NAME, "taxQuestionnaire", { name: s.company.name, limit: smallLimit(yearOf(s.hour)) }, ASK_DAYS, { link: ERFASSUNG_URL });
  s.tax = { ...s.tax, asked: s.hour, since: yearOf(s.hour) };
}

// The answered questionnaire: the tax number follows by letter with the VAT period of the year.
export function answer(s: GameState, expected: number, small: boolean): void {
  const number = taxNumberOf(s.seed);
  const l = post(s, TAX_OFFICE_NAME, "taxNumber", { name: s.company.name, number, period: small ? "none" : "month" }, NUMBER_DAYS);
  s.tax = { ...s.tax, answered: s.hour, expected, small, number, numberAt: l.at };
}
