// docs/design/plans/company-paperwork.md: the legal form only moves up, by a signed application the player emails to the
// trade office (partnership) or the notary (limited company); the answer comes back by letter, with the fees.
import { yearOf } from "../00-core/time";
import { bankById } from "../10-catalog/banks";
import { monthlyFee } from "../10-catalog/banks";
import { COMPANY_LAW_SKILL } from "../10-catalog/research";
import { post } from "../40-support/letters";
import type { SupplierId } from "../46-finance/payables";
import type { GameState, LedgerEntry } from "../50-state";
import { OFFICE_HOST } from "./office";

export const FORM_RANK: Record<string, number> = { sole: 0, partnership: 1, limited: 2 };
export const OFFICE_NAME = "Gewerbeamt";
export const NOTARY_NAME = "Dr. Ilse Stempel";
export const REGISTER_NAME = "Handelsregistrar";
export const CHAMBER_NAME = "IHQ";
export const OFFICE_MAIL = `eservice@${OFFICE_HOST}`;
export const NOTARY_MAIL = "kanzlei@stempel-notary.de";
// Who takes the application for each form.
export const FILED_WITH: Record<string, string> = { partnership: OFFICE_MAIL, limited: NOTARY_MAIL };

export const FEES = { registration: 26, change: 30, notary: 650, register: 150 };
export const SHARE_CAPITAL = 25_000;
// Working days: the notary files within FILE_DAYS, the register enters the company REGISTER_DAYS after the filing.
export const FILE_DAYS = 3;
export const REGISTER_DAYS = 10;
export const OFFICE_DAYS = 3;
export const CHAMBER_DAYS = 10;

// The chamber's basic yearly fee by employee count; a company in the commercial register pays the higher row.
export const CHAMBER_TIERS: { upTo: number; trader: number; registered: number }[] = [
  { upTo: 2, trader: 40, registered: 150 },
  { upTo: 9, trader: 90, registered: 300 },
  { upTo: 49, trader: 250, registered: 700 },
  { upTo: Infinity, trader: 600, registered: 1600 },
];
export function chamberFee(s: GameState): number {
  const tier = CHAMBER_TIERS.find((x) => s.staff.length <= x.upTo)!;
  return s.registration?.form === "limited" ? tier.registered : tier.trader;
}

const fee = (s: GameState, key: string, amount: number, params: LedgerEntry["params"] = {}): LedgerEntry => ({ hour: s.hour, category: "fees", key, params, amount: -amount });
const bill = (s: GameState, supplier: SupplierId, key: string, amount: number, params: LedgerEntry["params"] = {}) => ({ supplier, lines: [fee(s, key, amount, params)], days: 14 });

// A change waits for its last letter; until then no second application is taken.
export const changePending = (s: GameState): boolean => s.letters.some((l) => l.form && !l.arrived);

// Why the company cannot apply for this form now, or null.
export function applyError(s: GameState, form: string): string | null {
  if (!s.registration) return "error.notRegistered";
  if (!(form in FORM_RANK)) return "error.legalForm";
  if (FORM_RANK[form] <= FORM_RANK[s.registration.form]) return "error.legalFormDown";
  if (form === "limited" && !s.unlocks.includes(COMPANY_LAW_SKILL)) return "error.companyLaw";
  if (changePending(s)) return "error.changePending";
  const bank = s.bank && bankById(s.bank.id);
  if (bank && monthlyFee(bank, form) === null) return "error.bankForm";
  return null;
}

// The filed application: the trade office confirms a partnership by letter with its fee; the notary bills its fee, and
// the register enters the company and bills its entry afterwards.
export function file(s: GameState, form: string): void {
  const name = s.company.name;
  if (form === "partnership") {
    post(s, OFFICE_NAME, "officeChange", { name, form }, OFFICE_DAYS, { form, bill: bill(s, "office", "ledger.tradeChange", FEES.change) });
    return;
  }
  post(s, NOTARY_NAME, "notaryInvoice", { name }, 2, { bill: bill(s, "notary", "ledger.notary", FEES.notary) });
  post(s, REGISTER_NAME, "registerEntry", { name, form }, FILE_DAYS + REGISTER_DAYS, { form });
  post(s, REGISTER_NAME, "registerInvoice", { name }, FILE_DAYS + REGISTER_DAYS + 3, { bill: bill(s, "register", "ledger.registerEntry", FEES.register) });
}

// Hourly: once registered, the trade office confirms the registration with its fee, and the chamber bills its basic fee
// each calendar year from the year of registration on.
export function paperworkTick(s: GameState): void {
  if (!s.registration) return;
  const year = yearOf(s.hour);
  if (s.chamberYear >= year) return;
  if (s.chamberYear === 0) post(s, OFFICE_NAME, "officeRegistered", { name: s.company.name, reg: s.registration.number }, 2, { bill: bill(s, "office", "ledger.tradeRegistration", FEES.registration) });
  const amount = chamberFee(s);
  post(s, CHAMBER_NAME, "chamberFee", { name: s.company.name, year, staff: s.staff.length }, CHAMBER_DAYS, { bill: bill(s, "chamber", "ledger.chamber", amount, { year }) });
  s.chamberYear = year;
}
