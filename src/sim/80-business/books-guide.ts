// Install guide of the bookkeeping programs: one step table per vendor, ticked from state and never unticked
// (the same rule as checklist.ts), and the setup the player's actions fill in.
import { yearOf } from "../00-core/time";
import { keyCode } from "../00-core/rng";
import { booksVendor, type BooksVendorId } from "../10-catalog/bookkeeping";
import type { GameState } from "../50-state";
import { PORTAL_YEAR } from "./tax";
import { hasFeature } from "./bookkeeping";

export type Chart = "skr03" | "skr04";
export type TaxMethod = "soll" | "ist" | "euer";
export interface BooksSetup {
  licence: boolean;
  key: string;
  activated: boolean;
  company: boolean;
  chart: Chart | null;
  fiscalStart: number | null;
  method: TaxMethod | null;
  opening: boolean;
  bank: boolean;
  template: boolean;
  backupAt: number | null;
  // Guide steps seen done; a step stays ticked.
  ticked: string[];
}

// Saves and fixtures from before the guide have no setup until they load or act.
export const setupOf = (s: GameState): BooksSetup => s.books.setup ?? newSetup();
export const newSetup = (): BooksSetup => ({ licence: false, key: "", activated: false, company: false, chart: null, fiscalStart: null, method: null, opening: false, bank: false, template: false, backupAt: null, ticked: [] });

// Desktop programs that ask for a number from the order mail, and those that need the product activated over the line.
const KEYED: BooksVendorId[] = ["lexwear", "saga", "wizo", "orgamin"];
const ACTIVATED: BooksVendorId[] = ["lexwear", "saga", "wizo"];
export const needsKey = (id: string): boolean => KEYED.includes(id as BooksVendorId);
export const needsActivation = (id: string): boolean => ACTIVATED.includes(id as BooksVendorId);
// The key the vendor mails with the order, fixed by the seed and the vendor.
export const booksKey = (s: GameState, id: string): string => keyCode(s.seed, KEYED.indexOf(id as BooksVendorId) + 1, 613);

export interface GuideStep { id: string; labelKey: string; check: (s: GameState) => boolean; era?: [number, number]; optional?: boolean }

const is = (s: GameState, id: BooksVendorId) => s.books.vendor === id;
type Make = (id: BooksVendorId) => GuideStep;
const STEP: Record<string, Make> = {
  "buy.desktop": (id) => ({ id: "buy", labelKey: "books-guide.buy.desktop", check: (s) => is(s, id) || s.books.download?.vendor === id }),
  "buy.browser": (id) => ({ id: "buy", labelKey: "books-guide.buy.browser", check: (s) => is(s, id) }),
  download: (id) => ({ id: "download", labelKey: "books-guide.download", check: (s) => is(s, id) || (s.books.download?.vendor === id && s.hour >= s.books.download.readyAt) }),
  install: (id) => ({ id: "install", labelKey: "books-guide.install", check: (s) => is(s, id) }),
  licence: () => ({ id: "licence", labelKey: "books-guide.licence", check: (s) => setupOf(s).licence }),
  "key.serial": () => ({ id: "key", labelKey: "books-guide.key.serial", check: (s) => setupOf(s).key !== "" }),
  "key.warranty": () => ({ id: "key", labelKey: "books-guide.key.warranty", check: (s) => setupOf(s).key !== "" }),
  activate: () => ({ id: "activate", labelKey: "books-guide.activate", check: (s) => setupOf(s).activated }),
  confirm: () => ({ id: "activate", labelKey: "books-guide.confirm", check: (s) => setupOf(s).activated }),
  "company.firma": () => ({ id: "company", labelKey: "books-guide.company.firma", check: (s) => setupOf(s).company }),
  "company.mandant": () => ({ id: "company", labelKey: "books-guide.company.mandant", check: (s) => setupOf(s).company }),
  "company.unternehmen": () => ({ id: "company", labelKey: "books-guide.company.unternehmen", check: (s) => setupOf(s).company }),
  "company.datei": () => ({ id: "company", labelKey: "books-guide.company.datei", check: (s) => setupOf(s).company }),
  chart: () => ({ id: "chart", labelKey: "books-guide.chart", check: (s) => setupOf(s).chart !== null }),
  method: () => ({ id: "method", labelKey: "books-guide.method", check: (s) => setupOf(s).method !== null && setupOf(s).fiscalStart !== null }),
  opening: () => ({ id: "opening", labelKey: "books-guide.opening", check: (s) => setupOf(s).opening }),
  tax: () => ({ id: "tax", labelKey: "books-guide.tax", check: (s) => s.tax.number !== "", optional: true }),
  bank: () => ({ id: "bank", labelKey: "books-guide.bank", check: (s) => setupOf(s).bank, optional: true }),
  template: () => ({ id: "template", labelKey: "books-guide.template", check: (s) => setupOf(s).template, optional: true }),
  cert: () => ({ id: "cert", labelKey: "books-guide.cert", check: (s) => s.tax.booksCert !== null && s.tax.booksCert === s.tax.cert, era: [PORTAL_YEAR, 9999], optional: true }),
  vat: () => ({ id: "vat", labelKey: "books-guide.vat", check: (s) => s.tax.returns.some((r) => r.kind === "vat" && r.filedAt !== null), era: [PORTAL_YEAR, 9999], optional: true }),
  backup: () => ({ id: "backup", labelKey: "books-guide.backup", check: (s) => setupOf(s).backupAt !== null, optional: true }),
};

const D = ["buy.desktop", "download", "install", "licence"];
const TAIL = ["chart", "method", "opening", "tax", "bank", "template", "cert", "vat", "backup"];
const PLAN: Record<BooksVendorId, string[]> = {
  lexwear: [...D, "key.serial", "activate", "company.firma", ...TAIL],
  saga: [...D, "key.serial", "activate", "company.mandant", ...TAIL],
  wizo: [...D, "key.warranty", "activate", "company.unternehmen", ...TAIL],
  orgamin: [...D, "key.serial", "company.firma", ...TAIL],
  gnucache: [...D, "company.datei", "chart", "method", "opening", "bank", "backup"],
  collmix: ["buy.browser", "confirm", "company.mandant", "chart", "method", "tax", "opening", "bank", "cert", "vat"],
  lexoffize: ["buy.browser", "confirm", "company.unternehmen", "chart", "method", "tax", "bank", "template", "cert", "vat"],
  sevdeck: ["buy.browser", "confirm", "company.unternehmen", "method", "tax", "template", "bank", "cert", "vat"],
};

export const BOOKS_GUIDE: Record<BooksVendorId, GuideStep[]> = Object.fromEntries(
  (Object.keys(PLAN) as BooksVendorId[]).map((id) => [id, PLAN[id].map((k) => STEP[k](id))]),
) as Record<BooksVendorId, GuideStep[]>;

// The steps shown in the clock's year for the installed program.
export function guideOf(s: GameState): GuideStep[] {
  const v = booksVendor(s.books.vendor), y = yearOf(s.hour);
  return v ? BOOKS_GUIDE[v.id].filter((x) => !x.era || (y >= x.era[0] && y <= x.era[1])) : [];
}

export const guideTicked = (s: GameState, x: GuideStep): boolean => setupOf(s).ticked.includes(x.id) || x.check(s);

// Latches ticked steps and marks the setup done once every required step is.
export function syncBooksGuide(s: GameState): void {
  const steps = guideOf(s);
  if (!steps.length) return;
  const seen = steps.filter((x) => guideTicked(s, x)).map((x) => x.id);
  const ticked = [...new Set([...setupOf(s).ticked, ...seen])];
  if (ticked.length !== setupOf(s).ticked.length) s.books = { ...s.books, setup: { ...setupOf(s), ticked } };
  if (!s.books.setupDone && steps.every((x) => x.optional || ticked.includes(x.id))) s.books = { ...s.books, setupDone: true };
}

// A save that finished its setup shows a finished guide.
export function fillSetup(s: GameState): void {
  const v = booksVendor(s.books.vendor), done = !!s.books.setupDone;
  const setup = { ...newSetup(), ...s.books.setup };
  if (v && done) Object.assign(setup, { licence: true, key: needsKey(v.id) ? booksKey(s, v.id) : "", activated: true, company: true, chart: setup.chart ?? "skr03", fiscalStart: setup.fiscalStart ?? 1, method: setup.method ?? "euer", opening: true, template: true, ticked: BOOKS_GUIDE[v.id].map((x) => x.id) });
  s.books = { ...s.books, setup };
}

// Linking the bank needs the account, and Taxware its HBCI add-on.
export const bankReady = (s: GameState): boolean => !!s.bank && (s.books.vendor !== "lexwear" || hasFeature(s, "hbci"));
