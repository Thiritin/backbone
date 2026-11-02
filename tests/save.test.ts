import { STARTER_APPS, WIDGETS } from "../src/sim/10-catalog/store";
import { describe, expect, it } from "vitest";
import { SAVE_VERSION } from "../src/sim/50-state";
import { linkStatus } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { addLocation, moveRack } from "../src/sim/90-actions/hardware";
import { buyDevice, newGame } from "./fixtures";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame, registered } from "./fixtures";
import { legacyRegistration } from "../src/sim/80-business/office";
import { taxNumberOf } from "../src/sim/80-business/tax";

describe("tick", () => {
  it("emits a month event on the first hour of each month", () => {
    const s = registered(newGame(1));
    const events = [];
    for (let h = 0; h < 24 * 31; h++) events.push(...tick(s));
    expect(events.filter((e) => e.app !== "News").map((e) => e.key)).toEqual(["event.monthStart"]);
    expect(events.find((e) => e.app === "Books")).toEqual({ app: "Books", key: "event.monthStart", params: { month: 1, year: 2005 } });
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
    expect(repaired.cash).toBe(0);
    expect(repaired.rng.s).toBe(4);
    expect(repaired.version).toBe(SAVE_VERSION);
    expect(repaired.devices.map((d) => d.model)).toEqual(["home-router", "line-jack"]);
  });
  it("replaces the infrastructure of a version 1 save and keeps seed, rng, hour, cash and ledger", () => {
    const ledger = [{ hour: 10, category: "rent", key: "ledger.rent", params: { rack: "fra2-rack-01" }, amount: -2520 }];
    const v1 = {
      version: 1, seed: 4, rng: { s: 77 }, hour: 5000, cash: 1234, nextId: 9, ledger, powerDue: 3.5,
      locations: [{ id: "loc1", kind: "basement", city: "Frankfurt", name: "Basement" }, { id: "loc6", kind: "rented", city: "Frankfurt", name: "Frankfurt colocation" }],
      racks: [{ id: "rack2", locationId: "loc1", name: "fra1-rack", units: 4, rentPerMonth: 0 }],
      devices: [
        { id: "dev3", model: "compute", brand: "Dwell", rackId: "rack2", slot: 1, name: "fra1-srv-01", bond: "failover", groups: [] },
        { id: "dev4", model: "home-router", brand: "Sysko", rackId: "rack2", slot: 4, name: "fra1-gw-01", bond: "failover", groups: [] },
      ],
      cables: [{ id: "cab5", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper" }],
    };
    const s = deserialize(JSON.stringify(v1));
    const fresh = newGame(4);
    // An old save keeps the DSL line it started with and lists no line it cannot deliver; the new basement's router waits in
    // storage, so the line has no address yet.
    expect(s).toEqual({
      ...fresh, rng: { s: 77 }, hour: 5000, cash: 1234, ledger, powerDue: 3.5, installed: [...STARTER_APPS, "Chat", ...WIDGETS.map(([id]) => id)], registration: legacyRegistration(4),
      marketing: { ...fresh.marketing, lines: [] }, homeLine: { id: "dsl-16", next: null },
      // The company domain and the NameCheep contract come with the load.
      registrar: { id: "nameCheep", since: 5000, tier: 0, billed: true, transfer: null }, company: { ...fresh.company, domain: "basement-hosting.de" },
      domains: [expect.objectContaining({ name: "basement-hosting.de", customerId: null })],
      // Saves from before mailboxes get the starting box, made at the hour of the load.
      mail: expect.objectContaining({ primary: "mb1", tenants: [expect.objectContaining({ host: "gmix", since: 5000 })] }),
      // Saves from before banks hold their account at Sparklasse.
      bank: expect.objectContaining({ id: "sparklasse", welcomed: false }),
      // Registered saves from before the tax office hold a tax number.
      tax: expect.objectContaining({ number: taxNumberOf(4), numberAt: 0, small: false }),
    });
    expect(s.devices.map((d) => d.model)).toEqual(["home-router", "line-jack"]);
    tick(s);
  });
  it("fills customer, billing and support fields in a version 1 save and a version 2 save without them", () => {
    const v1 = {
      version: 1, seed: 4, hour: 900,
      customers: [{ id: "cus8", name: "Ada", profile: "private", since: 0, happiness: 70, habit: "prompt", churnedAt: null }],
      services: [{ id: "svc9", customerId: "cus8", product: "domain", label: "ada.com", price: 12, period: "year", commitMonths: 0, startedAt: 0, endedAt: null }],
      invoices: [{ id: "inv10", suspended: true }],
    };
    const s = deserialize(JSON.stringify(v1));
    expect(s.customers[0].history).toEqual([]);
    expect(s.services[0].zone).toBeNull();
    expect(s.invoices[0].suspendedAt).toBe(900);
    expect(s.billingRules).toEqual(newGame(4).billingRules);
    const v2 = deserialize(JSON.stringify({ version: 2, seed: 4, hour: 10 }));
    const fresh = newGame(4);
    for (const k of ["customers", "services", "tickets", "playerBusyUntil", "downSince", "invoices", "yearlyBilledUntil", "loans", "loansBlockedUntil", "billingRules", "docs", "dcs", "waitlist"] as const) {
      expect(v2[k]).toEqual(fresh[k]);
    }
  });
  it("keeps a service's zone through a save", () => {
    const s = newGame(4);
    const c = addCustomer(s, "Ada", "private");
    addService(s, c, "vps", "ada-vps", 0.1, "hour", 0, "loc1");
    expect(deserialize(serialize(s)).services[0].zone).toBe("loc1");
  });
  it("keeps the basement server of a save from before the empty start", () => {
    const s = deserialize(serialize(readyGame(3)));
    expect(linkStatus(s, "dev3").online).toBe(true);
    expect(s.customers.filter((c) => c.habit === "friend")).toHaveLength(3);
  });
  it("rejects garbage", () => {
    expect(() => deserialize("{}")).toThrow();
  });
});

describe("retired tower servers", () => {
  it("loads a save with a tower on the shelf and one in storage without them or anything pointing at them", () => {
    const old = JSON.parse(serialize(readyGame(7)));
    const dev3 = old.devices.find((d: { id: string }) => d.id === "dev3");
    // The basement server running the cluster, the panel VM and the friends' sites becomes a tower on the shelf.
    Object.assign(dev3, { model: "g1-tower", rackId: "shelf:loc1", slot: 1 });
    old.devices.push({ ...dev3, id: "dev900", model: "g2-tower", rackId: null, slot: 0, store: "loc1" });
    old.leases.push({ id: "lease901", lessor: "Dwell", monthly: 10, months: 12, startedAt: 0, paid: 0, devices: ["dev900"] });
    old.techOps.push({ id: "op902", kind: "replace", deviceId: "dev3", componentId: null, queuedAt: 0, auto: false });
    old.locations[0].shelf = 4;
    expect(old.clusters.length).toBeGreaterThan(0);
    expect(old.workloads.length).toBeGreaterThan(0);
    expect(old.cables.some((c: { a: { device: string } }) => c.a.device === "dev3")).toBe(true);

    const s = deserialize(JSON.stringify(old));
    expect(s.devices.some((d) => d.model.endsWith("-tower"))).toBe(false);
    expect(s.clusters).toEqual([]);
    expect(s.workloads).toEqual([]);
    expect(s.services.length).toBe(old.services.length);
    expect("shelf" in s.locations[0]).toBe(false);
    for (const id of ["dev3", "dev900", ...old.workloads.map((w: { id: string }) => w.id), ...old.clusters.map((c: { id: string }) => c.id)]) {
      expect(JSON.stringify(s), id).not.toContain(`"${id}"`);
    }
    tick(s);
  });
});

describe("used listings in old saves", () => {
  it("get a maker when they were saved without one", () => {
    const s = readyGame(7);
    for (let h = 0; h < 24 * 31 && !s.used.length; h++) tick(s);
    const old = JSON.parse(serialize(s));
    delete old.used[0].brand;
    delete old.devices[0].brand;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.used.every((l) => typeof l.brand === "string")).toBe(true);
    expect(loaded.devices.every((d) => typeof d.brand === "string")).toBe(true);
  });
});
