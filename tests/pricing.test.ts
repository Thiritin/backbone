import { describe, expect, it, vi } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import type { Profile } from "../src/sim/30-customers/customers";
import { limits, overpricing, OVER_DRIFT, PAST_MAX_DRIFT } from "../src/sim/30-customers/pricing";
import { createTicket, isFinal, rightTemplate } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { changePrice } from "../src/sim/90-actions/sales";
import { replyTicket, resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";

vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: () => true }));

// Web S sells for €3 a month at the market.
function shop(seed: number, monthly: number, profile: Profile = "smallBiz", n = 1) {
  const s = newGame(seed);
  const ids = Array.from({ length: n }, (_, i) => {
    const c = addCustomer(s, `Customer ${i}`, profile);
    return { c, v: addService(s, c, "webHosting", "Web S", monthly / 730, "hour") };
  });
  return { s, ids, cus: (id: string) => s.customers.find((x) => x.id === id)!, svc: (id: string) => s.services.find((x) => x.id === id)! };
}
const nextMonth = (s: GameState) => { do tick(s); while (!isMonthStart(s.hour)); };
const open = (s: GameState, id: string, kind: string, topic?: string) =>
  s.tickets.find((t) => t.customerId === id && t.kind === kind && (!topic || t.topic === topic) && !isFinal(t));

describe("price tolerance", () => {
  it("loses a customer raised from 2 to 10 even with a retention offer", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { s, ids, cus } = shop(seed, 2);
      const { c, v } = ids[0];
      changePrice(s, v, 10);
      expect(cus(c).happiness).toBe(0);
      const t = open(s, c, "cancellation")!;
      expect(t).toBeDefined();
      resolveTicket(s, t.id, "retain");
      tick(s);
      expect(s.tickets.find((x) => x.id === t.id)!.outcome).toBe("offerRefused");
      expect(cus(c).churnedAt).not.toBeNull();
    }
  });

  it("keeps a customer through a 5% raise within their maximum with a small hit", () => {
    const { s, ids, cus, svc } = shop(3, 3);
    const { c, v } = ids[0];
    expect(3.15).toBeLessThan(limits(s, cus(c), svc(v)).max);
    changePrice(s, v, 3.15);
    expect(cus(c).happiness).toBeCloseTo(65);
    expect(open(s, c, "cancellation")).toBeUndefined();
    nextMonth(s);
    expect(cus(c).churnedAt).toBeNull();
    expect(cus(c).happiness).toBeGreaterThan(60);
  });

  it("leaves a customer at the market price alone", () => {
    const { s, ids, cus } = shop(4, 3);
    const before = cus(ids[0].c).happiness;
    overpricing(s);
    expect(cus(ids[0].c).happiness).toBe(before);
  });

  it("wears happiness down each month above the reference, harder past the maximum", () => {
    const { s, ids, cus, svc } = shop(5, 3);
    const { c, v } = ids[0], { fair, max } = limits(s, cus(c), svc(v));
    s.services = s.services.map((x) => (x.id === v ? { ...x, price: (max * 1.1) / 730 } : x));
    overpricing(s);
    expect(cus(c).happiness).toBeCloseTo(70 - OVER_DRIFT * 100 * ((max * 1.1) / fair - 1) - PAST_MAX_DRIFT * 10);
  });

  it("drifts down and cancels after repeated small raises past the maximum", () => {
    const { s, ids, cus, svc } = shop(6, 3);
    const { c, v } = ids[0], { max } = limits(s, cus(c), svc(v));
    s.services = s.services.map((x) => (x.id === v ? { ...x, price: (max * 0.97) / 730 } : x));
    for (let m = 0; m < 12 && cus(c).churnedAt === null; m++) {
      if (m < 3) changePrice(s, v, svc(v).price * 730 * 1.03);
      nextMonth(s);
      // Answer complaints right away so waiting on support costs nothing.
      for (const t of s.tickets) if (t.customerId === c && t.kind !== "cancellation" && !isFinal(t)) t.status = "resolved";
    }
    expect(cus(c).churnedAt).not.toBeNull();
    expect(svc(v).price * 730).toBeGreaterThan(limits(s, cus(c), svc(v)).max);
    expect(Math.min(...cus(c).history)).toBeLessThan(50);
  });
});

describe("price complaints", () => {
  it("brings billing tickets after a noticeable raise, answered by explaining or reverting", () => {
    const { s, ids, cus, svc } = shop(7, 3, "smallBiz", 40);
    for (const { v } of ids) changePrice(s, v, 3.6);
    const tickets = s.tickets.filter((t) => t.kind === "billing" && t.topic === "price");
    expect(tickets.length).toBeGreaterThan(5);
    expect(tickets.length).toBeLessThan(35);
    const [a, b] = tickets;
    expect(rightTemplate(s, a)).toBe("newPrice");
    expect(replyTicket(s, a.id, "newPrice").ok).toBe(true);
    const h = cus(b.customerId).happiness;
    expect(resolveTicket(s, b.id, "revert").ok).toBe(true);
    tick(s);
    expect(svc(b.serviceId!).price * 730).toBeCloseTo(3);
    expect(svc(b.serviceId!).before).toBeUndefined();
    expect(cus(b.customerId).happiness).toBeGreaterThan(h);
    expect(s.tickets.find((t) => t.id === b.id)!.outcome).toBe("reverted");
  });

  it("refuses to revert a ticket that is not about a raised price", () => {
    const { s, ids, cus } = shop(8, 3);
    const t = createTicket(s, cus(ids[0].c), "billing", ids[0].v, "charge");
    expect(resolveTicket(s, t.id, "revert")).toEqual({ ok: false, error: "error.unknownTicketAction" });
  });

  it("brings monthly complaints while a raised price stays above a fair one", () => {
    const { s, ids } = shop(9, 3, "smallBiz", 40);
    for (const { v } of ids) changePrice(s, v, 3.45);
    for (const t of s.tickets) t.status = "resolved";
    nextMonth(s);
    expect(s.tickets.filter((t) => t.topic === "price" && !isFinal(t)).length).toBeGreaterThan(0);
  });
});

describe("retention offers", () => {
  it("are refused below the happiness threshold", () => {
    const { s, ids, cus } = shop(10, 3, "smallBiz", 20);
    const tickets = ids.map(({ c }) => {
      cus(c).happiness = 25;
      return createTicket(s, cus(c), "cancellation", null, "leave");
    });
    tickets.forEach((t) => resolveTicket(s, t.id, "retain"));
    for (let i = 0; i < 24; i++) tick(s);
    expect(tickets.every((t) => s.tickets.find((x) => x.id === t.id)!.outcome === "offerRefused")).toBe(true);
  });

  it("keep many happy customers at a fair price", () => {
    const { s, ids, cus } = shop(11, 3, "smallBiz", 40);
    const tickets = ids.map(({ c }) => {
      cus(c).happiness = 90;
      return createTicket(s, cus(c), "cancellation", null, "leave");
    });
    tickets.forEach((t) => resolveTicket(s, t.id, "retain"));
    for (let i = 0; i < 24; i++) tick(s);
    const kept = tickets.filter((t) => s.tickets.find((x) => x.id === t.id)!.outcome === "retained").length;
    expect(kept).toBeGreaterThan(15);
    expect(kept).toBeLessThan(35);
  });
});

describe("saves", () => {
  it("load services without a previous price and keep one that has it", () => {
    const { s, ids } = shop(12, 3);
    const raw = JSON.parse(serialize(s));
    const loaded = deserialize(JSON.stringify(raw));
    expect(changePrice(loaded, ids[0].v, 3.3).ok).toBe(true);
    const again = deserialize(serialize(loaded));
    expect(again.services.find((x) => x.id === ids[0].v)!.before).toBeCloseTo(3 / 730);
  });
});
