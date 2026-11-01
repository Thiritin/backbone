import { describe, expect, it, vi } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { yearOf } from "../src/sim/00-core/time";
import type { Profile } from "../src/sim/30-customers/customers";
import {
  applyRetention, cancelReason, cheapestOption, endDiscounts, FIX_DAYS, KEPT_BUMP, oddsOf, retentionChance, retentionOptions, UPGRADE_FACTOR, type CancelReason, type RetentionId,
} from "../src/sim/40-support/retention";
import { createTicket, isFinal, monthlyValue, type Ticket } from "../src/sim/40-support/tickets";
import { type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { visibleCandidates, TASKS } from "../src/sim/47-staff/staff";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { connect } from "../src/sim/90-actions/hardware";
import { hire } from "../src/sim/90-actions/staff";
import { retainTicket, resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { basement, buyDevice, hypervisor, withServer, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

// Direct calls to the offer can be forced to win or lose; everything else rolls as usual.
const force = vi.hoisted(() => ({ roll: null as boolean | null }));
vi.mock("../src/sim/00-core/rng", async (orig) => {
  const m = await orig<typeof import("../src/sim/00-core/rng")>();
  return { ...m, chance: (r: Parameters<typeof m.chance>[0], p: number) => force.roll ?? m.chance(r, p) };
});
const down = vi.hoisted(() => new Set<string>());
vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: (_s: unknown, id: string) => !down.has(id) }));

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const forced = <T>(roll: boolean, fn: () => T): T => { force.roll = roll; try { return fn(); } finally { force.roll = null; } };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const get = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;

// A customer with one web space at 3.65 a month; the cancellation ticket carries the reason as its topic.
function leaving(s: GameState, profile: Profile, happiness: number, reason: CancelReason = "other", price = 0.005) {
  const id = addCustomer(s, `${profile} ${s.nextId}`, profile), c = s.customers.find((x) => x.id === id)!;
  const sid = addService(s, id, "webHosting", "Web S", price, "hour"), v = s.services.find((x) => x.id === sid)!;
  c.happiness = happiness;
  const t = createTicket(s, c, "cancellation", v.id);
  t.topic = reason === "other" ? "leave" : reason;
  return { c, v, t };
}
const card = (s: GameState, t: Ticket, id: RetentionId) => retentionOptions(s, t).find((o) => o.id === id);
const svc = (s: GameState, id: string) => s.services.find((v) => v.id === id)!;

describe("retention chances", () => {
  const ids: RetentionId[] = ["half", "free", "d3", "d6", "d12", "upgrade", "fix", "move"];
  const at = (profile: Profile, reason: CancelReason) => {
    const s = newGame(1), { c } = leaving(s, profile, 60, reason);
    return Object.fromEntries(ids.map((id) => [id, retentionChance(c, reason, id)])) as Record<RetentionId, number>;
  };

  it("start from happiness less 10", () => {
    const p = at("agency", "other");
    for (const id of ids) expect(p[id]).toBeCloseTo(id === "move" ? 0.6 : 0.5);
    expect(at("private", "other").half).toBeCloseTo(0.6);
    expect(at("private", "other").upgrade).toBeCloseTo(0.5);
  });

  it("favour discounts for price reasons and the move or the fix for outages and slowness", () => {
    const price = at("agency", "price"), slow = at("agency", "slow"), outage = at("agency", "outage");
    for (const id of ["half", "free", "d3", "d6", "d12"] as const) {
      expect(price[id]).toBeCloseTo(0.8);
      expect(outage[id]).toBeCloseTo(0.3);
      expect(slow[id]).toBeCloseTo(0.3);
    }
    expect(price.move).toBeCloseTo(0.5 - 0.1 + 0.1);
    expect(price.fix).toBeCloseTo(0.5);
    expect(price.upgrade).toBeCloseTo(0.5);
    for (const p of [outage, slow]) {
      expect(p.move).toBeCloseTo(0.9);
      expect(p.fix).toBeCloseTo(0.8);
      expect(p.upgrade).toBeCloseTo(0.5);
    }
  });

  it("give private customers a better chance on discounts and businesses on the move", () => {
    const priv = at("private", "price"), biz = at("smallBiz", "price"), hobby = at("hobbyDev", "outage");
    expect(priv.d6).toBeCloseTo(0.9);
    expect(biz.d6).toBeCloseTo(0.8);
    expect(priv.move).toBeCloseTo(0.4);
    expect(biz.move).toBeCloseTo(0.5);
    expect(hobby.move).toBeCloseTo(0.8);
    expect(hobby.d3).toBeCloseTo(0.4);
  });

  it("stay between 0.05 and 0.95 and are worded Unlikely, Even and Likely", () => {
    const s = newGame(1), low = leaving(s, "private", 0).c, high = leaving(s, "private", 100).c;
    expect(retentionChance(low, "other", "upgrade")).toBe(0.05);
    expect(retentionChance(high, "price", "d12")).toBe(0.95);
    expect(retentionChance(low, "price", "d12")).toBeCloseTo(0.3);
    expect([0.05, 0.39, 0.4, 0.59, 0.6, 0.95].map(oddsOf)).toEqual(["unlikely", "unlikely", "even", "even", "likely", "likely"]);
  });

  it("read the reason from the customer's recent trouble, then their price", () => {
    const s = newGame(2), { c, v } = leaving(s, "private", 50);
    expect(cancelReason(s, c)).toBe("other");
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: x.price * 3 } : x));
    expect(cancelReason(s, c)).toBe("price");
    const slow = createTicket(s, c, "outage", v.id);
    slow.topic = "slow";
    expect(cancelReason(s, c)).toBe("slow");
    createTicket(s, c, "outage", v.id).topic = "down";
    expect(cancelReason(s, c)).toBe("outage");
    s.hour += 800;
    expect(cancelReason(s, c)).toBe("price");
  });
});

describe("retention cards", () => {
  it("list every offer a web space customer can take with its cost and odds", () => {
    const s = newGame(3), { t, c } = leaving(s, "smallBiz", 70, "price");
    const monthly = monthlyValue(s.services, c.id), cards = retentionOptions(s, t);
    expect(cards.map((o) => o.id)).toEqual(["half", "free", "d3", "d6", "d12"]);
    const cost = Object.fromEntries(cards.map((o) => [o.id, o.cost]));
    expect(cost.half).toBeCloseTo(0.5 * monthly, 1);
    expect(cost.free).toBeCloseTo(monthly, 1);
    expect(cost.d3).toBeCloseTo(0.2 * 3 * monthly, 1);
    expect(cost.d6).toBeCloseTo(0.2 * 6 * monthly, 1);
    expect(cost.d12).toBeCloseTo(0.2 * 12 * monthly, 1);
    for (const o of cards) expect(o).toMatchObject({ odds: "likely", chance: expect.closeTo(0.9, 5) });
  });

  it("add the fix promise for outage and slowness reasons only", () => {
    const s = newGame(3), price = leaving(s, "smallBiz", 50, "price"), slow = leaving(s, "smallBiz", 50, "slow"), outage = leaving(s, "smallBiz", 50, "outage");
    expect(card(s, price.t, "fix")).toBeUndefined();
    for (const t of [slow.t, outage.t]) expect(card(s, t, "fix")).toMatchObject({ cost: 0, odds: "likely" });
  });

  it("leave out offers that keep the price above the customer's maximum", () => {
    const s = newGame(3), { t } = leaving(s, "smallBiz", 70, "price", 0.05);
    expect(retentionOptions(s, t)).toEqual([]);
  });

  it("only list cancellations of customers who are still there", () => {
    const s = newGame(3), { t, c } = leaving(s, "private", 50);
    const hold = createTicket(s, c, "howTo", null);
    expect(retentionOptions(s, hold)).toEqual([]);
    c.churnedAt = 1;
    expect(retentionOptions(s, t)).toEqual([]);
  });
});

describe("retention offers", () => {
  it("credit half a month or a whole one", () => {
    const s = newGame(4), { t, c } = leaving(s, "private", 50, "price"), monthly = monthlyValue(s.services, c.id), cash = s.cash;
    expect(forced(true, () => applyRetention(s, t, "half"))).toBe("retained");
    expect(s.cash).toBeCloseTo(cash - 0.5 * monthly, 1);
    expect(c.happiness).toBeCloseTo(65);
    expect(forced(true, () => applyRetention(s, t, "free"))).toBe("retained");
    expect(s.cash).toBeCloseTo(cash - 1.5 * monthly, 1);
    expect(forced(false, () => applyRetention(s, t, "free"))).toBe("offerRefused");
  });

  it("take 20% off for the chosen months, then return the price", () => {
    const s = newGame(4), { t, v, c } = leaving(s, "private", 50, "price"), was = v.price, happy = c.happiness;
    expect(forced(true, () => applyRetention(s, t, "d3"))).toBe("retained");
    expect(svc(s, v.id).price).toBeCloseTo(0.8 * was, 10);
    expect(svc(s, v.id).before).toBeUndefined();
    expect(c.happiness).toBe(happy + KEPT_BUMP);
    endDiscounts(s);
    endDiscounts(s);
    expect(svc(s, v.id).price).toBeCloseTo(0.8 * was, 10);
    endDiscounts(s);
    expect(svc(s, v.id).price).toBe(was);
    expect(svc(s, v.id).discount).toBeUndefined();
  });

  it("let a price the player set during a discount stand", () => {
    const s = newGame(4), { t, v } = leaving(s, "private", 50, "price");
    forced(true, () => applyRetention(s, t, "d6"));
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: x.price * 1.1 } : x));
    for (let i = 0; i < 6; i++) endDiscounts(s);
    expect(svc(s, v.id).price).toBeCloseTo(v.price * 0.8 * 1.1, 10);
    expect(svc(s, v.id).discount).toBeUndefined();
  });

  it("refuse a customer who stays above their maximum", () => {
    const s = newGame(4), { t, v } = leaving(s, "private", 90, "price", 0.05);
    expect(forced(true, () => applyRetention(s, t, "d12"))).toBe("offerRefused");
    expect(svc(s, v.id).price).toBe(v.price);
  });
});

// A basement VPS, a VM host in a datacenter and a second customer's VM to fill the basement server.
function hosted() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const a = basement(s), b = hypervisor(s, [second], "Remote");
  const cus = addCustomer(s, "Ada Lang", "agency"), c = s.customers.find((x) => x.id === cus)!;
  const id = ok(provisionService(s, cus, "vps", { label: "vm", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
  const place = () => {
    const home = s.locations[0];
    s.locations = [...s.locations, { ...home, id: "loc2", dc: "equinox-fr5", az: "fra2", name: "FR5", space: "cage" }];
    s.clusters = s.clusters.map((x) => (x.id === b ? { ...x, az: "fra2" } : x));
    s.homeLine = { id: "vdsl-50", next: null };
  };
  c.happiness = 60;
  const t = createTicket(s, c, "cancellation", id);
  t.topic = "outage";
  return { s, a, b, second, c, id, t, place };
}

describe("free upgrade and the move", () => {
  it("grows the service one size at the same price when its server has room", () => {
    const { s, id, t, c } = hosted(), v = svc(s, id), w = workloadsOf(s, id)[0];
    const o = card(s, t, "upgrade")!;
    expect(o).toBeDefined();
    expect(o.cost).toBeGreaterThan(0);
    expect(o.spec!.ramGb).toBeCloseTo(v.spec.ramGb * UPGRADE_FACTOR, 1);
    expect(forced(true, () => applyRetention(s, t, "upgrade"))).toBe("retained");
    expect(svc(s, id).price).toBe(v.price);
    expect(svc(s, id).spec).toEqual(o.spec);
    expect(workloadsOf(s, id)[0].ramGb).toBeGreaterThan(w.ramGb);
    expect(c.happiness).toBe(60 + KEPT_BUMP);
  });

  it("is not offered when the server has no room", () => {
    const { s, id, t } = hosted(), w = workloadsOf(s, id)[0];
    s.workloads = [...s.workloads, { ...w, id: "fill", serviceId: "svc-fill", diskGb: 1e6 }];
    expect(card(s, t, "upgrade")).toBeUndefined();
  });

  it("offers the move only with a datacenter host, and the customer has agreed to it when they stay", () => {
    const { s, second, id, t, place } = hosted();
    expect(card(s, t, "move")).toBeUndefined();
    place();
    const o = card(s, t, "move")!;
    expect(o).toMatchObject({ cost: 0, odds: "likely" });
    expect(o.chance).toBeCloseTo(0.9);
    expect(forced(true, () => applyRetention(s, t, "move"))).toBe("retained");
    const m = s.tickets.find((x) => x.kind === "migration" && x.serviceId === id)!;
    expect(m.move).toMatchObject({ to: second });
    expect(m.move!.windowAt).not.toBeNull();
    expect(m.status).toBe("waiting");
    expect(card(s, t, "move")).toBeUndefined();
  });
});

describe("the fix promise", () => {
  // Twenty agency customers with a web space each, all at happiness 100 so the promise holds with the chance of 0.95. The player
  // works one ticket at a time, so the promises start in the first hours.
  function crowd(seed: number) {
    const s = newGame(seed), list = Array.from({ length: 20 }, () => leaving(s, "agency", 100, "outage"));
    return { s, list };
  }

  it("waits three days and then keeps the customers whose fault is gone", () => {
    const { s, list } = crowd(5);
    for (const { t } of list) ok(retainTicket(s, t.id, "fix"));
    runTo(s, 8);
    for (const { t } of list) {
      const w = get(s, t.id).work!;
      expect(get(s, t.id)).toMatchObject({ status: "waiting", outcome: null });
      expect(w.arg).toBe("fixcheck");
      expect(w.doneAt / 60).toBeGreaterThan(FIX_DAYS * 24);
      expect(w.doneAt / 60).toBeLessThanOrEqual((8 + FIX_DAYS * 24));
    }
    runTo(s, FIX_DAYS * 24 + 3);
    expect(list.some(({ t }) => !isFinal(get(s, t.id)))).toBe(true);
    runTo(s, 8 + FIX_DAYS * 24 + 1);
    expect(list.every(({ t }) => isFinal(get(s, t.id)))).toBe(true);
    const kept = list.filter(({ t }) => get(s, t.id).outcome === "retained").length;
    expect(kept).toBeGreaterThan(15);
    for (const { t, c } of list) expect(s.customers.find((x) => x.id === c.id)!.churnedAt === null).toBe(get(s, t.id).outcome === "retained");
  });

  it("loses the customers whose service is still down", () => {
    const { s, list } = crowd(5);
    for (const { t, v } of list) { ok(retainTicket(s, t.id, "fix")); down.add(v.id); }
    runTo(s, 8 + FIX_DAYS * 24 + 1);
    for (const { t, c } of list) {
      expect(get(s, t.id).outcome).toBe("fixFailed");
      expect(s.customers.find((x) => x.id === c.id)!.churnedAt).not.toBeNull();
    }
    down.clear();
  });

  it("keeps a customer whose service came back inside the three days", () => {
    const s = newGame(6), { t, v, c } = leaving(s, "agency", 100, "outage");
    down.add(v.id);
    ok(retainTicket(s, t.id, "fix"));
    runTo(s, 24);
    down.clear();
    runTo(s, FIX_DAYS * 24 + 2);
    expect(get(s, t.id).outcome).not.toBe("fixFailed");
    expect(isFinal(get(s, t.id))).toBe(true);
    expect(s.customers.find((x) => x.id === c.id)).toBeDefined();
  });

  it("holds a cancellation across the monthly run while the promise waits", () => {
    const s = newGame(7), { t } = leaving(s, "agency", 100, "outage");
    s.hour = 744 - 30;
    ok(retainTicket(s, t.id, "fix"));
    runTo(s, 744 + 5);
    expect(get(s, t.id).status).toBe("waiting");
    expect(get(s, t.id).outcome).toBeNull();
  });
});

describe("the retain action", () => {
  it("queues one of the listed offers and refuses the rest", () => {
    const s = newGame(8), { t } = leaving(s, "agency", 70, "price");
    expect(retainTicket(s, t.id, "fix")).toEqual({ ok: false, error: "error.retentionOption" });
    expect(retainTicket(s, t.id, "nonsense" as RetentionId)).toEqual({ ok: false, error: "error.retentionOption" });
    expect(resolveTicket(s, t.id, "retain" as never)).toEqual({ ok: false, error: "error.unknownTicketAction" });
    expect(retainTicket(s, "tkt999", "half")).toEqual({ ok: false, error: "error.unknownTicket" });
    ok(retainTicket(s, t.id, "d6"));
    expect(get(s, t.id).work).toMatchObject({ op: "resolve", arg: "retain.d6" });
    expect(retainTicket(s, t.id, "half")).toEqual({ ok: false, error: "error.ticketBusy" });
    tick(s);
    expect(get(s, t.id).replies.at(-1)).toMatchObject({ template: "retain.discount", params: { months: 6 } });
  });

  it("can keep a very unhappy customer with a strong offer", () => {
    const s = newGame(9), list = Array.from({ length: 40 }, () => leaving(s, "private", 5, "price"));
    for (const { t } of list) ok(retainTicket(s, t.id, "d12"));
    runTo(s, 12);
    const kept = list.filter(({ t }) => get(s, t.id).outcome === "retained").length;
    // -0.05 from happiness 5, 0.3 for the price reason and 0.1 for a private customer: 0.35.
    expect(kept).toBeGreaterThan(5);
    expect(kept).toBeLessThan(25);
    expect(list.filter(({ t }) => get(s, t.id).outcome === "offerRefused")).toHaveLength(40 - kept);
  });

  it("loses almost every very unhappy customer to a weak offer", () => {
    const s = newGame(9), list = Array.from({ length: 40 }, () => leaving(s, "private", 5, "other"));
    for (const { t } of list) ok(retainTicket(s, t.id, "free"));
    runTo(s, 12);
    expect(list.filter(({ t }) => get(s, t.id).outcome === "retained").length).toBeLessThan(8);
  });
});

describe("staff retention", () => {
  it("pick the cheapest offer that is at least even", () => {
    const s = newGame(10), { t, c } = leaving(s, "private", 45, "other");
    // 0.35 on the base plus 0.1 for a private customer: discounts are even, nothing else is listed.
    expect(retentionOptions(s, t).map((o) => [o.id, o.odds])).toEqual([["half", "even"], ["free", "even"], ["d3", "even"], ["d6", "even"], ["d12", "even"]]);
    expect(cheapestOption(s, t)).toBe("half");
    c.happiness = 20;
    expect(cheapestOption(s, t)).toBeNull();
  });

  it("answer a cancellation with that offer and process it when none is even", () => {
    const s = newGame(11);
    s.cash = 5000;
    const c0 = visibleCandidates(s).find((x) => x.role === "support")!, hired = ok(hire(s, c0.id)), e = s.staff.find((x) => x.id === hired)!;
    Object.assign(e, { skill: 50, talent: 100, trained: [...TASKS.support] });
    const keen = leaving(s, "private", 90, "other"), glum = leaving(s, "private", 15, "other");
    runTo(s, 48 + 12);
    expect(get(s, keen.t.id).replies.at(-1)?.template).toBe("retain.half");
    expect(get(s, glum.t.id).outcome).toBe("cancelled");
    expect(s.customers.find((x) => x.id === glum.c.id)!.churnedAt).not.toBeNull();
  });
});

describe("saves", () => {
  it("round trip a running discount and a waiting promise", () => {
    const s = newGame(12), { t, v } = leaving(s, "agency", 100, "outage");
    forced(true, () => applyRetention(s, t, "d6"));
    const back = deserialize(serialize(s));
    expect(back.services.find((x) => x.id === v.id)!.discount).toEqual({ was: v.price, months: 6 });
    const fix = leaving(s, "agency", 100, "outage");
    forced(true, () => applyRetention(s, fix.t, "fix"));
    expect(deserialize(serialize(s)).tickets.find((x) => x.id === fix.t.id)!.work).toMatchObject({ arg: "fixcheck" });
  });
});

describe("cancellation ticket text", () => {
  it("has a subject and a text for every cancel reason", async () => {
    const { en } = await import("../src/i18n/en");
    for (const reason of ["price", "outage", "slow", "other"]) {
      expect(en[`ticket.cancellation.${reason}.subject`], reason).toBeDefined();
      expect(en[`ticket.cancellation.${reason}.text`], reason).toBeDefined();
    }
  });
});
