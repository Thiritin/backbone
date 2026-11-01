import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { BOOKS_VENDORS, booksVendor, LARGE, MEDIUM } from "../src/sim/10-catalog/bookkeeping";
import { billingTick, owed } from "../src/sim/45-billing/billing";
import { openAccount } from "../src/sim/46-finance/bank";
import { cashFlow, INSOLVENT_DAYS, monthlyStats, profitBetween, yearStart } from "../src/sim/46-finance/finance";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { booksOffline, booksTick, hasFeature, seated, works } from "../src/sim/80-business/bookkeeping";
import { staffTick } from "../src/sim/47-staff/staff";
import { orderLead } from "../src/sim/30-market/orders";
import { stepsDone } from "../src/sim/30-market/manual";
import { hire } from "../src/sim/90-actions/staff";
import { quoteOrder } from "../src/sim/90-actions/orders";
import { resolve } from "../src/sim/80-business/browser";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { installBooks, runFeature, setSeats, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame as fixtureGame, readyGame, withServer } from "./fixtures";

const at = (y: number, m: number, d: number, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

const entry = (hour: number, category: string, amount: number, key = "ledger.x", params: LedgerEntry["params"] = {}): LedgerEntry => ({ hour, category, key, params, amount });
// Ticks from the hour before `hour` up to it, collecting events.
const tickInto = (s: GameState, hour: number): SimEvent[] => { s.hour = hour - 1; return tick(s); };
const runFor = (s: GameState, hours: number): SimEvent[] => Array.from({ length: hours }, () => tick(s)).flat();

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

describe("seats", () => {
  const clerk = (s: GameState) => {
    const c = { ...s.candidates[0], id: "candb", role: "bookkeeper" as const, arriveAt: 0, leaveAt: 1e9 };
    s.candidates.push(c);
    const id = (hire(s, c.id) as { id: string }).id, e = s.staff.find((x) => x.id === id)!;
    Object.assign(e, { skill: 50, trained: ["reminder", "invoices", "transfers"] });
    return e;
  };
  const day = (s: GameState) => { s.hour = at(2005, 1, 3, 9); for (let h = 0; h < 8; h++) { staffTick(s); s.hour++; } };

  it("idles a bookkeeper on a single-user licence and puts them to work with a seat", () => {
    const { s, A } = ledger();
    run(s, "wizo", "l");
    const e = clerk(s);
    expect(seated(s, e)).toBe(false);
    day(s);
    expect(A().status).toBe("draft");
    s.books.seats = 1;
    expect(seated(s, e)).toBe(true);
    day(s);
    expect(A().status).toBe("open");
  });

  it("seats every bookkeeper with a network version and three users on Collmix plus", () => {
    const { s } = ledger();
    const a = clerk(s), b = clerk(s), c = clerk(s);
    run(s, "lexwear", "financial-office-pro");
    expect([a, b, c].every((e) => seated(s, e))).toBe(true);
    run(s, "collmix", "plus");
    expect([a, b, c].map((e) => seated(s, e))).toEqual([true, true, false]);
  });
});

describe("browser programs", () => {
  it("stop working while the line is cut or throttled, and desktop programs keep going", () => {
    const { s, B } = ledger();
    run(s, "collmix", "plus");
    s.payables.push({ id: "pay1", supplier: "upstream", name: "Upstream", number: "1", amount: 30, issuedAt: s.hour - 30 * 24, dueAt: s.hour - 8 * 24, paidAt: null, lines: [] } as never);
    expect(booksOffline(s)).toBe(true);
    expect(works(s, "match-by-reference")).toBe(false);
    booksTick(s);
    expect(B().status).not.toBe("paid");
    run(s, "lexwear", "financial-office");
    expect(booksOffline(s)).toBe(false);
    booksTick(s);
    expect(B().status).toBe("paid");
  });
});

describe("GnuCache", () => {
  it("has no quotes, and the order ticket takes a typed price instead", () => {
    const s = readyGame(9);
    installBooks(s, "gnucache");
    expect(s.books.edition).toBe("free");
    expect(hasFeature(s, "quotes")).toBe(false);
    expect(hasFeature(s, "reports")).toBe(true);
    const r = orderLead(s, "smallBiz", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100, owned: false } : x));
    expect(quoteOrder(s, r.ticketId!, 10, 0)).toMatchObject({ ok: true });
    for (let i = 0; i < 60 && !stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote; i++) tick(s);
    expect(stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote).toBe(true);
  });
});

describe("Overview and Statistics", () => {
  it("sum money in and out per month and count back each month's closing cash", () => {
    const s = game();
    s.ledger = [
      { hour: at(2005, 1, 5), category: "payments", key: "x", params: {}, amount: 300 },
      { hour: at(2005, 2, 5), category: "rent", key: "x", params: {}, amount: -100 },
      { hour: at(2005, 3, 2), category: "payments", key: "x", params: {}, amount: 50 },
      { hour: at(2005, 3, 3), category: "power", key: "x", params: {}, amount: -20 },
    ];
    s.cash = 1_000;
    expect(cashFlow(s, 3)).toEqual([
      { key: "2005-01", inflow: 300, outflow: 0, end: 1_070 },
      { key: "2005-02", inflow: 0, outflow: 100, end: 970 },
      { key: "2005-03", inflow: 50, outflow: 20, end: 1_000 },
    ]);
  });

  it("count customers, new and lost ones, revenue and lost sales per month", () => {
    const s = game();
    const c = (id: string, since: number, churnedAt: number | null) => ({ ...s.customers[0], id, since, churnedAt, sponsor: undefined });
    s.customers = [c("a", at(2005, 1, 2), null), c("b", at(2005, 2, 2), at(2005, 3, 1)), c("c", at(2005, 3, 4), null)] as never;
    s.ledger = [{ hour: at(2005, 2, 9), category: "setup", key: "x", params: {}, amount: 25 }];
    s.sales.lost = [{ hour: at(2005, 3, 5) } as never];
    expect(monthlyStats(s, 3)).toEqual([
      { key: "2005-01", customers: 1, joined: 1, churned: 0, revenue: 0, lost: 0 },
      { key: "2005-02", customers: 2, joined: 1, churned: 0, revenue: 25, lost: 0 },
      { key: "2005-03", customers: 2, joined: 1, churned: 1, revenue: 0, lost: 1 },
    ]);
  });
});

describe("setup fee income", () => {
  it("counts toward profit next to the customer payments of the same invoice", () => {
    const s = withServer(fixtureGame(3));
    const h = s.hour;
    s.ledger = [entry(h, "setup", 5, "ledger.setup"), entry(h, "payments", 12, "ledger.payment")];
    expect(profitBetween(s, h, h + 1)).toBe(17);
  });
});

describe("taxable profit", () => {
  it("counts loan interest and leaves principal out, and books no tax by itself in April", () => {
    const s = withServer(fixtureGame(11));
    const h = at(2005, 6, 1, 0);
    s.ledger = [
      entry(h, "payments", 10_000), entry(h, "hardware", -2_000), entry(h, "loans", 5_000, "ledger.loanTaken"),
      entry(h, "loans", -500, "ledger.loanRepayment", { amount: 5_000, interest: 50 }), entry(at(2006, 2, 1, 0), "payments", 999),
    ];
    expect(profitBetween(s, yearStart(2005), yearStart(2006))).toBe(7_950);
    tickInto(s, at(2006, 4, 1, 0));
    expect(s.ledger.some((e) => e.category === "tax")).toBe(false);
  });
});

describe("bankruptcy", () => {
  it("ends the game after 30 days below zero when the bank lends nothing", () => {
    const s = withServer(fixtureGame(15));
    s.cash = -50_000;
    s.loansBlockedUntil = at(2010, 1, 1, 0);
    const events = runFor(s, INSOLVENT_DAYS * 24);
    expect(events.filter((e) => e.key === "event.cashNegative")).toHaveLength(1);
    expect(s.gameOver).toBe(null);
    expect(runFor(s, 1)).toContainEqual({ app: "Books", key: "event.bankrupt", params: { days: INSOLVENT_DAYS } });
    expect(s.gameOver).toBe(s.hour);
  });

  it("keeps going while a loan could cover the deficit, and resets once cash is back above zero", () => {
    const s = withServer(fixtureGame(16));
    s.cash = -100;
    runFor(s, (INSOLVENT_DAYS + 2) * 24);
    expect(s.gameOver).toBe(null);
    s.loansBlockedUntil = at(2010, 1, 1, 0);
    s.cash = 100;
    runFor(s, 1);
    expect(s.brokeSince).toBe(null);
    s.cash = -100;
    runFor(s, (INSOLVENT_DAYS - 1) * 24);
    expect(s.gameOver).toBe(null);
  });

  it("loads an old save without finance fields", () => {
    const old = { ...withServer(fixtureGame(17)) } as Partial<GameState>;
    delete old.taxLoss; delete old.brokeSince; delete old.gameOver;
    expect(deserialize(JSON.stringify(old))).toMatchObject({ taxLoss: 0, brokeSince: null, gameOver: null });
  });

  it("drops the insurance policies of an old save", () => {
    const old = { ...withServer(fixtureGame(18)), insurance: [{ id: "hardware", since: 0 }] };
    const s = deserialize(JSON.stringify(old));
    expect("insurance" in s).toBe(false);
    expect(serialize(s)).not.toContain("insurance\"");
  });
});

describe("Finance in old saves", () => {
  it("installs Books in place of Finance, with GnuCache when no program ran", () => {
    const raw = JSON.parse(serialize(game()));
    raw.installed = [...raw.installed.filter((id: string) => id !== "Books"), "Finance"];
    raw.books = { vendor: null, installedAt: 0, edition: null, seats: 0 };
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).toContain("Books");
    expect(s.installed).not.toContain("Finance");
    expect(s.books).toMatchObject({ vendor: "gnucache", edition: "free", seats: 0 });

    raw.installed = [...raw.installed, "Books"];
    raw.books = { vendor: "wizo", installedAt: 0, edition: "m", seats: 0 };
    expect(deserialize(JSON.stringify(raw)).books).toMatchObject({ vendor: "wizo", edition: "m" });
  });
});
