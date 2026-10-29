// Burn-in (economy.md, Hardware, power and failures, Burn-in): test lengths, what each test finds and the rewards.
export const BURNIN_HOURS = { quick: 6, full: 48 } as const;
// Quick marks parts past this share of their life; full fails this share of the parts past their life.
export const QUICK_WORN_SHARE = 0.8;
export const FULL_FAIL_SHARE = 0.5;
// A server that passed a full burn-in fails less often for a year.
export const BURNIN_FACTOR = 0.9;
export const BURNIN_BONUS_HOURS = 8760;
// Buyer protection on board and eBuy purchases: a part failing within the window refunds this share of the unit price once.
export const REFUND_HOURS = 14 * 24;
export const REFUND_SHARE = 0.5;
