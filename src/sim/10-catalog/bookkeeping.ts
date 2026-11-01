// docs/design/plans/billing-by-hand.md, 9c: the bookkeeping programs the Pear Store sells, each with its own modules.
// Prices are game euros: the licence once, the fee a month, Lexwear's updates a year.
import { MODULES } from "./modules";

export type BooksVendorId = "lexwear" | "wizo" | "saga" | "orgamin" | "collmix" | "sevdeck" | "lexoffize";
// A module's price at a vendor: euros once, part of the program, or never sold.
export type ModulePrice = number | "included" | "never";

export interface BooksVendor {
  id: BooksVendorId;
  // name is the brand on the site and on its invoices; program is the window title.
  name: string; program: string;
  from: number; licence: number; monthly: number; update: number;
  // Keyless vendors switch a module on at purchase; the others email a licence key.
  keys: boolean;
  modules: Record<string, ModulePrice>;
  // bar and ink colour the Books toolbar, accent the selection; web draws an address bar above it.
  skin: { bar: string; ink: string; accent: string; web?: boolean };
}

// The modules Books runs, as Lexwear prices them; shop modules from other lanes are not part of a bookkeeping program.
export const BOOK_MODULES: string[] = MODULES.filter((m) => m.vendor === "lexwear").map((m) => m.id);
const each = (price: ModulePrice, rest: Record<string, ModulePrice> = {}): Record<string, ModulePrice> =>
  ({ ...Object.fromEntries(BOOK_MODULES.map((id) => [id, price])), ...rest });

export const BOOKS_VENDORS: BooksVendor[] = [
  { id: "lexwear", name: "Lexwear", program: "Lexwear Office", from: 2005, licence: 249, monthly: 0, update: 99, keys: true,
    modules: Object.fromEntries(MODULES.filter((m) => m.vendor === "lexwear").map((m) => [m.id, m.price])),
    skin: { bar: "#d4d0c8", ink: "#1b1b1b", accent: "#0a246a" } },
  { id: "wizo", name: "WIZO", program: "WIZO Mein Büro", from: 2005, licence: 149, monthly: 0, update: 0, keys: true,
    modules: { "auto-reminders": "included", "monthly-run": 79, "match-by-reference": 129, "helpdesk-link": 149, hbci: 49 },
    skin: { bar: "#1f5fa8", ink: "#ffffff", accent: "#1f5fa8" } },
  { id: "saga", name: "Saga", program: "Saga Office Line", from: 2005, licence: 599, monthly: 0, update: 0, keys: true,
    modules: each("included", { "helpdesk-link": 199 }),
    skin: { bar: "#00704a", ink: "#ffffff", accent: "#00704a" } },
  { id: "orgamin", name: "orgaMIN", program: "orgaMIN", from: 2005, licence: 199, monthly: 0, update: 0, keys: true,
    modules: each(99, { "monthly-run": "included" }),
    skin: { bar: "#e8731c", ink: "#ffffff", accent: "#c25a0c" } },
  // The table names no price for Monthly run and Automatic reminders at Collmix; 49 each keeps it the cheap web option.
  { id: "collmix", name: "Collmix", program: "Collmix", from: 2005, licence: 0, monthly: 15, update: 0, keys: false,
    modules: each(49, { hbci: "included", "match-by-reference": "included", "helpdesk-link": "never" }),
    skin: { bar: "#3b4a5a", ink: "#ffffff", accent: "#2d6cdf", web: true } },
  { id: "sevdeck", name: "sevDeck", program: "sevDeck", from: 2013, licence: 0, monthly: 19, update: 0, keys: false,
    modules: each("included"), skin: { bar: "#0f8b8d", ink: "#ffffff", accent: "#0f8b8d" } },
  { id: "lexoffize", name: "lexoffize", program: "lexoffize", from: 2014, licence: 0, monthly: 12, update: 0, keys: false,
    modules: each("included"), skin: { bar: "#2b7de9", ink: "#ffffff", accent: "#d62d42" } },
];

export const booksVendor = (id: string | null | undefined): BooksVendor | undefined => BOOKS_VENDORS.find((v) => v.id === id);
export const vendorsIn = (year: number): BooksVendor[] => BOOKS_VENDORS.filter((v) => v.from <= year);
export const modulePrice = (v: BooksVendor, id: string): ModulePrice => v.modules[id] ?? "never";
export const included = (v: BooksVendor): string[] => BOOK_MODULES.filter((id) => v.modules[id] === "included");
