// docs/design/plans/billing-by-hand.md, lane vendor-sites: add-on modules bought once on their vendor's site in the Browser.
// Prices are 2005 euros for a one-time licence. The trigger is the count at which the vendor's newsletter offers the module.
export type ModuleCount = "domainsByHand" | "matched" | "customers" | "suspended";
// vendor "shop" is the maker of the shop system in use, which sells the module on its own site.
export interface Module { id: string; vendor: "lexwear" | "shop"; price: number; year: number; trigger: { count: ModuleCount; at: number } | null }

export const MODULES: Module[] = [
  { id: "helpdesk-link", vendor: "lexwear", price: 149, year: 2005, trigger: { count: "domainsByHand", at: 3 } },
  { id: "monthly-run", vendor: "lexwear", price: 99, year: 2005, trigger: { count: "customers", at: 10 } },
  { id: "match-by-reference", vendor: "lexwear", price: 129, year: 2005, trigger: { count: "matched", at: 10 } },
  { id: "auto-reminders", vendor: "lexwear", price: 99, year: 2005, trigger: { count: "suspended", at: 1 } },
  // Books talks to the bank; the bank lane builds the effect.
  { id: "hbci", vendor: "lexwear", price: 79, year: 2005, trigger: null },
  // Lane shop-link: the shop and Books share customers and invoices as they are created.
  { id: "shop-link", vendor: "shop", price: 199, year: 2005, trigger: null },
  // Lane payment-methods: each payment method but bank transfer, with its one-time setup (catalog in payments.ts).
  { id: "debit", vendor: "shop", price: 49, year: 2005, trigger: null },
  { id: "paypail", vendor: "shop", price: 49, year: 2005, trigger: null },
  { id: "card", vendor: "shop", price: 199, year: 2006, trigger: null },
  { id: "paysafe", vendor: "shop", price: 99, year: 2007, trigger: null },
  { id: "instantly", vendor: "shop", price: 49, year: 2008, trigger: null },
  { id: "crypto", vendor: "shop", price: 99, year: 2012, trigger: null },
];

export const moduleById = (id: string): Module | undefined => MODULES.find((m) => m.id === id);
export const hasModule = (s: { modules: string[] }, id: string): boolean => s.modules.includes(id);
