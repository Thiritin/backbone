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
  monthly: number;
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
  skin: { bar: string; accent: string; bg: string; frame: "branch" | "frames" | "corporate" | "plain" | "web" | "startup" | "fintech" };
}

export const BANKS: Bank[] = [
  { id: "sparklasse", name: "Sparklasse", host: "sparklasse.de", code: "50050201", from: 2005, monthly: 8, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2009, label: "mtan" }, { method: "push", from: 2014, label: "push" }],
    card: { yearly: 30, factor: 1.5 }, overdraft: 0.11, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.6 0.2 30)", accent: "oklch(0.55 0.2 30)", bg: "oklch(0.98 0.01 60)", frame: "branch" } },
  { id: "volksbunk", name: "Volksbunk", host: "volksbunk.de", code: "50190000", from: 2005, monthly: 6, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2007, label: "reader" }],
    card: { yearly: 25, factor: 1 }, overdraft: 0.1, loans: { factor: 1, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.42 0.15 260)", accent: "oklch(0.68 0.17 55)", bg: "oklch(0.97 0.01 250)", frame: "frames" } },
  { id: "deutscheBunk", name: "Deutsche Bunk", host: "deutsche-bunk.de", code: "50070010", from: 2005, monthly: 12, speed: "sameDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "push", from: 2012, label: "photo" }],
    card: { yearly: 60, factor: 2 }, overdraft: 0.13, loans: { factor: 1.5, min: 50_000 }, hbci: false, api: null,
    skin: { bar: "oklch(0.35 0.12 255)", accent: "oklch(0.45 0.14 255)", bg: "oklch(0.99 0 0)", frame: "corporate" } },
  { id: "postbunk", name: "Postbunk", host: "postbunk.de", code: "10010010", from: 2005, monthly: 4, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, factor: 1 }, overdraft: 0.12, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: null,
    skin: { bar: "oklch(0.86 0.17 95)", accent: "oklch(0.45 0.1 255)", bg: "oklch(0.99 0.02 95)", frame: "plain" } },
  { id: "netbunk", name: "netbunk", host: "netbunk.de", code: "50010060", from: 2005, monthly: 0, speed: "nextDay",
    tans: [{ method: "itan", from: 2005, label: "itan" }, { method: "mtan", from: 2008, label: "mtan" }],
    card: { yearly: 20, freeFirstYear: true, factor: 1 }, overdraft: 0.09, loans: { factor: 0, min: 0 }, hbci: true, api: null,
    skin: { bar: "oklch(0.5 0.13 150)", accent: "oklch(0.45 0.13 150)", bg: "oklch(0.98 0.01 150)", frame: "web" } },
  { id: "fidorr", name: "Fidorr", host: "fidorr.de", code: "70022200", from: 2009, monthly: 0, speed: "instant",
    tans: [{ method: "mtan", from: 2009, label: "mtan" }],
    card: { yearly: 0, factor: 1 }, overdraft: 0.14, loans: { factor: 0.5, min: 2_500 }, hbci: false, api: 2013,
    skin: { bar: "oklch(0.3 0.03 280)", accent: "oklch(0.65 0.2 340)", bg: "oklch(0.98 0.005 280)", frame: "startup" } },
  { id: "quonto", name: "Quonto", host: "quonto.eu", code: "16220000", from: 2016, monthly: 9, speed: "instant",
    tans: [{ method: "app", from: 2016, label: "app" }],
    card: { yearly: 0, factor: 1 }, overdraft: null, loans: { factor: 0, min: 0 }, hbci: false, api: 2016,
    skin: { bar: "oklch(0.25 0.02 260)", accent: "oklch(0.6 0.15 280)", bg: "oklch(0.99 0 0)", frame: "fintech" } },
];

export const TRANSFER_HOURS: Record<TransferSpeed, number> = { nextDay: 24, sameDay: 4, instant: 0 };
// The bank saves from before banks keep their account at.
export const DEFAULT_BANK: BankId = "sparklasse";

export const bankById = (id: string): Bank | undefined => BANKS.find((b) => b.id === id);
export const banksOpen = (year: number): Bank[] => BANKS.filter((b) => b.from <= year);
// The TAN methods a bank offers in a year, newest last.
export const tanMethods = (b: Bank, year: number) => b.tans.filter((x) => x.from <= year);
// From 2008 transfers name an IBAN, before an account number and bank code.
export const IBAN_YEAR = 2008;
