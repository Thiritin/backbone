import { describe, expect, it } from "vitest";
import { LEASE_FACTOR, leaseOffers, LESSORS } from "../src/sim/10-catalog/leasing";
import { newGame, type GameState } from "../src/sim/50-state";
import { connectError, storageStacks } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { buyCart, buyOutLease, connect, mountStack, buyDevice, sellDevice, type CartLine } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";

const rich = (cash = 100_000): GameState => ({ ...newGame(1), cash });
const ok = (r: ReturnType<typeof buyCart>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof buyCart>) => (r.ok ? "ok" : r.error);
const CART: CartLine[] = [{ model: "g1-compute", brand: "Dwell", qty: 2 }, { model: "sw-8", brand: "Sysko", qty: 1 }];
const lease = (s: GameState) => {
  const offer = leaseOffers(s, 5060)[0];
  const first = ok(buyCart(s, CART, { kind: "lease", offerId: offer.id }, "loc1"));
  return { offer, first, lease: s.leases.at(-1)! };
};

describe("leaseOffers", () => {
  it("makes one offer per lessor with a factor between 1.06 and 1.40", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const amount of [1000, 5060, 77_777]) {
        const s = { ...newGame(seed), hour: seed * 997 };
        const offers = leaseOffers(s, amount);
        expect(offers.map((o) => o.lessor)).toEqual(LESSORS.map((l) => l.id));
        for (const o of offers) {
          expect([12, 24, 36]).toContain(o.months);
          expect(o.total).toBeCloseTo(o.monthly * o.months, 6);
          expect(o.total / amount).toBeGreaterThanOrEqual(LEASE_FACTOR.min - 0.001);
          expect(o.total / amount).toBeLessThanOrEqual(LEASE_FACTOR.max + 0.001);
        }
      }
    }
  });
  it("holds for the month, changes in the next one and leaves the game rng alone", () => {
    const s = newGame(7);
    const january = leaseOffers(s, 5060);
    s.hour = 743;
    expect(leaseOffers(s, 5060)).toEqual(january);
    expect(s.rng).toEqual(newGame(7).rng);
    s.hour = 744;
    expect(leaseOffers(s, 5060).map((o) => o.total)).not.toEqual(january.map((o) => o.total));
    expect(leaseOffers({ ...newGame(8), hour: 0 }, 5060)).not.toEqual(january);
  });
});

describe("buyCart", () => {
  it("pays the cart total in cash and puts everything in storage", () => {
    const s = rich(10_000);
    const first = ok(buyCart(s, CART, { kind: "cash" }, "loc1"));
    expect(first).toBe("dev8");
    expect(s.cash).toBe(10_000 - 5060);
    expect(storageStacks(s, "loc1").map((x) => [x.model, x.ids.length])).toEqual([["g1-compute", 2], ["sw-8", 1]]);
    expect(s.ledger.map((l) => l.amount)).toEqual([-5000, -60]);
    expect(s.devices.every((d) => d.lease === null)).toBe(true);
  });
  it("leases the whole cart without paying now", () => {
    const s = rich(0);
    const { offer, first, lease: l } = lease(s);
    expect(first).toBe("dev9");
    expect(s.cash).toBe(0);
    expect(l).toEqual({ id: "lease8", lessor: offer.lessor, monthly: offer.monthly, months: offer.months, startedAt: 0, paid: 0, devices: ["dev9", "dev10", "dev11"] });
    expect(s.devices.filter((d) => d.lease === "lease8").map((d) => d.price)).toEqual([2500, 2500, 60]);
  });
  it("rejects an empty cart, a bad line, too little cash and an offer that does not match the cart this month", () => {
    const s = rich(5059);
    expect(err(buyCart(s, [], { kind: "cash" }, "loc1"))).toBe("error.emptyCart");
    expect(err(buyCart(s, [...CART, { model: "g7-compute", brand: "Dwell", qty: 1 }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
    expect(err(buyCart(s, [{ ...CART[0], qty: 0 }], { kind: "cash" }, "loc1"))).toBe("error.badQuantity");
    expect(err(buyCart(s, CART, { kind: "cash" }, "loc1"))).toBe("error.noCash");
    expect(err(buyCart(s, CART, { kind: "lease", offerId: leaseOffers(s, 2500)[0].id }, "loc1"))).toBe("error.offerExpired");
    const offer = leaseOffers(s, 5060)[1];
    s.hour = 744;
    expect(err(buyCart(s, CART, { kind: "lease", offerId: offer.id }, "loc1"))).toBe("error.offerExpired");
    expect(s.devices).toHaveLength(3);
  });
});

describe("lease payments", () => {
  it("charges one payment at each month start until the term is paid, then the devices are owned", () => {
    const s = rich();
    const { offer } = lease(s);
    let hours = 0;
    while (s.leases.length && hours < 40 * 744) {
      tick(s);
      hours++;
    }
    const payments = s.ledger.filter((l) => l.key === "ledger.lease");
    expect(payments).toHaveLength(offer.months);
    expect(payments.every((p) => p.category === "leasing" && p.amount === -offer.monthly)).toBe(true);
    expect(payments.at(-1)!.params).toMatchObject({ paid: offer.months, months: offer.months });
    expect(s.devices.every((d) => d.lease === null)).toBe(true);
    expect(sellDevice(s, "dev9").ok).toBe(true);
  });
  it("blocks selling leased hardware and buys the lease out for the remaining payments", () => {
    const s = rich();
    const { offer, lease: l } = lease(s);
    expect(err(sellDevice(s, "dev9"))).toBe("error.leased");
    for (let h = 0; h < 744; h++) tick(s);
    expect(s.leases[0].paid).toBe(1);
    const cash = s.cash;
    s.cash = (offer.months - 1) * offer.monthly - 1;
    expect(err(buyOutLease(s, l.id))).toBe("error.noCash");
    s.cash = cash;
    ok(buyOutLease(s, l.id));
    expect(s.cash).toBeCloseTo(cash - (offer.months - 1) * offer.monthly, 2);
    expect(s.ledger.at(-1)).toMatchObject({ category: "leasing", key: "ledger.leaseBuyout" });
    expect(s.leases).toEqual([]);
    expect(err(buyOutLease(s, l.id))).toBe("error.unknownLease");
    ok(sellDevice(s, "dev9"));
  });
  it("saves leases and fills them for older saves", () => {
    const s = rich();
    lease(s);
    expect(deserialize(serialize(s))).toEqual(s);
    const old = JSON.parse(serialize(newGame(2)));
    delete old.leases;
    for (const d of old.devices) delete d.lease;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.leases).toEqual([]);
    expect(loaded.devices.every((d) => d.lease === null)).toBe(true);
  });
});

describe("mountStack fromSlot and connectError", () => {
  it("stacks upward from the given slot or fails when the run does not fit there", () => {
    const s = rich();
    ok(buyDevice(s, "sw-8", "Sysko", 3, "loc1"));
    expect(err(mountStack(s, "sw-8", "Sysko", "rack2", 3, 22))).toBe("error.noRoom");
    expect(err(mountStack(s, "sw-8", "Sysko", "rack2", 1, 1))).toBe("error.noRoom");
    ok(mountStack(s, "sw-8", "Sysko", "rack2", 3, 10));
    expect(s.devices.filter((d) => d.model === "sw-8" && d.id !== "dev4").map((d) => d.slot)).toEqual([10, 11, 12]);
  });
  it("reports the same errors connect returns", () => {
    const s = rich();
    const stored = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    expect(connectError(s, { device: "dev3", port: 1 }, { device: "dev4", port: 1 })).toBeNull();
    expect(connectError(s, { device: "dev3", port: 0 }, { device: "dev4", port: 1 })).toBe("error.portInUse");
    expect(connectError(s, { device: "dev4", port: 2 }, { device: stored, port: 0 })).toBe("error.notMounted");
    expect(err(connect(s, { device: "dev4", port: 2 }, { device: stored, port: 0 }))).toBe("error.notMounted");
    ok(connect(s, { device: "dev3", port: 1 }, { device: "dev4", port: 1 }));
  });
});
