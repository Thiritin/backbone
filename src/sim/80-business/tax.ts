// docs/design/plans/tax-office.md: the tax office (Finanzamt) and DOHLE, its online filing service.
import { dateOf, hourOf, isMonthStart, monthIndexOf, yearOf } from "../00-core/time";
import { post } from "../40-support/letters";
import { deliverMail } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import { newTax, type TaxReturn, type TaxState } from "./tax-state";

export { newTax, type TaxReturn, type TaxState };

export const TAX_OFFICE_NAME = "Finanzamt";
export const DOHLE_NAME = "DOHLE";
export const CERT_FILE = "dohle-zertifikat.pfx";
export const FORMULAR_APP = "DohleFormular";
// The activation code's letter takes two working days, three on one registration in three.
export const CODE_DAYS = 2;
export const DOHLE_HOST = "dohle.de";
export const DOHLE_URL = `www.${DOHLE_HOST}/`;
export const ERFASSUNG_URL = `www.${DOHLE_HOST}/erfassung/`;
// Working days: the questionnaire lands two days after the trade office's confirmation, the number five after the answer.
export const ASK_DAYS = 2;
export const NUMBER_DAYS = 5;

const pad = (n: number, len: number) => String(n).padStart(len, "0");
export const taxNumberOf = (seed: number): string => `045 ${pad(100 + (seed % 900), 3)} ${pad(10000 + ((seed * 7919) % 90000), 5)}`;

// The tax number once its letter has arrived, or null.
export const taxNumber = (s: GameState): string | null => (s.tax.numberAt !== null && s.hour >= s.tax.numberAt ? s.tax.number : null);

// The highest prior-year revenue that keeps the small business rule in a year.
export const smallLimit = (year: number): number => (year <= 2019 ? 17_500 : year <= 2024 ? 22_000 : 25_000);

// Saves registered before the tax office hold a tax number with the standard rule and the monthly period.
export const legacyTax = (s: GameState): TaxState => ({ ...newTax(), asked: 0, answered: 0, number: taxNumberOf(s.seed), numberAt: 0, since: yearOf(s.hour), checked: yearOf(s.hour) });

// Hourly: once registered, the tax office sends its questionnaire, opens a return for each VAT period that ends, checks
// the small business rule each January and chases returns that are late.
export function taxTick(s: GameState): void {
  if (!s.registration) return;
  if (s.tax.asked === null) {
    post(s, TAX_OFFICE_NAME, "taxQuestionnaire", { name: s.company.name, limit: smallLimit(yearOf(s.hour)) }, ASK_DAYS, { link: ERFASSUNG_URL });
    s.tax = { ...s.tax, asked: s.hour, since: yearOf(s.hour) };
  }
  if (isMonthStart(s.hour)) {
    openVatReturn(s);
    const year = yearOf(s.hour);
    if (s.tax.checked < year) january(s, year);
  }
  chase(s);
}

// The answered questionnaire: the tax number follows by letter with the VAT period of the year.
export function answer(s: GameState, expected: number, small: boolean): void {
  const number = taxNumberOf(s.seed);
  const l = post(s, TAX_OFFICE_NAME, "taxNumber", { name: s.company.name, number, period: small ? "none" : "month" }, NUMBER_DAYS);
  // A small business owes no advance returns, including the ones opened before the answer.
  const returns = small ? s.tax.returns.filter((r) => r.kind !== "vat" || r.filedAt !== null) : s.tax.returns;
  s.tax = { ...s.tax, answered: s.hour, expected, small, number, numberAt: l.at, returns };
}

const cents = (v: number) => Math.round(v * 100) / 100;
const yearStart = (year: number) => hourOf(new Date(Date.UTC(year, 0, 1)));
const addMonths = (hour: number, months: number) => {
  const d = dateOf(hour);
  return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), d.getUTCHours())));
};
export const monthsOf = (r: Pick<TaxReturn, "from" | "to">): number => monthIndexOf(r.to) - monthIndexOf(r.from);

// Sales carry output VAT and these purchases input VAT; salaries, insurance, loans, capital, fees and taxes carry none.
export const OUTPUT_CATEGORIES = ["payments", "setup", "sales"];
export const INPUT_CATEGORIES = ["hardware", "rent", "power", "transit", "licenses", "subscriptions", "marketing", "maintenance", "domains", "leasing", "moving", "ai"];

// 16% to 2006, 19% from 2007, 16% again from July to December 2020.
export function vatRate(hour: number): number {
  const d = dateOf(hour), y = d.getUTCFullYear();
  return y < 2007 || (y === 2020 && d.getUTCMonth() >= 6) ? 0.16 : 0.19;
}

// Prices are gross: an amount of a holds a × r / (1 + r) of VAT.
const vatIn = (e: LedgerEntry) => (e.amount * vatRate(e.hour)) / (1 + vatRate(e.hour));
export function vatBetween(s: GameState, from: number, to: number): { output: number; input: number; payable: number } {
  let output = 0, input = 0;
  for (const e of s.ledger) {
    if (e.hour < from || e.hour >= to) continue;
    if (OUTPUT_CATEGORIES.includes(e.category)) output += vatIn(e);
    else if (INPUT_CATEGORIES.includes(e.category)) input -= vatIn(e);
  }
  return { output: cents(output), input: cents(input), payable: cents(output - input) };
}
export const revenueBetween = (s: GameState, from: number, to: number): number =>
  cents(s.ledger.filter((e) => e.hour >= from && e.hour < to && OUTPUT_CATEGORIES.includes(e.category)).reduce((n, e) => n + e.amount, 0));

// The advance return period of a year: none for a small business, monthly in the first two years, then by last year's VAT.
export type VatPeriod = "month" | "quarter" | "year" | "none";
export function vatPeriod(s: GameState, year: number): VatPeriod {
  if (s.tax.small) return "none";
  if (year <= s.tax.since + 1) return "month";
  const prior = vatBetween(s, yearStart(year - 1), yearStart(year)).payable;
  const [monthly, quarterly] = year >= 2025 ? [9000, 2000] : year >= 2009 ? [7500, 1000] : [6136, 512];
  return prior > monthly ? "month" : prior > quarterly ? "quarter" : "year";
}

// Due the 10th of the month after the period; the surcharge is 5% of the payable, the estimate 1.5 times it.
export const DUE_DAYS = 10;
export const SURCHARGE = { share: 0.05, min: 25 };
export const ESTIMATE = { factor: 1.5, min: 100, months: 1 };

function openVatReturn(s: GameState): void {
  const d = dateOf(s.hour), month = d.getUTCMonth(), from1 = addMonths(s.hour, -1);
  const period = vatPeriod(s, yearOf(from1));
  const months = period === "month" ? 1 : period === "quarter" && month % 3 === 0 ? 3 : 0;
  if (!months || s.registration!.hour >= s.hour) return;
  const from = addMonths(s.hour, -months);
  const r: TaxReturn = { id: `tax${s.nextId++}`, kind: "vat", year: yearOf(from), from, to: s.hour, dueAt: s.hour + DUE_DAYS * 24, filedAt: null, booked: 0, late: false, estimate: null };
  s.tax = { ...s.tax, returns: [...s.tax.returns, r] };
}

// On 1 January a small business whose revenue last year passed the limit loses the rule; a changed period is announced.
function january(s: GameState, year: number): void {
  const before = vatPeriod(s, year - 1);
  if (s.tax.small && year > s.tax.since) {
    const revenue = revenueBetween(s, yearStart(year - 1), yearStart(year)), limit = smallLimit(year);
    if (revenue > limit) {
      s.tax = { ...s.tax, small: false };
      post(s, TAX_OFFICE_NAME, "taxSmallEnd", { name: s.company.name, year, revenue, limit, number: s.tax.number }, 1);
    }
  }
  const after = vatPeriod(s, year);
  if (year > s.tax.since && after !== before) post(s, TAX_OFFICE_NAME, "taxPeriod", { name: s.company.name, year, period: after, number: s.tax.number }, 1);
  s.tax = { ...s.tax, checked: year };
}

const update = (s: GameState, id: string, patch: Partial<TaxReturn>) => {
  s.tax = { ...s.tax, returns: s.tax.returns.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
};

// An open VAT return past its due date costs a surcharge the next day and an estimate a month later.
function chase(s: GameState): void {
  for (const r of s.tax.returns) {
    if (r.filedAt !== null || r.kind !== "vat") continue;
    const payable = () => vatBetween(s, r.from, r.to).payable;
    const params = { from: r.from, months: monthsOf(r), deadline: r.dueAt, taxNo: s.tax.number };
    if (!r.late && s.hour >= r.dueAt) {
      const fee = Math.max(SURCHARGE.min, cents(SURCHARGE.share * Math.max(0, payable())));
      post(s, TAX_OFFICE_NAME, "taxSurcharge", params, 1, { bill: { supplier: "tax", lines: [{ hour: s.hour, category: "tax", key: "ledger.taxSurcharge", params: { from: r.from, months: monthsOf(r) }, amount: -fee }], days: 14 } });
      update(s, r.id, { late: true });
    }
    if (r.estimate === null && s.hour >= addMonths(r.dueAt, ESTIMATE.months)) {
      const amount = Math.max(ESTIMATE.min, cents(ESTIMATE.factor * payable()));
      const l = post(s, TAX_OFFICE_NAME, "vatEstimate", params, 1, { bill: { supplier: "tax", lines: [{ hour: s.hour, category: "vat", key: "ledger.vatEstimate", params: { from: r.from, months: monthsOf(r) }, amount: -amount }], days: 14 } });
      update(s, r.id, { estimate: l.id });
    }
  }
}

// What the estimate already took: its open bill is withdrawn, a paid part counts toward the return.
function withdrawEstimate(s: GameState, r: TaxReturn): number {
  const l = r.estimate ? s.letters.find((x) => x.id === r.estimate) : undefined;
  if (!l) return 0;
  if (!l.arrived) {
    s.letters = s.letters.filter((x) => x.id !== l.id);
    return 0;
  }
  const p = s.payables.find((x) => x.id === l.payable);
  if (!p) return 0;
  if (p.paidAt === null) s.payables = s.payables.filter((x) => x.id !== p.id);
  return p.sent;
}

const book = (s: GameState, category: string, key: string, params: LedgerEntry["params"], amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category, key, params, amount }];
};

// Filing an advance return books its payable at once, a refund when input VAT is larger, less what an estimate took.
export function fileVat(s: GameState, r: TaxReturn): number {
  const payable = vatBetween(s, r.from, r.to).payable;
  const due = cents(payable - withdrawEstimate(s, r));
  if (due !== 0) book(s, "vat", "ledger.vatReturn", { from: r.from, months: monthsOf(r) }, -due);
  update(s, r.id, { filedAt: s.hour, booked: payable });
  return payable;
}

// The certificate is valid while its document is on the desktop; a new registration revokes it.
export const certOk = (s: GameState): boolean => !!s.tax.cert && s.docs.some((d) => d.id === s.tax.cert && d.kind === "cert");

const code36 = (n: number, len: number) => (Math.abs(Math.floor(n)) % 36 ** len).toString(36).toUpperCase().padStart(len, "0");
export const normalCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

// A registration: the activation ID by email at once, the code by letter, and the old certificate revoked.
export function registerDohle(s: GameState): void {
  const n = s.seed * 7919 + s.nextId * 104_729;
  const id = `${code36(n, 4)}-${code36(n / 7, 4)}`, code = `${code36(n * 13, 4)}-${code36(n * 17, 4)}-${code36(n * 19, 4)}`;
  deliverMail(s, DOHLE_NAME, "dohleId", { id, number: s.tax.number });
  const days = CODE_DAYS + (n % 3 === 0 ? 1 : 0);
  const l = post(s, DOHLE_NAME, "dohleCode", { code, number: s.tax.number }, days);
  s.tax = { ...s.tax, dohleId: id, dohleCode: code, codeAt: l.at, cert: null };
}
