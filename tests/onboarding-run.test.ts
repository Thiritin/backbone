import { describe, expect, it } from "vitest";
import { startGame } from "../src/sim/90-actions/start";
import { cardBoard, checkDone, TUTORIAL } from "../src/sim/checklist";
import { supplierAccount, supplierCode } from "../src/sim/46-finance/payables";
import { hostFor, stepsDone } from "../src/sim/30-market/manual";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount, confirmTransfer, startTransfer } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { orderCompanyDomain } from "../src/sim/90-actions/registrar";
import { buildSite, launchSite, setLine } from "../src/sim/90-actions/website";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { connect } from "../src/sim/90-actions/hardware";
import { setPortShare } from "../src/sim/90-actions/lan";
import { installPanel } from "../src/sim/90-actions/clusters";
import { buyBooks, installBooks } from "../src/sim/90-actions/bookkeeping";
import { confirmOrder, createAccount, provisionOrder, registerOrderDomain, sendOrderAccess } from "../src/sim/90-actions/orders";
import { bootedMachine, buyDevice, mailed, owner, quoteOrder, settle } from "./fixtures";
import { mountDevice } from "./plugged";
import { cardOf } from "../src/ui/apps/guide";
import { appByName } from "../src/ui/apps/registry";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

// The card the player sees now: it resolves to an installed-or-store app, and the board says which card is current.
const current = (s: GameState, id: string) => {
  const b = cardBoard(s);
  expect(b.current?.id).toBe(id);
  expect(appByName(cardOf(s, b.current!).step.app)).toBeDefined();
};
const cardDone = (s: GameState, id: string) => { const b = cardBoard(s); return b.done[b.cards.findIndex((c) => c.id === id)]; };

describe("scripted first hour", () => {
  it("runs the ten cards from the bank to the first invoice within 168 game hours", () => {
    const s = startGame(1);
    const t0 = s.hour;
    current(s, "bank");
    ok(openBankAccount(s, "sparklasse"));
    expect(cardDone(s, "bank")).toBe(true);
    current(s, "register");
    ok(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }));
    current(s, "domain");
    ok(orderCompanyDomain(s, "nameCheep", "basement-hosting.de"));
    current(s, "website");
    ok(buildSite(s));
    // The fee letter arrives, the site builds: both wait while the player carries on.
    expect(cardBoard(s).wait[cardBoard(s).cards.findIndex((c) => c.id === "website")]).toBe(true);
    run(s, 2);
    current(s, "payBill");
    const fee = s.payables.find((p) => p.supplier === "office")!;
    ok(startTransfer(s, { name: fee.name, account: supplierAccount(fee.supplier), code: supplierCode, amount: fee.amount, reference: fee.number }));
    ok(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]));
    expect(cardDone(s, "payBill")).toBe(true);
    current(s, "buyServer");
    const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(cardDone(s, "buyServer")).toBe(true);
    current(s, "mountServer");
    ok(mountDevice(s, srv, "rack2", 1));
    ok(connect(s, { device: srv, port: 0 }, { device: "dev5", port: 0 }));
    ok(connect(s, { device: "dev5", port: 4 }, { device: "dev6", port: 0 }));
    settle(s);
    expect(cardDone(s, "mountServer")).toBe(true);
    current(s, "installOs");
    bootedMachine(s, srv);
    expect(cardDone(s, "installOs")).toBe(true);
    // Hosting needs the built site: the card waits for nothing but the player once the 72 hours have passed.
    run(s, Math.max(0, s.marketing.siteReady! - s.hour));
    expect(cardDone(s, "website")).toBe(true);
    current(s, "hosting");
    ok(installPanel(s, srv, "freepanel"));
    run(s, 24);
    ok(setPortShare(s, "dev5", srv, "web"));
    ok(launchSite(s, { kind: "rented" }));
    ok(setUpChannel(s, "website"));
    ok(setLine(s, "webHosting", true));
    expect(cardDone(s, "hosting")).toBe(true);
    current(s, "firstOrder");
    // The first order comes in on its own within three days.
    for (let h = 0; h < 72 && !s.sales.requests.some((r) => r.kind === "order"); h++) tick(s);
    const req = () => s.sales.requests.find((r) => r.kind === "order")!;
    expect(req()).toBeDefined();
    const id = req().ticketId!;
    // The player prices to the customer; the seeded customer's budget is lifted so the quote is taken.
    s.sales.requests = s.sales.requests.map((x) => (x.id === req().id ? { ...x, budget: 100 } : x));
    ok(quoteOrder(s, id, 12));
    for (let i = 0; i < 60 && !stepsDone(s, req()).quote; i++) tick(s);
    ok(createAccount(s, id, mailed(s, id)));
    run(s, 1);
    ok(confirmOrder(s, id));
    run(s, 1);
    ok(registerOrderDomain(s, id, ...owner(s, id)));
    run(s, 1);
    ok(provisionOrder(s, id, hostFor(s, req())!));
    run(s, 1);
    ok(sendOrderAccess(s, id));
    ok(buyBooks(s, "orgamin"));
    s.books.download!.readyAt = s.hour;
    ok(installBooks(s, "orgamin"));
    run(s, 1);
    for (const g of TUTORIAL) expect(checkDone(s, g), g).toBe(true);
    // Chapter one is over: the board moves on to the later chapter.
    expect(cardBoard(s).cards[0]?.chapter).toBe(2);
    expect(s.hour - t0).toBeLessThanOrEqual(168);
  });
});
