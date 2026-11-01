// docs/design/plans/billing-by-hand.md, lane vendor-sites: add-on modules bought once on their vendor's site in the Browser.
// Prices are 2005 euros for a one-time licence. Bookkeeping features come with the program's edition (bookkeeping.ts).
// vendor "shop" is the maker of the shop system in use, which sells the module on its own site.
export interface Module { id: string; vendor: "shop"; price: number; year: number }

export const MODULES: Module[] = [
  // Lane shop-link: the shop and Books share customers and invoices as they are created.
  { id: "shop-link", vendor: "shop", price: 199, year: 2005 },
  // Lane payment-methods: each payment method but bank transfer, with its one-time setup (catalog in payments.ts).
  { id: "debit", vendor: "shop", price: 49, year: 2005 },
  { id: "paypail", vendor: "shop", price: 49, year: 2005 },
  { id: "card", vendor: "shop", price: 199, year: 2006 },
  { id: "paysafe", vendor: "shop", price: 99, year: 2007 },
  { id: "instantly", vendor: "shop", price: 49, year: 2008 },
  { id: "crypto", vendor: "shop", price: 99, year: 2012 },
];

export const moduleById = (id: string): Module | undefined => MODULES.find((m) => m.id === id);
export const hasModule = (s: { modules: string[] }, id: string): boolean => s.modules.includes(id);
