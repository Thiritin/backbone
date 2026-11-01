import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { BOOKS_VENDORS, booksVendor, LARGE, MEDIUM } from "../src/sim/10-catalog/bookkeeping";
import { billingTick, owed } from "../src/sim/45-billing/billing";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { booksTick, hasFeature } from "../src/sim/80-business/bookkeeping";
import { resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { installBooks, runFeature, setSeats, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

const at = (y: number, m: number, d: number, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

function game(year = 2005): GameState {
  const s = newGame(31);
  s.hour = at(year, 3, 10);
  s.cash = 5_000;
  s.bank = openAccount(s, "sparklasse");
  return s;
}

// Three customers: A's invoice is a draft, B's exact payment waits in the bank, C's invoice is a week overdue.
function ledger(seed = 9) {
  const s = withServer(newGame(seed));
  const [a, b, c] = ["Müller Webdesign", "Krause IT", "Bauer Media"].map((name, i) => {
    const id = addCustomer(s, name, "agency", "prompt");
    addService(s, id, "domain", `d${i}.de`, 12, "year");
    return id;
  });
  tick(s);
  const inv = (customerId: string) => s.invoices.find((i) => i.customerId === customerId)!;
  sendInvoice(s, inv(b).id);
  sendInvoice(s, inv(c).id);
  Object.assign(inv(b), { payStep: 0, payAt: s.hour + 1 });
  Object.assign(inv(c), { payStep: 9, payAt: null, dueAt: s.hour - 8 * 24 });
  s.hour++;
  billingTick(s);
  Object.assign(s.transfers[0], { reference: "books.ref.invoice", params: { number: inv(b).number } });
  return { s, A: () => inv(a), B: () => inv(b), C: () => inv(c) };
}
const run = (s: GameState, vendor: string, edition: string) => { s.books = { vendor: vendor as never, installedAt: s.hour, edition, seats: 0 }; };

describe("editions", () => {
  it("lists every vendor's editions from smallest to largest, GnuCache free", () => {
    expect(BOOKS_VENDORS.map((v) => v.id)).toEqual(["lexwear", "wizo", "saga", "orgamin", "collmix", "sevdeck", "lexoffize", "gnucache"]);
    for (const v of BOOKS_VENDORS) expect(v.editions.map((e) => e.price)).toEqual([...v.editions.map((e) => e.price)].sort((a, b) => a - b));
    expect(booksVendor("lexwear")!.editions.map((e) => [e.name, e.price, e.update])).toEqual([["buchhalter", 249, 99], ["financial office", 499, 149], ["financial office pro", 899, 199]]);
    expect(booksVendor("saga")!.editions[0].features).toEqual(MEDIUM);
    expect(booksVendor("collmix")!.editions[0].features).toContain("hbci");
    expect(booksVendor("collmix")!.editions.some((e) => e.features.includes("helpdesk-link"))).toBe(false);
    expect(booksVendor("gnucache")!.editions).toEqual([expect.objectContaining({ price: 0, users: 1, features: ["hbci", "reports"] })]);
    expect(resolve(game(), "www.gnucache.org/").page).toEqual({ kind: "books", id: "gnucache" });
  });

  it("installs the edition asked for and upgrades a desktop licence for the difference", () => {
    const s = game();
    expect(installBooks(s, "lexwear", "buchhalter")).toEqual({ ok: true });
    expect(s.cash).toBe(5_000 - 249);
    expect(upgradeBooks(s, "financial-office-pro")).toEqual({ ok: true });
    expect(s.cash).toBe(5_000 - 899);
    expect(s.books.edition).toBe("financial-office-pro");
    expect(upgradeBooks(s, "buchhalter")).toEqual({ ok: false, error: "error.unknownEdition" });
    // Switching away and back costs nothing more for the licence already paid.
    installBooks(s, "gnucache");
    installBooks(s, "lexwear", "financial-office");
    expect(s.cash).toBe(5_000 - 899);
  });

  it("switches a browser plan's fee from the next month and bills its seats", () => {
    const s = game(2014);
    installBooks(s, "lexoffize");
    expect(s.payables.at(-1)).toMatchObject({ name: "lexoffize", amount: 7 });
    expect(upgradeBooks(s, "l")).toEqual({ ok: true });
    expect(setSeats(s, 2)).toEqual({ ok: true });
    s.hour = at(2014, 4, 1, 0);
    booksTick(s);
    expect(s.payables.at(-1)).toMatchObject({ name: "lexoffize", amount: 19 + 2 * 6 });
    expect(setSeats(s, 1)).toEqual({ ok: true });
    expect(s.books.seats).toBe(1);
  });

  it("sells desktop seats once and only with an edition that has them", () => {
    const s = game();
    installBooks(s, "wizo", "m");
    expect(setSeats(s, 1)).toEqual({ ok: false, error: "error.unknownEdition" });
    upgradeBooks(s, "l");
    const cash = s.cash;
    expect(setSeats(s, 2)).toEqual({ ok: true });
    expect(s.cash).toBe(cash - 2 * 79);
    expect(setSeats(s, 1)).toEqual({ ok: false, error: "error.unknownEdition" });
  });
});

describe("features follow the edition", () => {
  it("runs the monthly run and match by reference from the medium edition on, not before", () => {
    const { s, A, B, C } = ledger();
    run(s, "lexwear", "buchhalter");
    s.hour = at(2005, 2, 1, 9);
    booksTick(s);
    expect(A().status).toBe("draft");
    expect(B().status).not.toBe("paid");
    expect(runFeature(s, "monthly-run")).toEqual({ ok: false, error: "error.unknownEdition" });
    run(s, "lexwear", "financial-office");
    booksTick(s);
    expect(A().status).toBe("open");
    expect(B().status).toBe("paid");
    expect(C().reminders).toEqual([]);
  });

  it("sends reminders by itself only with the large edition, and keeps an odd amount for the player", () => {
    const { s, C } = ledger();
    s.transfers.push({ ...s.transfers[0], id: "trf900", amount: owed(C()) - 0.5, params: { number: C().number }, forInvoice: C().id });
    s.billingRules.autoRemind = true;
    run(s, "orgamin", "professional");
    s.hour++;
    billingTick(s);
    expect(C().reminders).toEqual([]);
    run(s, "orgamin", "enterprise");
    expect(hasFeature(s, "auto-reminders")).toBe(true);
    s.hour++;
    billingTick(s);
    expect(C().reminders).toEqual([s.hour]);
    booksTick(s);
    expect(s.transfers.find((x) => x.id === "trf900")!.invoiceId).toBeNull();
  });

  it("gives the helpdesk link and statistics only to the large editions", () => {
    for (const v of BOOKS_VENDORS) for (const e of v.editions) {
      expect(e.features.includes("helpdesk-link")).toBe(e.features.length >= LARGE.length && v.id !== "collmix");
    }
  });
});

describe("old saves", () => {
  const old = (modules: string[], vendor = "lexwear") => {
    const raw = JSON.parse(serialize(newGame(4)));
    raw.books = { vendor, installedAt: 0 };
    raw.modules = [...modules, "shop-link"];
    raw.tickets.push({ ...raw.tickets[0] ?? {}, id: "tktold", kind: "mail", topic: "lexwear.newsletter", mail: { from: "Lexwear", params: { module: "hbci" } } });
    return deserialize(JSON.stringify(raw));
  };

  it("run the smallest Lexwear edition that covers the modules they owned", () => {
    expect(old([]).books.edition).toBe("buchhalter");
    expect(old(["monthly-run", "hbci"]).books.edition).toBe("financial-office");
    expect(old(["helpdesk-link"]).books.edition).toBe("financial-office-pro");
    expect(old(["auto-reminders"], "wizo").books.edition).toBe("s");
  });

  it("keep their shop modules and lose the bookkeeping modules and their emails", () => {
    const s = old(["monthly-run", "auto-reminders"]);
    expect(s.modules).toEqual(["shop-link"]);
    expect(s.tickets.some((x) => x.topic === "lexwear.newsletter")).toBe(false);
    expect(s.books.seats).toBe(0);
  });
});
