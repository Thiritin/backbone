import { afterEach, describe, expect, it } from "vitest";
import { dateOf, hourOf } from "../src/sim/00-core/time";
import { DEBIT_RETURN_FEE, DISPUTE_DAYS, methodById, methodFee, PAYMENT_METHODS, PREFERENCE, type MethodId } from "../src/sim/10-catalog/payments";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { orderLead } from "../src/sim/30-market/orders";
import { issueInvoice } from "../src/sim/30-market/manual";
import { lostReasons } from "../src/sim/30-market/research";
import { dueStep, invoiceTotal, isSuspended, ruleSuspendsAt, type Invoice } from "../src/sim/45-billing/billing";
import { CHARGEBACK_FEE, fraudTick } from "../src/sim/45-billing/fraud";
import { offers, paymentsTick, preferredMethod } from "../src/sim/45-billing/payments";
import type { GameState } from "../src/sim/50-state";
import { monthlyRate } from "../src/sim/40-support/tick";
import { matchByReference } from "../src/sim/80-business/lexwear";
import { payoutTick, PAYOUT_DAY, PAYOUT_HOUR } from "../src/sim/80-business/shoplink";
import { matchTransfer } from "../src/sim/90-actions/billing";
import { addCustomer } from "../src/sim/90-actions/customers";
import { buyLicence } from "../src/sim/90-actions/lexwear";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { importFromShop, setPaymentMethod } from "../src/sim/90-actions/shoplink";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame } from "./fixtures";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };
const DAY = 24;

// Private shop customers pay by whatever a test sets; the table is restored after each test.
const saved = PREFERENCE.private;
const prefer = (id: MethodId) => { PREFERENCE.private = { [id]: 1 }; };
afterEach(() => { PREFERENCE.private = saved; });

// ModemBill takes orders, placed at once and synced into Books, with the given methods registered.
function shopGame(methods: MethodId[] = [], seed = 5): GameState {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "handRolled");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "modemBill").ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  s.modules = [...s.modules, "shop-link", ...methods];
  return automate(s);
}

function order(s: GameState, profile = "private" as const, city = "Frankfurt") {
  const r = orderLead(s, profile, city, [], web, false);
  const id = () => s.sales.requests.find((x) => x.id === r.id)!.customerId;
  return { r: () => s.sales.requests.find((x) => x.id === r.id)!, customer: () => s.customers.find((c) => c.id === id())!, first: () => s.invoices.find((i) => i.customerId === id())! };
}

const toPayout = (s: GameState) => {
  do s.hour++; while (dateOf(s.hour).getUTCDay() !== PAYOUT_DAY || dateOf(s.hour).getUTCHours() !== PAYOUT_HOUR);
  payoutTick(s);
  return s.transfers.filter((x) => x.covers && x.hour === s.hour);
};
const invoice = (s: GameState, id: string) => s.invoices.find((i) => i.id === id)!;
const backFor = (s: GameState, inv: Invoice) => s.transfers.find((x) => x.back && x.forInvoice === inv.id)!;

describe("payment methods", () => {
  it("unlock in their year and only then show up in what customers want", () => {
    for (const m of PAYMENT_METHODS.filter((x) => x.id !== "transfer")) {
      const s = shopGame();
      s.hour = hourOf(new Date(Date.UTC(m.year - 1, 11, 31)));
      expect(buyLicence(s, m.id)).toMatchObject({ ok: false, error: "error.unknownModule" });
      s.hour += 2 * DAY;
      expect(buyLicence(s, m.id).ok).toBe(true);
    }
    const s = shopGame();
    const drawn = (year: number) => {
      s.hour = hourOf(new Date(Date.UTC(year, 5, 1)));
      return new Set(Array.from({ length: 300 }, (_, i) => preferredMethod(s, "gamer", "Frankfurt", false, i)));
    };
    expect(drawn(2005).has("paysafe")).toBe(false);
    expect(drawn(2008).has("paysafe")).toBe(true);
    s.hour = hourOf(new Date(Date.UTC(2013, 0, 1)));
    expect(new Set(Array.from({ length: 300 }, (_, i) => preferredMethod(s, "private", "Frankfurt", true, i))).has("crypto")).toBe(true);
  });

  it("take their fees off the weekly payout, one transfer per method", () => {
    const s = shopGame(["paypail", "card"]);
    s.hour = hourOf(new Date(Date.UTC(2006, 0, 2)));
    prefer("paypail");
    const a = order(s), b = order(s);
    prefer("card");
    const c = order(s);
    expect([a.first().method, c.first().method]).toEqual(["paypail", "card"]);
    const payouts = toPayout(s);
    expect(payouts.map((x) => x.from).sort()).toEqual(["PayPail", "Visor"]);
    const pp = payouts.find((x) => x.from === "PayPail")!;
    const gross = invoiceTotal(a.first()) + invoiceTotal(b.first());
    const fees = methodFee(methodById("paypail"), invoiceTotal(a.first())) + methodFee(methodById("paypail"), invoiceTotal(b.first()));
    expect(pp.amount).toBeCloseTo(gross - fees, 2);
    expect(s.ledger.some((e) => e.key === "ledger.paymentFees" && e.params.from === "PayPail")).toBe(true);
    expect([a.first().status, c.first().status]).toEqual(["paid", "paid"]);
  });

  it("lose a shop sale whose preferred method is missing, and never a paysavecard one", () => {
    const s = shopGame();
    s.hour = hourOf(new Date(Date.UTC(2008, 5, 1)));
    prefer("paysafe");
    const r = order(s).r();
    expect(r.status).toBe("lost");
    expect(lostReasons(s, 3).some((g) => g.reason === "lost.paymentMethod.paysafe")).toBe(true);
    prefer("paypail");
    const outcomes = Array.from({ length: 200 }, () => order(s).r());
    const lost = lostReasons(s, 3).find((g) => g.reason === "lost.paymentMethod.paypail")!.count / outcomes.length;
    expect(lost).toBeGreaterThan(0.35);
    expect(lost).toBeLessThan(0.65);
    expect(outcomes.every((x) => x.method === undefined)).toBe(true);
    // Switched off, a registered method counts as missing.
    s.modules = [...s.modules, "paypail"];
    expect(offers(s, "paypail")).toBe(true);
    expect(setPaymentMethod(s, "paypail", false).ok).toBe(true);
    expect(offers(s, "paypail")).toBe(false);
  });

  it("keep email orders on bank transfer", () => {
    const s = shopGame(["paypail"]);
    prefer("paypail");
    const r = orderLead(s, "private", "Frankfurt", [], web, true);
    expect(r.method).toBeUndefined();
  });

  it("skip reminders and suspension for prepaid invoices", () => {
    const s = shopGame(["paypail", "paysafe", "crypto"]);
    s.hour = hourOf(new Date(Date.UTC(2013, 0, 7)));
    s.billingRules = { ...s.billingRules, autoSuspendDays: 7 };
    for (const id of ["paypail", "paysafe", "crypto"] as const) {
      const c = addCustomer(s, `Pays by ${id}`, "gamer");
      s.customers = s.customers.map((x) => (x.id === c ? { ...x, source: "shop", method: id } : x));
      const inv = issueInvoice(s, c, [{ serviceId: null, key: "invoice.line.setupFee", params: { label: "x" }, amount: 20 }]);
      expect(inv).toMatchObject({ method: id, gateway: true, payAt: null });
      const late = { ...inv, status: "overdue" as const, dueAt: s.hour - 60 * DAY };
      expect(dueStep(late, s.hour)).toBeNull();
      expect(ruleSuspendsAt(s, late)).toBeNull();
    }
  });

  it("reopen an invoice when a chargeback is matched, and suspend a stolen card's customer", () => {
    const s = shopGame(["card"]);
    s.hour = hourOf(new Date(Date.UTC(2007, 0, 1)));
    prefer("card");
    const honest = order(s), thief = order(s);
    toPayout(s);
    const inv = honest.first();
    expect(inv.status).toBe("paid");
    s.invoices = s.invoices.map((i) => (i.id === inv.id ? { ...i, back: { kind: "chargeback", at: s.hour } } : i));
    paymentsTick(s);
    const tr = backFor(s, inv);
    expect(tr).toMatchObject({ back: "chargeback", from: "Visor", amount: -(invoiceTotal(inv) + CHARGEBACK_FEE) });
    expect(matchTransfer(s, tr.id, inv.id).ok).toBe(true);
    expect(invoice(s, inv.id)).toMatchObject({ status: "open", bank: true, reminders: [] });
    expect(invoice(s, inv.id).gateway).toBeUndefined();
    expect(dueStep(invoice(s, inv.id), invoice(s, inv.id).dueAt + 7 * DAY)).toBe(0);

    s.customers = s.customers.map((c) => (c.id === thief.customer().id ? { ...c, chargebackAt: s.hour } : c));
    fraudTick(s);
    const stolen = backFor(s, thief.first());
    expect(stolen.fraud).toBe(true);
    expect(thief.customer().churnedAt).toBeNull();
    // Match by reference books it on its own.
    matchByReference(s);
    expect(thief.customer().fraud).toBe(true);
    expect(thief.first()).toMatchObject({ status: "open", suspended: true });
    expect(isSuspended(s, thief.customer().id)).toBe(true);
  });

  it("hold a disputed payment for thirty days and return a bad payer's debit with its fee", () => {
    const s = shopGame(["paypail", "debit"]);
    prefer("paypail");
    const pp = order(s);
    prefer("debit");
    const debit = order(s);
    s.customers = s.customers.map((c) => (c.id === debit.customer().id ? { ...c, habit: "bad" } : c));
    s.invoices = s.invoices.map((i) => (i.id === debit.first().id ? { ...i, payStep: 2 } : i));
    toPayout(s);
    expect(debit.first().back?.kind).toBe("return");
    s.hour = debit.first().back!.at;
    paymentsTick(s);
    const ret = backFor(s, debit.first());
    expect(ret.amount).toBeCloseTo(-(invoiceTotal(debit.first()) + DEBIT_RETURN_FEE), 2);
    expect(matchTransfer(s, ret.id, debit.first().id).ok).toBe(true);
    expect(debit.first()).toMatchObject({ status: "open", bank: true, payAt: null });

    s.invoices = s.invoices.map((i) => (i.id === pp.first().id ? { ...i, back: { kind: "dispute", at: s.hour } } : i));
    paymentsTick(s);
    const dispute = backFor(s, pp.first());
    expect(dispute.amount).toBe(-invoiceTotal(pp.first()));
    expect(matchTransfer(s, dispute.id, pp.first().id).ok).toBe(true);
    expect(pp.first()).toMatchObject({ status: "open", gateway: true });
    expect(dueStep({ ...pp.first(), status: "overdue" }, s.hour + 60 * DAY)).toBeNull();
    s.hour += DISPUTE_DAYS * DAY;
    paymentsTick(s);
    const release = s.transfers.find((x) => x.forInvoice === pp.first().id && x.amount > 0)!;
    expect(release.amount).toBe(invoiceTotal(pp.first()));
    expect(matchTransfer(s, release.id, pp.first().id).ok).toBe(true);
    expect(pp.first().status).toBe("paid");
  });

  it("raise abuse tickets with the share of crypto payers", () => {
    const s = shopGame();
    const ids = Array.from({ length: 20 }, (_, i) => addCustomer(s, `C${i}`, "hobbyDev"));
    const abuse = () => s.customers.filter((c) => ids.includes(c.id)).reduce((n, c) => n + monthlyRate(s, c, "abuse"), 0);
    const none = abuse();
    s.customers = s.customers.map((c) => (ids.slice(0, 10).includes(c.id) ? { ...c, method: "crypto" } : c));
    const half = abuse();
    s.customers = s.customers.map((c) => (ids.includes(c.id) ? { ...c, method: "crypto" } : c));
    expect(half).toBeGreaterThan(none);
    expect(abuse()).toBeGreaterThan(half);
  });

  it("load an old save with bank transfer only and pay out the old single gateway", () => {
    const s = shopGame();
    s.modules = s.modules.filter((m) => m !== "shop-link");
    const id = addCustomer(s, "Old Shop Customer", "private");
    const lines = [{ serviceId: null, key: "invoice.line.setupFee", params: { label: "x" }, amount: 30 }];
    const base = { customerId: id, lines, issuedAt: s.hour, dueAt: s.hour + 14 * DAY, status: "open" as const, reminders: [], suspended: false, suspendedAt: null, extendedUntil: null, payStep: 0, payAt: null, paidAt: null, source: "shop" as const, synced: false, gateway: true as const, shopPaid: true as const };
    s.invoices = [...s.invoices, { ...base, id: "inv9001", number: "2005-9001" }, { ...base, id: "inv9002", number: "2005-9002", payout: "trf9003" }];
    s.transfers = [...s.transfers, { id: "trf9003", hour: s.hour, from: "ModemBill", reference: "shop-link.ref.payout", params: { numbers: "2005-9002" }, amount: 30, invoiceId: null, matchedAt: null, forInvoice: "", covers: ["inv9002"] }];
    const data = JSON.parse(serialize(s));
    delete data.shop.methodsOff;
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.shop.methodsOff).toEqual([]);
    expect(PAYMENT_METHODS.filter((m) => offers(loaded, m.id)).map((m) => m.id)).toEqual(["transfer"]);
    const [payout] = toPayout(loaded);
    expect(payout).toMatchObject({ from: "ModemBill", amount: 30, covers: ["inv9001"] });
    expect(importFromShop(loaded).ok).toBe(true);
    expect([invoice(loaded, "inv9001").status, invoice(loaded, "inv9002").status]).toEqual(["paid", "paid"]);
  });
});
