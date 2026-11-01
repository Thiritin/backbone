// docs/design/plans/billing-by-hand.md, 9b: the banks a company can keep its account at, each a row of numbers and a site skin.
export type BankId = "sparklasse" | "volksbunk" | "deutscheBunk" | "postbunk" | "netbunk" | "fidorr" | "quonto";
// itan asks for a numbered TAN from the paper list, mtan texts a code, push and app take a confirm click.
export type TanMethod = "itan" | "mtan" | "push" | "app";
export type TransferSpeed = "nextDay" | "sameDay" | "instant";

export interface Bank {
  id: BankId;
  name: string;
  host: string;
  // The bank code printed next to the account number before IBAN.
  code: string;
  from: number;
  // The account fee a month by legal form; null where the bank opens no account for that form.
  monthly: { sole: number; partnership: number; limited: number | null };
  // A fee per booking on a partnership's or limited company's account, on top of the monthly fee.
  booking?: number;
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

export const BANKS: Bank[] = [
  { id: "sparklasse", name: "Sparklasse", host: "sparklasse.de", code: "50050201", from: 2005, monthly: { sole: 8, partnership: 12, limited: 16 }, booking: 0.3, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2009, label: "mtan" }, { method: "push", from: 2014, label: "push" }],
    card: { yearly: 30, factor: 1.5 }, overdraft: 0.11, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.6 0.2 30)", accent: "oklch(0.55 0.2 30)", bg: "oklch(0.98 0.01 60)", frame: "branch", redesign: 2013 } },
  { id: "volksbunk", name: "Folksbank", host: "folksbank.de", code: "50190000", from: 2005, monthly: { sole: 6, partnership: 9, limited: 12 }, booking: 0.25, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2007, label: "reader" }],
    card: { yearly: 25, factor: 1 }, overdraft: 0.1, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.42 0.15 260)", accent: "oklch(0.68 0.17 55)", bg: "oklch(0.97 0.01 250)", frame: "frames", redesign: 2015 } },
  { id: "deutscheBunk", name: "Deutsche Bunk", host: "deutsche-bunk.de", code: "50070010", from: 2005, monthly: { sole: 12, partnership: 18, limited: 24 }, booking: 0.15, speed: "sameDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2012, label: "photo" }],
    card: { yearly: 60, factor: 2 }, overdraft: 0.13, loans: { factor: 1.5, min: 50_000 }, hbci: false, api: null,
    skin: { bar: "oklch(0.35 0.12 255)", accent: "oklch(0.45 0.14 255)", bg: "oklch(0.99 0 0)", frame: "corporate", redesign: 2011 } },
  { id: "postbunk", name: "Postbanq", host: "postbanq.de", code: "10010010", from: 2005, monthly: { sole: 4, partnership: 6, limited: 8 }, booking: 0.4, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, factor: 1 }, overdraft: 0.12, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.86 0.17 95)", accent: "oklch(0.45 0.1 255)", bg: "oklch(0.99 0.02 95)", frame: "plain", redesign: 2016 } },
  { id: "netbunk", name: "Ding-DiBa", host: "ding-diba.de", code: "50010060", from: 2005, monthly: { sole: 0, partnership: 5, limited: null }, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, freeFirstYear: true, factor: 1 }, overdraft: 0.09, loans: { factor: 0, min: 0 }, hbci: true, api: null,
    skin: { bar: "oklch(0.5 0.13 150)", accent: "oklch(0.45 0.13 150)", bg: "oklch(0.98 0.01 150)", frame: "web", redesign: 2010 } },
  { id: "fidorr", name: "Fidorr", host: "fidorr.de", code: "70022200", from: 2009, monthly: { sole: 0, partnership: 6, limited: 12 }, speed: "instant",
    tans: [{ method: "mtan", from: 2009, label: "mtan" }],
    card: { yearly: 0, factor: 1 }, overdraft: 0.14, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: 2013,
    skin: { bar: "oklch(0.3 0.03 280)", accent: "oklch(0.65 0.2 340)", bg: "oklch(0.98 0.005 280)", frame: "startup", redesign: 2014 } },
  { id: "quonto", name: "Quonto", host: "quonto.eu", code: "16220000", from: 2016, monthly: { sole: 9, partnership: 15, limited: 25 }, speed: "instant",
    tans: [{ method: "app", from: 2016, label: "app" }],
    card: { yearly: 0, factor: 1 }, overdraft: null, loans: { factor: 0, min: 0 }, hbci: false, api: 2016,
    skin: { bar: "oklch(0.25 0.02 260)", accent: "oklch(0.6 0.15 280)", bg: "oklch(0.99 0 0)", frame: "fintech", redesign: 2016 } },
];

export const TRANSFER_HOURS: Record<TransferSpeed, number> = { nextDay: 24, sameDay: 4, instant: 0 };
// The bank saves from before banks keep their account at.
export const DEFAULT_BANK: BankId = "sparklasse";

export const bankById = (id: string): Bank | undefined => BANKS.find((b) => b.id === id);
export const banksOpen = (year: number): Bank[] => BANKS.filter((b) => b.from <= year);
export const monthlyFee = (b: Bank, form: string): number | null => b.monthly[form as keyof Bank["monthly"]] ?? null;
// Bookings cost extra on business accounts only.
export const bookingFee = (b: Bank, form: string): number => (form === "sole" ? 0 : b.booking ?? 0);
// The TAN methods a bank offers in a year, newest last.
export const tanMethods = (b: Bank, year: number) => b.tans.filter((x) => x.from <= year);
// From 2008 transfers name an IBAN, before an account number and bank code.
export const IBAN_YEAR = 2008;
