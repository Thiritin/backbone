// docs/design/plans/billing-by-hand.md, lane payment-methods; numbers in docs/design/economy.md, Payment methods.
// Every method but bank transfer is a shop module of the same id. pct and fixed are the fee per booking; payee is who
// sends the weekly payout, the shop system itself where null.
import type { Profile } from "../30-customers/customers";

export type MethodId = "transfer" | "debit" | "paypail" | "card" | "paysafe" | "instantly" | "crypto";
export interface PaymentMethod { id: MethodId; year: number; pct: number; fixed: number; payee: string | null;
  // Paid at checkout, so Books never chases the invoice.
  prepaid?: true;
  // The customer's own transfer arrives at checkout with an exact reference, instead of a weekly payout.
  instant?: true }

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "transfer", year: 2005, pct: 0, fixed: 0, payee: null },
  { id: "debit", year: 2005, pct: 0, fixed: 0.35, payee: null },
  { id: "paypail", year: 2005, pct: 0.019, fixed: 0.35, payee: "PayPail", prepaid: true },
  { id: "card", year: 2006, pct: 0.029, fixed: 0.3, payee: "Visor" },
  { id: "paysafe", year: 2007, pct: 0.1, fixed: 0, payee: "paysavecard", prepaid: true },
  { id: "instantly", year: 2008, pct: 0.009, fixed: 0, payee: "Instantly", instant: true },
  { id: "crypto", year: 2012, pct: 0.01, fixed: 0, payee: "Bitcorn Pay", prepaid: true },
];
export const methodById = (id: MethodId): PaymentMethod => PAYMENT_METHODS.find((m) => m.id === id)!;
export const methodFee = (m: PaymentMethod, amount: number): number => Math.round((amount * m.pct + m.fixed) * 100) / 100;

// The method each crowd reaches for first, as weights over the methods that exist in the year.
type Weights = Partial<Record<MethodId, number>>;
export const PREFERENCE: Record<Profile | "international" | "shady", Weights> = {
  private: { transfer: 0.45, paypail: 0.35, debit: 0.1, card: 0.05, instantly: 0.05 },
  gamer: { paysafe: 0.35, paypail: 0.35, transfer: 0.15, card: 0.1, instantly: 0.05 },
  hobbyDev: { paypail: 0.35, card: 0.25, transfer: 0.25, crypto: 0.1, instantly: 0.05 },
  soleProp: { transfer: 0.5, debit: 0.25, paypail: 0.15, card: 0.1 },
  smallBiz: { transfer: 0.45, debit: 0.3, card: 0.2, paypail: 0.05 },
  agency: { transfer: 0.4, card: 0.35, debit: 0.15, paypail: 0.1 },
  office: { transfer: 0.5, debit: 0.4, card: 0.1 },
  onlineShop: { transfer: 0.35, debit: 0.3, card: 0.25, paypail: 0.1 },
  enterprise: { transfer: 0.6, debit: 0.25, card: 0.15 },
  // Customers from the other side of the Atlantic.
  international: { card: 0.6, paypail: 0.3, transfer: 0.1 },
  shady: { crypto: 0.6, paysafe: 0.2, card: 0.2 },
};

// Share of shop orders that still go through, by bank transfer, when the preferred method is missing.
export const MISSING_CONVERT = 0.5;
export const NEVER_WITHOUT: MethodId[] = ["paysafe", "crypto"];

// Side effects. Days are counted from the payout that carried the invoice.
export const DEBIT_RETURN_FEE = 3;
export const DEBIT_RETURN_DAYS: [number, number] = [3, 7];
export const DISPUTE_CHANCE = 0.01;
export const DISPUTE_AFTER_DAYS: [number, number] = [5, 20];
export const DISPUTE_DAYS = 30;
export const CARD_CHARGEBACK_CHANCE = 0.005;
export const CARD_CHARGEBACK_DAYS: [number, number] = [7, 90];
// Monthly base churn multiplier for paysafecard payers, and abuse and notice multiplier for crypto payers.
export const PAYSAFE_CHURN = 2;
export const CRYPTO_ABUSE = 3;
