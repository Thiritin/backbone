// Ledger category names and the account numbers the books use for them.
import { t } from "../../../../i18n/en";
import type { GameState } from "../../../../sim/50-state";
import { setupOf } from "../../../../sim/80-business/books-guide";
import type { Kind } from "./accounts";

// Read at call time, so the label follows the language loaded after start.
const CATEGORY: Record<string, string> = {
  payments: "misc.catPayments", setup: "misc.catSetup", sales: "misc.catSales", hardware: "misc.catHardware", rent: "misc.catRent", power: "misc.catPower", transit: "misc.catTransit", salaries: "misc.catSalaries",
  leasing: "misc.catLeasing", maintenance: "misc.catMaintenance", moving: "misc.catMoving", insurance: "misc.catInsurance", loans: "misc.catLoans", tax: "misc.catTax", subscriptions: "misc.catSubscriptions", ai: "misc.catAi", marketing: "misc.catMarketing", fees: "misc.catFees", bankfees: "misc.catBankFees", interest: "misc.catInterest", other: "misc.catOther", travel: "misc.catTravel", licenses: "misc.catLicenses", domains: "misc.catDomains", credit: "misc.catCredit", vat: "misc.catVat", transfers: "bank.catTransfers", capital: "bank.catCapital",
};
export const categoryLabel = (c: string) => CATEGORY[c] ? t(CATEGORY[c]) : c.charAt(0).toUpperCase() + c.slice(1);

// Account number and kind per ledger category, after the German standard chart (SKR03 style).
export const CHART: Record<string, [number, Kind]> = {
  transfers: [1360, "asset"], loans: [630, "liability"], vat: [1780, "liability"], capital: [800, "equity"],
  payments: [8400, "income"], setup: [8401, "income"], sales: [8402, "income"], credit: [2700, "income"],
  salaries: [4120, "expense"], rent: [4210, "expense"], power: [4240, "expense"], tax: [4320, "expense"], insurance: [4360, "expense"],
  marketing: [4600, "expense"], maintenance: [4805, "expense"], leasing: [4810, "expense"], hardware: [4855, "expense"],
  transit: [4920, "expense"], domains: [4925, "expense"], subscriptions: [4964, "expense"], licenses: [4965, "expense"], fees: [4970, "expense"],
};
// The fixed accounts every set of books has.
export const FIXED_NO = { bank: 1200, receivables: 1400, payables: 1600 } as const;

// The same categories under SKR04, the chart a company can pick instead in its setup.
export const SKR04: Record<string, [number, Kind]> = {
  transfers: [1460, "asset"], loans: [3150, "liability"], vat: [3820, "liability"], capital: [2900, "equity"],
  payments: [4400, "income"], setup: [4401, "income"], sales: [4402, "income"], credit: [4830, "income"],
  salaries: [6020, "expense"], rent: [6310, "expense"], power: [6325, "expense"], tax: [7610, "expense"], insurance: [6400, "expense"],
  marketing: [6600, "expense"], maintenance: [6485, "expense"], leasing: [6840, "expense"], hardware: [6260, "expense"],
  transit: [6805, "expense"], domains: [6810, "expense"], subscriptions: [6837, "expense"], licenses: [6838, "expense"], fees: [6855, "expense"],
};
export const FIXED_SKR04 = { bank: 1800, receivables: 1200, payables: 3300 } as const;

export type ChartId = "skr03" | "skr04";
// The chart the company chose in its setup, SKR03 until it picks; other is the income and expense account for an unlisted category.
export const chartOf = (s: GameState) => setupOf(s).chart === "skr04"
  ? { id: "skr04" as ChartId, map: SKR04, fixed: FIXED_SKR04 as Record<keyof typeof FIXED_NO, number>, other: [4830, 6300] }
  : { id: "skr03" as ChartId, map: CHART, fixed: FIXED_NO as Record<keyof typeof FIXED_NO, number>, other: [2700, 4900] };
