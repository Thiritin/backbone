// docs/design/plans/billing-by-hand.md, 9c and 9d: the bookkeeping programs sold on their makers' sites, each in editions whose
// features decide what the program does. Prices are game euros: once for a desktop licence, a month for a browser plan.
export type BooksVendorId = "lexwear" | "wizo" | "saga" | "orgamin" | "collmix" | "sevdeck" | "lexoffize" | "gnucache";
export type Feature = "quotes" | "monthly-run" | "match-by-reference" | "hbci" | "tax" | "reports" | "helpdesk-link" | "statistics";
// The layout family the Books window draws the program in.
export type Layout = "tree" | "icons" | "menus" | "tabs" | "web" | "flat" | "gtk";

export interface Edition {
  id: string; name: string; price: number;
  // Lexwear's yearly update fee for the edition.
  update: number;
  features: Feature[];
  // Users the licence includes, the player among them (Infinity for a network version), and the price of one more seat (0: none sold).
  users: number; seat: number;
}

export interface BooksVendor {
  id: BooksVendorId;
  // name is the brand on the site and on its invoices; program is the window title.
  name: string; program: string; from: number;
  // A browser program runs at the vendor and needs the internet line; its prices are a month.
  deployment: "desktop" | "browser";
  // A desktop program's installer in MB, downloaded from the vendor's site before it installs.
  setupMb?: number;
  editions: Edition[];
  layout: Layout;
  // bar and ink colour the Books chrome, accent the selection.
  skin: { bar: string; ink: string; accent: string };
}

// A desktop program bought on its vendor's site and still downloading or waiting to be installed.
export interface BooksDownload { vendor: BooksVendorId; edition: string; startedAt: number; readyAt: number }

export const SMALL: Feature[] = ["quotes"];
export const MEDIUM: Feature[] = [...SMALL, "monthly-run", "match-by-reference", "hbci", "tax", "reports"];
export const LARGE: Feature[] = [...MEDIUM, "helpdesk-link", "statistics"];
const NETWORK = Infinity;
const ed = (id: string, name: string, price: number, features: Feature[], more: Partial<Edition> = {}): Edition =>
  ({ id, name, price, update: 0, features, users: 1, seat: 0, ...more });

export const BOOKS_VENDORS: BooksVendor[] = [
  { id: "lexwear", name: "Lexwear", program: "Lexwear Office", from: 2005, deployment: "desktop", setupMb: 180, layout: "tree",
    editions: [ed("buchhalter", "buchhalter", 249, SMALL, { update: 99 }), ed("financial-office", "financial office", 499, MEDIUM, { update: 149 }),
      ed("financial-office-pro", "financial office pro", 899, LARGE, { update: 199, users: NETWORK })],
    skin: { bar: "#d4d0c8", ink: "#1b1b1b", accent: "#0a246a" } },
  { id: "wizo", name: "WIZO", program: "WIZO Mein Büro", from: 2005, deployment: "desktop", setupMb: 120, layout: "icons",
    editions: [ed("s", "S", 149, SMALL), ed("m", "M", 249, MEDIUM), ed("l", "L", 399, LARGE, { seat: 79 })],
    skin: { bar: "#1f5fa8", ink: "#ffffff", accent: "#1f5fa8" } },
  { id: "saga", name: "Saga", program: "Saga Office Line", from: 2005, deployment: "desktop", setupMb: 350, layout: "menus",
    editions: [ed("office-line", "Office Line", 599, MEDIUM), ed("office-line-plus", "Office Line Plus", 999, LARGE, { users: NETWORK })],
    skin: { bar: "#00704a", ink: "#ffffff", accent: "#00704a" } },
  { id: "orgamin", name: "orgaMIN", program: "orgaMIN", from: 2005, deployment: "desktop", setupMb: 90, layout: "tabs",
    editions: [ed("standard", "Standard", 199, SMALL), ed("professional", "Professional", 349, MEDIUM), ed("enterprise", "Enterprise", 549, LARGE, { seat: 99 })],
    skin: { bar: "#e8731c", ink: "#ffffff", accent: "#c25a0c" } },
  { id: "collmix", name: "Collmix", program: "Collmix", from: 2005, deployment: "browser", layout: "web",
    editions: [ed("basic", "basic", 15, [...SMALL, "hbci"]), ed("plus", "plus", 29, LARGE.filter((f) => f !== "helpdesk-link"), { users: 3 })],
    skin: { bar: "#3b4a5a", ink: "#ffffff", accent: "#2d6cdf" } },
  { id: "sevdeck", name: "sevDeck", program: "sevDeck", from: 2013, deployment: "browser", layout: "flat",
    editions: [ed("rechnung", "Rechnung", 9, [...SMALL, "hbci"], { seat: 8 }), ed("buchhaltung", "Buchhaltung", 19, MEDIUM, { seat: 8 }),
      ed("warenwirtschaft", "Warenwirtschaft", 39, LARGE, { seat: 8 })],
    skin: { bar: "#0f8b8d", ink: "#ffffff", accent: "#0f8b8d" } },
  { id: "lexoffize", name: "lexoffize", program: "lexoffize", from: 2014, deployment: "browser", layout: "flat",
    editions: [ed("s", "S", 7, SMALL, { seat: 6 }), ed("m", "M", 12, MEDIUM, { seat: 6 }), ed("l", "L", 19, LARGE, { seat: 6 })],
    skin: { bar: "#43a047", ink: "#ffffff", accent: "#2e7d32" } },
  { id: "gnucache", name: "GnuCache", program: "GnuCache", from: 2005, deployment: "desktop", setupMb: 25, layout: "gtk",
    editions: [ed("free", "GnuCache", 0, ["hbci", "reports"])],
    skin: { bar: "#dcdad5", ink: "#2e3436", accent: "#4a90d9" } },
];

export const booksVendor = (id: string | null | undefined): BooksVendor | undefined => BOOKS_VENDORS.find((v) => v.id === id);
export const vendorsIn = (year: number): BooksVendor[] => BOOKS_VENDORS.filter((v) => v.from <= year);
export const editionById = (v: BooksVendor, id: string | null | undefined): Edition | undefined => v.editions.find((e) => e.id === id);
// Every feature some edition of the vendor has; the rest it never sells.
export const sells = (v: BooksVendor, f: Feature): boolean => v.editions.some((e) => e.features.includes(f));
// The cheapest edition with all the features, if the vendor has one.
export const smallestWith = (v: BooksVendor, features: string[]): Edition | undefined =>
  v.editions.find((e) => features.every((f) => e.features.includes(f as Feature)));
