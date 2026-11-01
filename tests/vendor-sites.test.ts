import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { MODULES } from "../src/sim/10-catalog/modules";
import { billingTick, owed } from "../src/sim/45-billing/billing";
import { staffTick } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { lexwearTick, LEXWEAR_HOST } from "../src/sim/80-business/lexwear";
import { ORDER, orderKeys } from "../src/sim/80-business/vendor-shop";
import { resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { registerLicence } from "../src/sim/90-actions/lexwear";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { hire } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

const at = (y: number, m: number, d: number, h: number) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

// Three customers: A's invoice is a draft, B's exact payment waits in the bank, C's invoice is a week overdue.
function books(seed = 9) {
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

// Buys a module through the vendor shop and returns its key.
function buy(s: GameState, id: string): string {
  addToCart(s, id, null);
  const r = checkout(s, LEXWEAR_HOST);
  return r.ok ? orderKeys(s, r.id!)[0].key : "";
}
function owned(s: GameState, id: string) {
  s.cash = 10_000;
  registerLicence(s, buy(s, id));
}

describe("Lexwear modules", () => {
  it("are sold on Lexwear's site, one page per module", () => {
    const s = newGame(9);
    expect(resolve(s, "www.lexwear.de/").page).toEqual({ kind: "lexwear" });
    expect(resolve(s, "www.lexwear.de/module/hbci").page).toEqual({ kind: "lexwear" });
    expect(MODULES.filter((m) => m.vendor === "lexwear").map((m) => m.id)).toEqual(["helpdesk-link", "monthly-run", "match-by-reference", "auto-reminders", "hbci"]);
  });

  it("are bought through the cart: the price is debited and the key arrives by email", () => {
    const s = withServer(newGame(9));
    s.cash = 1000;
    const key = buy(s, "monthly-run");
    expect(s.cash).toBe(901);
    expect(s.ledger.at(-1)).toMatchObject({ category: "licenses", key: "ledger.order", params: { vendor: "Lexwear" }, amount: -99 });
    expect(s.licenses.at(-1)).toMatchObject({ product: "monthly-run", key, machineId: null, kind: "once" });
    expect(s.tickets.at(-1)).toMatchObject({ kind: "mail", topic: ORDER, unread: true, mail: { from: "Lexwear" } });
    expect(addToCart(s, "monthly-run", null)).toEqual({ ok: false, error: "error.moduleBought" });
    s.cash = 10;
    addToCart(s, "hbci", null);
    expect(addToCart(s, "hbci", null)).toEqual({ ok: false, error: "error.moduleBought" });
    expect(checkout(s, LEXWEAR_HOST)).toEqual({ ok: false, error: "error.noCash" });
  });

  it("turn on with the emailed key and refuse a wrong one", () => {
    const s = withServer(newGame(9));
    s.cash = 1000;
    const key = buy(s, "match-by-reference");
    expect(key).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(registerLicence(s, "AAAA-BBBB-CCCC-DDDD")).toEqual({ ok: false, error: "error.licenceKey" });
    expect(s.modules).toEqual([]);
    expect(registerLicence(s, ` ${key.toLowerCase()} `)).toEqual({ ok: true, id: "match-by-reference" });
    expect(s.modules).toEqual(["match-by-reference"]);
    expect(registerLicence(s, key)).toEqual({ ok: false, error: "error.moduleRegistered" });
  });

  it("offer each module once by newsletter when its count is reached", () => {
    const s = withServer(newGame(9));
    for (let i = 0; i < 9; i++) addCustomer(s, `Kunde ${i}`, "private", "prompt");
    lexwearTick(s);
    expect(s.tickets.filter((x) => x.kind === "mail" && x.topic.startsWith("lexwear."))).toEqual([]);
    addCustomer(s, "Kunde 9", "private", "prompt");
    lexwearTick(s);
    lexwearTick(s);
    expect(s.tickets.filter((x) => x.kind === "mail" && x.topic.startsWith("lexwear."))).toMatchObject([{ topic: "lexwear.newsletter", mail: { from: "Lexwear", params: { module: "monthly-run" } } }]);
  });
});

describe("module effects", () => {
  it("Monthly run sends every draft on the first of the month at nine, and nothing else", () => {
    const { s, A, C } = books();
    owned(s, "monthly-run");
    s.hour = at(2005, 2, 1, 8);
    lexwearTick(s);
    expect(A().status).toBe("draft");
    s.hour++;
    lexwearTick(s);
    expect(A().status).toBe("open");
    expect(s.transfers[0].invoiceId).toBeNull();
    expect(C().reminders).toEqual([]);
  });

  it("Match by reference books exact payments that name their invoice and leaves the rest", () => {
    const { s, A, B, C } = books();
    owned(s, "match-by-reference");
    s.transfers.push({ ...s.transfers[0], id: "trf900", amount: owed(C()) - 0.5, params: { number: C().number }, forInvoice: C().id });
    lexwearTick(s);
    expect(B().status).toBe("paid");
    expect(s.transfers.find((x) => x.id === "trf900")!.invoiceId).toBeNull();
    expect(C().reminders).toEqual([]);
    expect(A().status).toBe("draft");
  });

  it("Automatic reminders sends the due step on its day through the billing rules, and nothing else", () => {
    const { s, A, C } = books();
    owned(s, "auto-reminders");
    expect(s.billingRules.autoRemind).toBe(true);
    s.billingRules.autoSuspendDays = 7;
    s.hour++;
    billingTick(s);
    expect(C().reminders).toEqual([s.hour]);
    expect(C().suspended).toBeFalsy();
    expect(A().status).toBe("draft");
    expect(s.transfers[0].invoiceId).toBeNull();
  });
});

describe("bookkeeper", () => {
  const clerk = (s: GameState, n = 1) => {
    for (let i = 0; i < n; i++) {
      const c = s.candidates.find((x) => x.role === "bookkeeper" && x.arriveAt <= s.hour)
        ?? { ...s.candidates[0], id: `cand${i}`, role: "bookkeeper" as const, arriveAt: 0, leaveAt: 1e9 };
      if (!s.candidates.includes(c)) s.candidates.push(c);
      const id = (hire(s, c.id) as { id: string }).id;
      Object.assign(s.staff.find((e) => e.id === id)!, { skill: 50, trained: ["reminder", "invoices", "transfers"] });
    }
  };

  it("clears drafts, transfers with odd amounts and reminders in a workday", () => {
    const { s, A, B, C } = books();
    s.billingRules.autoRemind = true;
    s.transfers[0].amount = owed(B()) - 0.01;
    clerk(s);
    s.hour = at(2005, 1, 3, 9);
    for (let h = 0; h < 8; h++) { staffTick(s); s.hour++; }
    expect(A().status).toBe("open");
    expect(B().status).toBe("paid");
    expect(C().reminders).toHaveLength(1);
    expect(s.activity.filter((x) => x.by === s.staff[0].name).map((x) => x.key)).toEqual(expect.arrayContaining(["activity.sendInvoice", "activity.matchTransfer", "activity.reminder"]));
  });

  it("sends twice the drafts an hour with a second hire", () => {
    const sent = (clerks: number) => {
      const s = withServer(newGame(9));
      for (let i = 0; i < 40; i++) addService(s, addCustomer(s, `Kunde ${i}`, "agency", "prompt"), "domain", `k${i}.de`, 12, "year");
      tick(s);
      clerk(s, clerks);
      s.hour = at(2005, 1, 3, 9);
      staffTick(s);
      return s.invoices.filter((i) => i.status === "open").length;
    };
    expect(sent(1)).toBeGreaterThan(0);
    expect(sent(2)).toBe(2 * sent(1));
  });
});

describe("saves", () => {
  it("from before modules load with none", () => {
    const s = withServer(newGame(9));
    const raw = JSON.parse(serialize(s));
    delete raw.modules;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.modules).toEqual([]);
    tick(loaded);
  });
});
