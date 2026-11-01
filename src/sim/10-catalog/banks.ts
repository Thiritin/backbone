// docs/design/plans/billing-by-hand.md, 9b: the banks a company can keep its account at, each a row of numbers and a site skin.
export type BankId = "sparklasse" | "volksbunk" | "deutscheBunk" | "postbunk" | "netbunk" | "fidorr" | "quonto";
// itan asks for a numbered TAN from the paper list, mtan texts a code, push and app take a confirm click.
export type TanMethod = "itan" | "mtan" | "push" | "app";
export type TransferSpeed = "nextDay" | "sameDay" | "instant";

export type PlanId = "giro" | "business" | "businessPlus" | "premium";
// free bookings a month, then booking each; card "included" saves the yearly fee, "double" also doubles the limit.
export interface Plan { id: PlanId; name: string; forms: string[]; monthly: number; free: number; booking: number; card?: "included" | "double" }

export interface Bank {
  id: BankId;
  name: string;
  host: string;
  // The bank code printed next to the account number before IBAN.
  code: string;
  from: number;
  // docs/design/plans/bank-plans.md: the account plans, cheapest first. A limited company pays limited times the plan's fee.
  plans: Plan[];
  limited: number;
  // Added to every loan's interest rate.
  margin: number;
  speed: TransferSpeed;
  // TAN methods by the year they arrive; label names the method on the bank's site.
  tans: { method: TanMethod; from: number; label: string }[];
  // Card fee a year, free the first year, and the limit as a multiple of the average monthly income.
  card: { yearly: number; freeFirstYear?: true; factor: number };
  // Overdraft interest a year; null for no overdraft.
  overdraft: number | null;
  // Multiplies the loan limit; min is the smallest loan the bank grants.
  loans: { factor: number; min: number };
  // HBCI without the module, and the year an API makes it the same.
  hbci: boolean;
  api: number | null;
  // redesign is the year the site trades its 2005 look for a flat one.
  skin: { bar: string; accent: string; bg: string; frame: "branch" | "frames" | "corporate" | "plain" | "web" | "startup" | "fintech"; redesign: number };
}

const ALL = ["sole", "partnership", "limited"];
const giro = (monthly: number): Plan => ({ id: "giro", name: "Giro", forms: ["sole"], monthly, free: 0, booking: 0 });
const business = (monthly: number, booking: number, name = "Business", forms = ALL): Plan => ({ id: "business", name, forms, monthly, free: 20, booking });
const plus = (fee: number, booking: number, name = "Business Plus"): Plan =>
  ({ id: "businessPlus", name, forms: ALL, monthly: 2 * fee, free: 100, booking: Math.round((booking / 3) * 100) / 100, card: "included" });
const premium = (fee: number): Plan => ({ id: "premium", name: "Premium", forms: ["partnership", "limited"], monthly: 4 * fee, free: 0, booking: 0, card: "double" });
// The traditional banks: Giro at the sole trader fee (none where sole is null), Business at the partnership fee and up.
const ladder = (sole: number | null, fee: number, booking: number): Plan[] =>
  [...(sole === null ? [] : [giro(sole)]), business(fee, booking), plus(fee, booking), premium(fee)];

export const BANKS: Bank[] = [
  { id: "sparklasse", name: "Sparklasse", host: "sparklasse.de", code: "50050201", from: 2005, plans: ladder(8, 12, 0.3), limited: 4 / 3, margin: 0.005, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2009, label: "mtan" }, { method: "push", from: 2014, label: "push" }],
    card: { yearly: 30, factor: 1.5 }, overdraft: 0.11, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.6 0.2 30)", accent: "oklch(0.55 0.2 30)", bg: "oklch(0.98 0.01 60)", frame: "branch", redesign: 2013 } },
  { id: "volksbunk", name: "Folksbank", host: "folksbank.de", code: "50190000", from: 2005, plans: ladder(6, 9, 0.25), limited: 4 / 3, margin: 0.005, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2007, label: "reader" }],
    card: { yearly: 25, factor: 1 }, overdraft: 0.1, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.42 0.15 260)", accent: "oklch(0.68 0.17 55)", bg: "oklch(0.97 0.01 250)", frame: "frames", redesign: 2015 } },
  { id: "deutscheBunk", name: "Deutsche Bunk", host: "deutsche-bunk.de", code: "50070010", from: 2005, plans: ladder(null, 18, 0.15), limited: 4 / 3, margin: 0, speed: "sameDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2012, label: "photo" }],
    card: { yearly: 60, factor: 2 }, overdraft: 0.13, loans: { factor: 1.5, min: 50_000 }, hbci: false, api: null,
    skin: { bar: "oklch(0.35 0.12 255)", accent: "oklch(0.45 0.14 255)", bg: "oklch(0.99 0 0)", frame: "corporate", redesign: 2011 } },
  { id: "postbunk", name: "Postbanq", host: "postbanq.de", code: "10010010", from: 2005, plans: ladder(4, 6, 0.4), limited: 4 / 3, margin: 0.015, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, factor: 1 }, overdraft: 0.12, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.86 0.17 95)", accent: "oklch(0.45 0.1 255)", bg: "oklch(0.99 0.02 95)", frame: "plain", redesign: 2016 } },
  { id: "netbunk", name: "Ding-DiBa", host: "ding-diba.de", code: "50010060", from: 2005, plans: [giro(0), business(5, 0, "Business", ["sole", "partnership"])], limited: 1, margin: 0.01, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, freeFirstYear: true, factor: 1 }, overdraft: 0.09, loans: { factor: 0, min: 0 }, hbci: true, api: null,
    skin: { bar: "oklch(0.5 0.13 150)", accent: "oklch(0.45 0.13 150)", bg: "oklch(0.98 0.01 150)", frame: "web", redesign: 2010 } },
  { id: "fidorr", name: "Fidorr", host: "fidorr.de", code: "70022200", from: 2009, plans: [business(6, 0, "Fidorr Start"), plus(6, 0, "Fidorr Pro")], limited: 2, margin: 0.02, speed: "instant",
    tans: [{ method: "mtan", from: 2009, label: "mtan" }],
    card: { yearly: 0, factor: 1 }, overdraft: 0.14, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: 2013,
    skin: { bar: "oklch(0.3 0.03 280)", accent: "oklch(0.65 0.2 340)", bg: "oklch(0.98 0.005 280)", frame: "startup", redesign: 2014 } },
  { id: "quonto", name: "Quonto", host: "quonto.eu", code: "16220000", from: 2016, plans: [business(15, 0, "Quonto Essential"), plus(15, 0, "Quonto Smart")], limited: 5 / 3, margin: 0.015, speed: "instant",
    tans: [{ method: "app", from: 2016, label: "app" }],
    card: { yearly: 0, factor: 1 }, overdraft: null, loans: { factor: 0, min: 0 }, hbci: false, api: 2016,
    skin: { bar: "oklch(0.25 0.02 260)", accent: "oklch(0.6 0.15 280)", bg: "oklch(0.99 0 0)", frame: "fintech", redesign: 2016 } },
];

// Payments to an account the company left still arrive for three months.
export const PREVIOUS_HOURS = 3 * 730;
export const TRANSFER_HOURS: Record<TransferSpeed, number> = { nextDay: 24, sameDay: 4, instant: 0 };
// The receiving bank returns a transfer to an account that does not exist within three banking days of arrival, without a fee.
export const RETURN_DAYS: [number, number] = [1, 3];
// The bank saves from before banks keep their account at.
export const DEFAULT_BANK: BankId = "sparklasse";

export const bankById = (id: string): Bank | undefined => BANKS.find((b) => b.id === id);
export const banksOpen = (year: number): Bank[] => BANKS.filter((b) => b.from <= year);
export const planById = (b: Bank, id: string): Plan | undefined => b.plans.find((p) => p.id === id);
export const plansFor = (b: Bank, form: string): Plan[] => b.plans.filter((p) => p.forms.includes(form));
// The cheapest plan for the form; a form no plan serves (a limited company at Ding-DiBa in old saves) keeps Business.
export const defaultPlan = (b: Bank, form: string): PlanId => plansFor(b, form)[0]?.id ?? "business";
export const monthlyFee = (b: Bank, plan: string, form: string): number =>
  Math.round((planById(b, plan)?.monthly ?? 0) * (form === "limited" ? b.limited : 1) * 100) / 100;
export const bookingFee = (b: Bank, plan: string): number => planById(b, plan)?.booking ?? 0;
// The TAN methods a bank offers in a year, newest last.
export const tanMethods = (b: Bank, year: number) => b.tans.filter((x) => x.from <= year);
// From 2008 transfers name an IBAN, before an account number and bank code.
export const IBAN_YEAR = 2008;

// Interest a year on a business account's balance, by year, after the ECB rate; later years keep the last. Negative years charge a custody fee above the allowance.
const DEPOSIT_RATES: Record<number, number> = {
  2005: 0.015, 2006: 0.02, 2007: 0.03, 2008: 0.03, 2009: 0.01, 2010: 0.0075, 2011: 0.01, 2012: 0.005, 2013: 0.0025, 2014: 0.001,
  2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: -0.005, 2021: -0.005, 2022: 0.0025, 2023: 0.025, 2024: 0.0275, 2025: 0.0175, 2026: 0.015,
};
export const CUSTODY_ALLOWANCE = 100_000;
export const depositRate = (year: number): number => DEPOSIT_RATES[Math.min(Math.max(year, 2005), 2026)];
