import { describe, expect, it } from "vitest";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { billSuppliers, debitAllowed, invoice, payMethod, supplierCountry, UTILITY } from "../src/sim/46-finance/payables";
import { newGame, type GameState } from "../src/sim/50-state";
import { powerBills, powerByLocation, tick } from "../src/sim/88-tick/tick";
import { applyCard, openBankAccount, setPayMethod } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame as fixtureGame, withServer } from "./fixtures";

const ger = DATACENTERS.find((d) => d.city === "Frankfurt")!, ams = DATACENTERS.find((d) => d.city === "Amsterdam")!;
const line = { hour: 0, category: "power", key: "ledger.powerUse", params: {}, amount: -40 };
// A registered company with a bank account on Monday 08:00.
const opened = (seed: number): GameState => {
  const s = newGame(seed);
  s.hour = 56;
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
  tick(s);
  return s;
};
const withCard = (s: GameState) => {
  expect(applyCard(s).ok).toBe(true);
  s.bank!.card = { ...s.bank!.card!, readyAt: s.hour, limit: 1000 };
};

describe("power by location", () => {
  it("adds up each hour's kWh and euros per location", () => {
    const s = withServer(fixtureGame(3));
    const hour = powerByLocation(s), home = s.locations[0].id;
    expect(hour[home].kwh).toBeGreaterThan(0);
    s.powerUse = {};
    s.powerDue = 0;
    tick(s);
    expect(s.powerUse[home].kwh).toBeCloseTo(hour[home].kwh, 10);
    expect(s.powerDue).toBeCloseTo(s.powerUse[home].eur, 10);
  });

  it("puts datacenter power on its invoice and home power on the utility's, with kWh and ct/kWh", () => {
    const s = opened(3);
    const home = s.locations[0];
    s.locations.push({ ...home, id: "loc-dc", dc: ger.id, city: ger.city, name: ger.name });
    s.powerUse = { [home.id]: { kwh: 100, eur: 30 }, "loc-dc": { kwh: 200, eur: 40 } };
    s.powerDue = 70.5;
    const bills = powerBills(s);
    expect(bills.map((b) => [b.key, b.amount])).toEqual([["ledger.power", -0.5], ["ledger.powerUse", -30], ["ledger.dcPower", -40]]);
    expect(bills[1].params).toMatchObject({ kwh: 100, ct: 30 });
    expect(bills[2].params).toMatchObject({ kwh: 200, ct: 20, dc: ger.id });
    s.payables = [];
    billSuppliers(s, bills, { datacenter: ger.name });
    expect(s.payables.map((p) => [p.name, p.amount])).toEqual([[UTILITY, 30.5], [ger.name, 40]]);
  });
});

describe("payment method per supplier", () => {
  it("knows a supplier's country", () => {
    expect(supplierCountry("GoDuddy Reseller")).toBe("");
    expect(debitAllowed("GoDuddy Reseller")).toBe(false);
    expect(debitAllowed("InterNetY")).toBe(true);
    expect(debitAllowed(UTILITY)).toBe(true);
    expect(supplierCountry(ams.name)).toBe("NL");
    expect(debitAllowed(ger.name)).toBe(true);
  });

  it("takes a direct debit only from a German supplier and a card only with a card", () => {
    const s = opened(3);
    expect(payMethod(s, UTILITY)).toBe("transfer");
    expect(setPayMethod(s, UTILITY, "debit").ok).toBe(true);
    expect(payMethod(s, UTILITY)).toBe("debit");
    expect(setPayMethod(s, UTILITY, "card")).toMatchObject({ ok: false, error: "error.payNoCard" });
    expect(setPayMethod(s, UTILITY, "cheque" as never)).toMatchObject({ ok: false, error: "error.payMethod" });
    expect(setPayMethod(s, "Nobody", "transfer")).toMatchObject({ ok: false, error: "error.unknownSupplier" });
    invoice(s, "registrar", "GoDuddy Reseller", [line]);
    expect(setPayMethod(s, "GoDuddy Reseller", "debit")).toMatchObject({ ok: false, error: "error.debitAbroad" });
    withCard(s);
    expect(setPayMethod(s, UTILITY, "card").ok).toBe(true);
    expect(s.bank!.mandates).toEqual([]);
    expect(payMethod(s, UTILITY)).toBe("card");
    expect(setPayMethod(s, UTILITY, "transfer").ok).toBe(true);
    expect(s.bank!.cards).toEqual([]);
  });

  it("charges the card as the invoice is issued, and falls back to a transfer without room on it", () => {
    const s = opened(3);
    withCard(s);
    setPayMethod(s, UTILITY, "card");
    const cash = s.cash, p = invoice(s, "power", UTILITY, [line]);
    expect(p).toMatchObject({ paidAt: s.hour, sent: 40 });
    expect(s.cash).toBe(cash);
    expect(s.bank!.card!.spent.map((e) => e.amount)).toEqual([-40]);
    s.bank!.card!.limit = 50;
    expect(invoice(s, "power", UTILITY, [line]).paidAt).toBeNull();
  });

  it("loads a save from before payment methods and per-location power", () => {
    const s = opened(3);
    const data = JSON.parse(serialize(s));
    delete data.bank.cards;
    delete data.powerUse;
    const back = deserialize(JSON.stringify(data));
    expect(back.bank!.cards).toEqual([]);
    expect(back.powerUse).toEqual({});
  });
});
