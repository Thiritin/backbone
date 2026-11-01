import { afterEach, describe, expect, it } from "vitest";
import { dateOf } from "../src/sim/00-core/time";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { issueInvoice } from "../src/sim/30-market/manual";
import { orderLead } from "../src/sim/30-market/orders";
import { billingTick, dueStep, synced } from "../src/sim/45-billing/billing";
import type { GameState } from "../src/sim/50-state";
import { deliverLicences, licenceKey, licenceMail } from "../src/sim/80-business/licences";
import { booksView, payoutTick, PAYOUT_DAY, PAYOUT_HOUR } from "../src/sim/80-business/shoplink";
import { matchTransfer } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { buyLicence, registerLicence } from "../src/sim/90-actions/licences";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { buyShopLink, importFromShop } from "../src/sim/90-actions/shoplink";
import { resolve } from "../src/sim/80-business/browser";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { automate, readyGame } from "./fixtures";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

// Private shop customers pay by bank transfer unless a test sends them through PayPail's gateway.
const saved = PREFERENCE.private;
const prefer = (w: typeof saved) => { PREFERENCE.private = w; };
afterEach(() => prefer(saved));

// ModemBill takes orders, placed at once and offering PayPail; link adds the Shop link module.
function shopGame(seed = 5, link = false): GameState {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "handRolled");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "modemBill").ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  s.modules = [...s.modules, "paypail"];
  prefer({ transfer: 1 });
  if (link) s.modules = [...s.modules, "shop-link"];
  return automate(s);
}

function order(s: GameState) {
  const r = orderLead(s, "private", "Frankfurt", [], web, false);
  const id = s.sales.requests.find((x) => x.id === r.id)!.customerId!;
  return { customer: () => s.customers.find((c) => c.id === id)!, first: () => s.invoices.find((i) => i.customerId === id)! };
}

// A further shop invoice whose payment reaches the bank in the next hour.
function paidByTransfer(s: GameState, customerId: string) {
  const inv = issueInvoice(s, customerId, [{ serviceId: null, key: "invoice.line.setupFee", params: { label: "x" }, amount: 20 }]);
  Object.assign(inv, { payStep: 0, payAt: s.hour + 1 });
  s.hour++;
  billingTick(s);
  const tr = s.transfers.find((x) => x.forInvoice === inv.id)!;
  return { inv: () => s.invoices.find((i) => i.id === inv.id)!, tr: () => s.transfers.find((x) => x.id === tr.id)! };
}

const toPayout = (s: GameState) => {
  while (dateOf(s.hour).getUTCDay() !== PAYOUT_DAY || dateOf(s.hour).getUTCHours() !== PAYOUT_HOUR) s.hour++;
  payoutTick(s);
  return s.transfers.find((x) => x.covers)!;
};

describe("shop link", () => {
  it("starts shop records unsynced and hides them from Books", () => {
    const s = shopGame();
    prefer({ paypail: 1 });
    const { customer, first } = order(s);
    expect(customer()).toMatchObject({ source: "shop", synced: false });
    expect(first()).toMatchObject({ source: "shop", synced: false, gateway: true, shopPaid: true });
    const view = booksView(s);
    expect(view.customers.some((c) => c.id === customer().id)).toBe(false);
    expect(view.invoices.some((i) => i.id === first().id)).toBe(false);
  });

  it("imports the shop's records and books the transfer that waited for them", () => {
    const s = shopGame();
    const { customer } = order(s);
    const { inv, tr } = paidByTransfer(s, customer().id);
    expect(inv()).toMatchObject({ source: "shop", synced: false, bank: true });
    expect(tr().invoiceId).toBeNull();
    expect(matchTransfer(s, tr().id, inv().id)).toMatchObject({ ok: false, error: "error.invoiceSettled" });
    expect(importFromShop(s).ok).toBe(true);
    expect(synced(customer()) && synced(inv())).toBe(true);
    expect(inv().status).toBe("paid");
    expect(inv().shopPaid).toBeUndefined();
    expect(tr().invoiceId).toBe(inv().id);
    expect(importFromShop(s)).toMatchObject({ ok: false, error: "error.nothingToImport" });
  });

  it("sends no reminder for an unsynced invoice", () => {
    const s = shopGame();
    s.modules = [...s.modules, "auto-reminders"];
    s.billingRules = { ...s.billingRules, autoRemind: true };
    const { customer } = order(s);
    const inv = issueInvoice(s, customer().id, [{ serviceId: null, key: "invoice.line.setupFee", params: { label: "x" }, amount: 20 }]);
    Object.assign(inv, { payStep: 4, payAt: null, dueAt: s.hour - 30 * 24 });
    billingTick(s);
    const now = () => s.invoices.find((i) => i.id === inv.id)!;
    expect(now().reminders).toEqual([]);
    expect(dueStep(now(), s.hour)).toBeNull();
    importFromShop(s);
    expect(dueStep(now(), s.hour)).toBe(0);
  });

  it("syncs at creation with Shop link and marks the shop's invoice paid on a match", () => {
    const s = shopGame(5, true);
    const { customer, first } = order(s);
    expect(customer().source).toBe("shop");
    expect(synced(customer()) && synced(first())).toBe(true);
    const { inv, tr } = paidByTransfer(s, customer().id);
    expect(synced(inv())).toBe(true);
    expect(matchTransfer(s, tr().id, inv().id).ok).toBe(true);
    expect(inv()).toMatchObject({ status: "paid", shopPaid: true });
  });

  it("pays out the gateway weekly as one transfer that Import resolves into its invoices", () => {
    const s = shopGame();
    prefer({ paypail: 1 });
    const a = order(s), b = order(s);
    const payout = toPayout(s);
    expect(payout.covers).toEqual([a.first().id, b.first().id]);
    expect(payout.params.numbers).toBe(`${a.first().number}, ${b.first().number}`);
    expect(payout.invoiceId).toBeNull();
    expect(matchTransfer(s, payout.id, a.first().id)).toMatchObject({ ok: false });
    importFromShop(s);
    expect([a.first().status, b.first().status]).toEqual(["paid", "paid"]);
    expect(s.transfers.find((x) => x.id === payout.id)!.matchedAt).toBe(s.hour);
  });

  it("resolves a payout at once with Shop link", () => {
    const s = shopGame(5, true);
    prefer({ paypail: 1 });
    const a = order(s);
    const payout = toPayout(s);
    expect(s.transfers.find((x) => x.id === payout.id)!.invoiceId).toBe(a.first().id);
    expect(a.first().status).toBe("paid");
  });

  it("is sold on the shop vendor's site with a licence key from the vendor", () => {
    const plain = readyGame(5);
    plain.cash = 1000;
    expect(buyLicence(plain, "shop-link")).toMatchObject({ ok: false, error: "error.noShopSystem" });
    const s = shopGame();
    expect(resolve(s, "www.modembill.com/").page).toEqual({ kind: "shopVendor", id: "modemBill" });
    expect(resolve(s, "www.clientexit.com/").page).toEqual({ kind: "shopVendor", id: "clientExit" });
    expect(buyShopLink(s, "clientExit")).toMatchObject({ ok: false, error: "error.noShopSystem" });
    expect(buyShopLink(s, "modemBill").ok).toBe(true);
    s.hour++;
    deliverLicences(s);
    const mail = licenceMail(s, "shop-link")!;
    expect(mail.topic).toBe("shop-link.licence");
    expect(mail.mail!.params.shop).toBe("ModemBill");
    expect(registerLicence(s, licenceKey(s, "shop-link")).ok).toBe(true);
    expect(s.modules).toContain("shop-link");
  });

  it("loads an old save with every record synced and keeps unsynced ones", () => {
    const old = readyGame(7);
    const id = addCustomer(old, "Krause IT", "agency", "prompt");
    addService(old, id, "domain", "krause.de", 12, "year");
    tick(old);
    const loaded = deserialize(serialize(old));
    expect(loaded.customers.length).toBeGreaterThan(0);
    expect(loaded.invoices.length).toBeGreaterThan(0);
    expect([...loaded.customers, ...loaded.invoices].every(synced)).toBe(true);
    const s = shopGame();
    order(s);
    const again = deserialize(serialize(s));
    expect(again.customers.filter((c) => !synced(c))).toHaveLength(1);
  });
});
