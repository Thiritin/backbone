import { afterEach, describe, expect, it } from "vitest";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { issueInvoice, stepsDone } from "../src/sim/30-market/manual";
import { orderLead } from "../src/sim/30-market/orders";
import { billingTick, synced } from "../src/sim/45-billing/billing";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { can } from "../src/sim/80-business/bookkeeping";
import { booksView } from "../src/sim/80-business/shoplink";
import { tick } from "../src/sim/88-tick/tick";
import { installBooks, uninstallBooks, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { downloadStatement, exportShop, importFile } from "../src/sim/90-actions/dataflow";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { quoteOrder } from "../src/sim/90-actions/orders";
import { chooseShop } from "../src/sim/90-actions/shop";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame } from "./fixtures";

const saved = PREFERENCE.private;
afterEach(() => { PREFERENCE.private = saved; });

// ModemBill takes orders by bank transfer; Lexwear's smallest edition keeps the books and Sparklasse the account.
function shopGame(seed = 5): GameState {
  const s = readyGame(seed);
  s.cash = 1e6;
  s.bank = openAccount(s, "sparklasse");
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "modemBill").ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  PREFERENCE.private = { transfer: 1 };
  installBooks(s, "lexwear");
  return automate(s);
}

function order(s: GameState) {
  const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 1, sla: "basic" }, false);
  const id = s.sales.requests.find((x) => x.id === r.id)!.customerId!;
  return { customer: () => s.customers.find((c) => c.id === id)!, first: () => s.invoices.find((i) => i.customerId === id)! };
}

// A shop invoice whose transfer reaches the bank in the next hour.
function paid(s: GameState, customerId: string) {
  const inv = issueInvoice(s, customerId, [{ serviceId: null, key: "invoice.line.setupFee", params: { label: "x" }, amount: 20 }]);
  Object.assign(inv, { payStep: 0, payAt: s.hour + 1 });
  s.hour++;
  billingTick(s);
  const tr = s.transfers.find((x) => x.forInvoice === inv.id)!;
  return { inv: () => s.invoices.find((i) => i.id === inv.id)!, tr: () => s.transfers.find((x) => x.id === tr.id)! };
}
const file = (s: GameState, id: string) => s.docs.find((d) => d.id === id)!;

describe("capabilities", () => {
  it("follow the installed programs", () => {
    const s = readyGame(9);
    s.cash = 50_000;
    s.books = { vendor: null, installedAt: 0, edition: null, seats: 0 };
    s.shop = { ...s.shop, variant: null };
    expect(can(s, "customers")).toBe(false);
    s.shop = { ...s.shop, variant: "whmCache" };
    expect(["customers", "invoices", "payments", "reminders"].every((c) => can(s, c as never))).toBe(true);
    expect(can(s, "payables") || can(s, "quotes") || can(s, "tax")).toBe(false);
    installBooks(s, "lexwear");
    expect(can(s, "quotes") && can(s, "payables") && can(s, "statement")).toBe(true);
    expect(can(s, "tax")).toBe(false);
    upgradeBooks(s, "financial-office-pro");
    expect(can(s, "tax") && can(s, "statistics")).toBe(true);
  });

  it("leave Books off the desktop without a program, and the ticket keeps its plain quote step", () => {
    const s = readyGame(9);
    s.cash = 50_000;
    installBooks(s, "lexwear");
    expect(s.installed).toContain("Books");
    expect(uninstallBooks(s).ok).toBe(true);
    expect(s.installed).not.toContain("Books");
    expect(s.books.vendor).toBeNull();
    expect(uninstallBooks(s).ok).toBe(false);
    expect(can(s, "quotes")).toBe(false);
    const r = orderLead(s, "smallBiz", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100, owned: false } : x));
    expect(quoteOrder(s, r.ticketId!, 10, 0)).toMatchObject({ ok: true });
    for (let i = 0; i < 60 && !stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote; i++) tick(s);
    expect(stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote).toBe(true);
  });
});

describe("files", () => {
  it("export the shop's records, and Books imports them once and books the transfers waiting for them", () => {
    const s = shopGame();
    const { customer } = order(s);
    const { inv, tr } = paid(s, customer().id);
    expect(synced(inv())).toBe(false);
    const st = downloadStatement(s);
    expect(st.ok).toBe(true);
    expect(file(s, st.id!)).toMatchObject({ kind: "file", file: { kind: "statement", ids: [tr().id], imported: [] } });
    expect(file(s, st.id!).title).toMatch(/^statement-\d{4}-\d{2}\.sta$/);
    expect(file(s, st.id!).body).toContain(":61:");
    expect(importFile(s, st.id!).ok).toBe(true);
    expect(tr().invoiceId).toBeNull();
    const ex = exportShop(s);
    expect(ex.ok).toBe(true);
    const f = file(s, ex.id!);
    expect(f.title).toMatch(/^shop-export-\d{4}-\d{2}\.csv$/);
    expect(f.file!.ids).toEqual(expect.arrayContaining([customer().id, inv().id]));
    expect(f.body.split("\n")).toHaveLength(f.file!.ids.length + 1);
    expect(exportShop(s)).toMatchObject({ ok: false, error: "error.nothingToExport" });
    expect(importFile(s, ex.id!).ok).toBe(true);
    expect(synced(customer()) && synced(inv())).toBe(true);
    expect(inv().status).toBe("paid");
    expect(tr().invoiceId).toBe(inv().id);
    expect(file(s, ex.id!).file!.imported).toEqual(["lexwear"]);
    expect(importFile(s, ex.id!)).toMatchObject({ ok: false, error: "error.fileImported" });
    const next = order(s);
    const second = exportShop(s);
    expect(file(s, second.id!).file!.ids).toContain(next.customer().id);
    expect(file(s, second.id!).file!.ids).not.toContain(customer().id);
    expect(file(s, second.id!).title).toMatch(/-2\.csv$/);
  });
});

describe("bank", () => {
  it("keeps transfers out of Books until the statement is imported", () => {
    const s = shopGame();
    const { customer } = order(s);
    importFile(s, exportShop(s).id!);
    const { tr } = paid(s, customer().id);
    for (let i = 0; i < 3; i++) tick(s);
    expect(tr().atBank).toBe(true);
    expect(booksView(s).transfers.some((x) => x.id === tr().id)).toBe(false);
    importFile(s, downloadStatement(s).id!);
    expect(booksView(s).transfers.some((x) => x.id === tr().id)).toBe(true);
    expect(downloadStatement(s)).toMatchObject({ ok: false, error: "error.nothingToExport" });
  });

  it("pulls new transfers on its own with HBCI", () => {
    const s = shopGame();
    upgradeBooks(s, "financial-office");
    const { customer } = order(s);
    importFile(s, exportShop(s).id!);
    const { tr } = paid(s, customer().id);
    expect(tr().atBank).toBe(true);
    tick(s);
    expect(tr().atBank).toBeUndefined();
    expect(booksView(s).transfers.some((x) => x.id === tr().id)).toBe(true);
  });

  it("loads an old save with every transfer in Books", () => {
    const s = shopGame();
    const { customer } = order(s);
    importFile(s, exportShop(s).id!);
    const { tr } = paid(s, customer().id);
    const raw = JSON.parse(serialize(s));
    for (const x of raw.transfers) delete x.atBank;
    raw.docs = raw.docs.filter((d: { kind: string }) => d.kind !== "file");
    const loaded = deserialize(JSON.stringify(raw));
    expect(booksView(loaded).transfers.map((x) => x.id)).toContain(tr().id);
    expect(loaded.docs.some((d) => d.id === "guide")).toBe(true);
  });
});
