// Ledger category names and the account numbers the books use for them.
import { t } from "../../../../i18n/en";
import type { Kind } from "./accounts";

const CATEGORY: Record<string, string> = {
  payments: t("misc.catPayments"), setup: t("misc.catSetup"), sales: t("misc.catSales"), hardware: t("misc.catHardware"), rent: t("misc.catRent"), power: t("misc.catPower"), transit: t("misc.catTransit"), salaries: t("misc.catSalaries"),
  leasing: t("misc.catLeasing"), maintenance: t("misc.catMaintenance"), moving: t("misc.catMoving"), insurance: t("misc.catInsurance"), loans: t("misc.catLoans"), tax: t("misc.catTax"), subscriptions: t("misc.catSubscriptions"), ai: t("misc.catAi"), marketing: t("misc.catMarketing"), fees: t("misc.catFees"), bankfees: t("misc.catBankFees"), interest: t("misc.catInterest"), other: t("misc.catOther"), travel: t("misc.catTravel"), licenses: t("misc.catLicenses"), domains: t("misc.catDomains"), credit: t("misc.catCredit"), vat: t("misc.catVat"), transfers: t("bank.catTransfers"), capital: t("bank.catCapital"),
};
export const categoryLabel = (c: string) => CATEGORY[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

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
