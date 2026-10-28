import { START_CASH } from "../src/sim/10-catalog/economy";
import { WIDGETS } from "../src/sim/10-catalog/store";
import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { linkStatus } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { addLocation, buyDevice, moveRack } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("tick", () => {
  it("emits a month event on the first hour of each month", () => {
    const s = newGame(1);
    const events = [];
    for (let h = 0; h < 24 * 31; h++) events.push(...tick(s));
    expect(events.map((e) => e.key)).toEqual(["event.monthStart", "event.bills"]);
    expect(events[0]).toEqual({ app: "Finance", key: "event.monthStart", params: { month: 1, year: 2005 } });
  });
});

describe("save", () => {
  it("round-trips a game", () => {
    const s = newGame(9);
    for (let h = 0; h < 100; h++) tick(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("round-trips locations, a moving rack and stored devices", () => {
    const s = { ...newGame(9), cash: 100_000 };
    const loc = addLocation(s, "equinox-am3", "cage", 4);
    if (!loc.ok) throw new Error(loc.error);
    moveRack(s, "rack2", loc.id!, 3);
    buyDevice(s, "sw-24", "Sysko", 2, "loc1");
    for (let h = 0; h < 50; h++) tick(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("gives a milestone 1 save without infrastructure the starting basement", () => {
    const repaired = deserialize(JSON.stringify({ seed: 4, hour: 50 }));
    expect(repaired.hour).toBe(50);
    expect(repaired.cash).toBe(START_CASH);
    expect(repaired.rng.s).toBe(4);
    expect(repaired.version).toBe(2);
    expect(linkStatus(repaired, "dev3").online).toBe(true);
  });
  it("replaces the basement shelf of a version 1 save and keeps seed, rng, hour, cash and ledger", () => {
    const ledger = [{ hour: 10, category: "rent", key: "ledger.rent", params: { rack: "fra2-rack-01" }, amount: -2520 }];
    const v1 = {
      version: 1, seed: 4, rng: { s: 77 }, hour: 5000, cash: 1234, nextId: 9, ledger, powerDue: 3.5,
      locations: [{ id: "loc1", kind: "basement", city: "Frankfurt", name: "Basement" }, { id: "loc6", kind: "rented", city: "Frankfurt", name: "Frankfurt colocation" }],
      racks: [{ id: "rack2", locationId: "loc1", name: "fra1-shelf", units: 4, shelf: true, rentPerMonth: 0 }],
      devices: [
        { id: "dev3", model: "tower", brand: "Dwell", rackId: "rack2", slot: 1, name: "fra1-srv-01", bond: "failover", groups: [] },
        { id: "dev4", model: "home-router", brand: "Sysko", rackId: "rack2", slot: 4, name: "fra1-gw-01", bond: "failover", groups: [] },
      ],
      cables: [{ id: "cab5", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper" }],
    };
    const s = deserialize(JSON.stringify(v1));
    const fresh = newGame(4);
    expect(s).toEqual({ ...fresh, rng: { s: 77 }, hour: 5000, cash: 1234, ledger, powerDue: 3.5, installed: [...fresh.installed, ...WIDGETS.map(([id]) => id)] });
    expect(linkStatus(s, "dev3").online).toBe(true);
    tick(s);
  });
  it("fills customer, billing and support fields in a version 1 save and a version 2 save without them", () => {
    const v1 = {
      version: 1, seed: 4, hour: 900,
      customers: [{ id: "cus8", name: "Ada", profile: "private", since: 0, happiness: 70, habit: "prompt", churnedAt: null }],
      services: [{ id: "svc9", customerId: "cus8", product: "domain", label: "ada.example", price: 12, period: "year", commitMonths: 0, startedAt: 0, endedAt: null }],
      invoices: [{ id: "inv10", suspended: true }],
    };
    const s = deserialize(JSON.stringify(v1));
    expect(s.customers[0].history).toEqual([]);
    expect(s.services[0].zone).toBeNull();
    expect(s.invoices[0].suspendedAt).toBe(900);
    expect(s.billingRules).toEqual(newGame(4).billingRules);
    const v2 = deserialize(JSON.stringify({ version: 2, seed: 4, hour: 10 }));
    const fresh = newGame(4);
    for (const k of ["customers", "services", "tickets", "playerBusyUntil", "servicesDown", "invoices", "yearlyBilledUntil", "loans", "loansBlockedUntil", "billingRules", "docs", "dcs", "waitlist"] as const) {
      expect(v2[k]).toEqual(fresh[k]);
    }
  });
  it("keeps a service's zone through a save", () => {
    const s = newGame(4);
    const c = addCustomer(s, "Ada", "private");
    addService(s, c, "vps", "ada-vps", 0.1, "hour", 0, "loc1");
    expect(deserialize(serialize(s)).services[0].zone).toBe("loc1");
  });
  it("rejects garbage", () => {
    expect(() => deserialize("{}")).toThrow();
  });
});
