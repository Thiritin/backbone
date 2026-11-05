// docs/design/plans/billing-by-hand.md, 9c and 9d: the bookkeeping programs sold on their makers' sites, each in editions whose
// features decide what the program does. Prices are game euros: once for a desktop licence, a month for a browser plan.
export type BooksVendorId = "lexwear" | "wizo" | "saga" | "orgamin" | "collmix" | "sevdeck" | "lexoffize" | "gnucache";
export type Feature = "quotes" | "monthly-run" | "match-by-reference" | "hbci" | "tax" | "reports" | "helpdesk-link" | "statistics" | "dunning";
// The layout family the Books window draws the program in.
export type Layout = "tree" | "icons" | "menus" | "tabs" | "web" | "flat";

export interface Edition {
  id: string; name: string; price: number;
  // Taxware's yearly update fee for the edition.
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
  // Features sold on their own for any edition, with their one-off price (a month for a browser program).
  addons?: Partial<Record<Feature, number>>;
  // Features every edition gains in the given year; a desktop program gets them with its next yearly update.
  ships?: Partial<Record<Feature, number>>;
  // The year updates stop, the features that stop working from a year on, and the program the vendor offers instead.
  supportEnd?: number; breaks?: Partial<Record<Feature, number>>; successor?: BooksVendorId;
  layout: Layout;
  // bar and ink colour the Books chrome, accent the selection.
  skin: { bar: string; ink: string; accent: string };
}

// A desktop program bought on its vendor's site and still downloading or waiting to be installed.
export interface BooksDownload { vendor: BooksVendorId; edition: string; startedAt: number; readyAt: number }

const ALL: Feature[] = ["quotes", "monthly-run", "match-by-reference", "hbci", "tax", "reports", "helpdesk-link", "statistics", "dunning"];
const NETWORK = Infinity;
const ed = (id: string, name: string, price: number, features: Feature[], more: Partial<Edition> = {}): Edition =>
  ({ id, name, price, update: 0, features, users: 1, seat: 0, ...more });

export const BOOKS_VENDORS: BooksVendor[] = [
  { id: "lexwear", name: "Taxware", program: "Taxware Office", from: 2005, deployment: "desktop", setupMb: 180, layout: "tree",
    editions: [ed("buchhalter", "buchhalter", 249, ["quotes", "monthly-run", "match-by-reference", "reports"], { update: 99 }),
      ed("financial-office", "financial office", 499, ["quotes", "monthly-run", "match-by-reference", "reports", "tax", "statistics"], { update: 149 }),
      ed("financial-office-pro", "financial office pro", 899, ["quotes", "monthly-run", "match-by-reference", "reports", "tax", "statistics", "dunning", "helpdesk-link"], { update: 199, users: NETWORK })],
    addons: { hbci: 99 }, ships: { dunning: 2009 }, supportEnd: 2020, breaks: { tax: 2021 }, successor: "lexoffize",
    skin: { bar: "#d4d0c8", ink: "#1b1b1b", accent: "#0a246a" } },
  { id: "wizo", name: "WARUM", program: "WARUM Mein Büro", from: 2005, deployment: "desktop", setupMb: 120, layout: "icons",
    editions: [ed("s", "S", 149, ["quotes", "monthly-run"]), ed("m", "M", 249, ["quotes", "monthly-run", "match-by-reference", "hbci", "tax"]),
      ed("l", "L", 399, ["quotes", "monthly-run", "match-by-reference", "hbci", "tax", "reports", "statistics", "helpdesk-link"], { seat: 79 })],
    ships: { "match-by-reference": 2015 },
    skin: { bar: "#1f5fa8", ink: "#ffffff", accent: "#1f5fa8" } },
  { id: "saga", name: "Thyme", program: "Thyme 50", from: 2005, deployment: "desktop", setupMb: 350, layout: "menus",
    editions: [ed("office-line", "Comfort", 599, ALL.filter((f) => f !== "dunning")), ed("office-line-plus", "Quantum", 999, ALL, { users: NETWORK })],
    skin: { bar: "#00704a", ink: "#ffffff", accent: "#00704a" } },
  { id: "orgamin", name: "orgaMIN", program: "orgaMIN", from: 2005, deployment: "desktop", setupMb: 90, layout: "tabs",
    editions: [ed("standard", "Standard", 199, ["quotes", "helpdesk-link", "monthly-run"]),
      ed("professional", "Professional", 349, ["quotes", "helpdesk-link", "monthly-run", "match-by-reference", "hbci", "reports"]),
      ed("enterprise", "Enterprise", 549, ["quotes", "helpdesk-link", "monthly-run", "match-by-reference", "hbci", "reports", "tax", "statistics", "dunning"], { seat: 99 })],
    ships: { "match-by-reference": 2009 }, supportEnd: 2012, breaks: { hbci: 2014 },
    skin: { bar: "#e8731c", ink: "#ffffff", accent: "#c25a0c" } },
  { id: "collmix", name: "Kontomix", program: "Kontomix", from: 2005, deployment: "browser", layout: "web",
    editions: [ed("basic", "basic", 6, ["quotes", "hbci"]), ed("plus", "plus", 12, ["quotes", "hbci", "tax", "reports", "statistics", "dunning"], { users: 3 })],
    skin: { bar: "#3b4a5a", ink: "#ffffff", accent: "#2d6cdf" } },
  { id: "sevdeck", name: "EightDesk", program: "EightDesk", from: 2013, deployment: "browser", layout: "flat",
    editions: [ed("rechnung", "Rechnung", 9, ["quotes", "monthly-run", "match-by-reference"], { seat: 8 }),
      ed("buchhaltung", "Buchhaltung", 19, ["quotes", "monthly-run", "match-by-reference", "hbci", "reports"], { seat: 8 }),
      ed("warenwirtschaft", "Warenwirtschaft", 39, ["quotes", "monthly-run", "match-by-reference", "hbci", "reports", "tax", "statistics", "helpdesk-link"], { seat: 8 })],
    ships: { hbci: 2015 },
    skin: { bar: "#0f8b8d", ink: "#ffffff", accent: "#0f8b8d" } },
  { id: "lexoffize", name: "Rexoffice", program: "Rexoffice", from: 2014, deployment: "browser", layout: "flat",
    editions: [ed("s", "S", 14, ["quotes", "monthly-run", "match-by-reference", "hbci", "tax"], { seat: 6 }),
      ed("m", "M", 24, ["quotes", "monthly-run", "match-by-reference", "hbci", "tax", "reports", "statistics"], { seat: 6 }),
      ed("l", "L", 44, ["quotes", "monthly-run", "match-by-reference", "hbci", "tax", "reports", "statistics", "dunning"], { seat: 6 })],
    ships: { dunning: 2017 },
    skin: { bar: "#43a047", ink: "#ffffff", accent: "#2e7d32" } },
  { id: "gnucache", name: "GnuCache", program: "GnuCache", from: 2005, deployment: "desktop", setupMb: 25, layout: "flat",
    editions: [ed("free", "GnuCache", 0, ["quotes", "reports"])],
    skin: { bar: "#dcdad5", ink: "#2e3436", accent: "#4a90d9" } },
];

export const booksVendor = (id: string | null | undefined): BooksVendor | undefined => BOOKS_VENDORS.find((v) => v.id === id);
export const vendorsIn = (year: number): BooksVendor[] => BOOKS_VENDORS.filter((v) => v.from <= year);
export const editionById = (v: BooksVendor, id: string | null | undefined): Edition | undefined => v.editions.find((e) => e.id === id);
// Every feature some edition or add-on of the vendor has; the rest it never sells.
export const sells = (v: BooksVendor, f: Feature): boolean => v.editions.some((e) => e.features.includes(f)) || !!v.addons?.[f];
// The edition's features in a year: its own and those its vendor has shipped since.
export const featuresIn = (v: BooksVendor, e: Edition, year: number): Feature[] =>
  [...new Set([...e.features, ...(Object.keys(v.ships ?? {}) as Feature[]).filter((f) => v.ships![f]! <= year)])];
// The cheapest edition with all the features, if the vendor has one.
export const smallestWith = (v: BooksVendor, features: string[]): Edition | undefined =>
  v.editions.find((e) => features.every((f) => e.features.includes(f as Feature)));
