import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { yearOf } from "../src/sim/00-core/time";
import { addRequest, salesTick } from "../src/sim/30-market/sales";
import { CHECKS } from "../src/sim/checklist";
import { readyGame } from "./fixtures";

describe("lost request notice", () => {
  it("rings the bell when a request expires unanswered", () => {
    const s = readyGame(1);
    const r = addRequest(s, {
      kind: "order", customerId: null, contact: "Anna Albers", company: "Albers Florist", profile: "soleProp", city: "Frankfurt", product: "webHosting",
      spec: sizeSpec("webHosting", 0, yearOf(s.hour)), sla: "basic", reference: 3, discount: 0, budget: 1.1, shady: false, serviceId: null, ticketId: null, deadline: s.hour
    }, "sales.msg.webHosting.0");
    s.hour = r.deadline + 1;
    const events = salesTick(s);
    const e = events.find((x) => x.key === "event.orderExpired");
    expect(e?.params.name).toBeTruthy();
    expect(e?.params.reason).toBeTruthy();
  });

  it("ticks the order guide steps from the request", () => {
    const s = readyGame(1);
    const r = addRequest(s, {
      kind: "order", customerId: null, contact: "Anna Albers", company: "Albers Florist", profile: "soleProp", city: "Frankfurt", product: "webHosting",
      spec: sizeSpec("webHosting", 0, yearOf(s.hour)), sla: "basic", reference: 3, discount: 0, budget: 1.1, shady: false, serviceId: null, ticketId: null, deadline: s.hour
    }, "sales.msg.webHosting.0");
    expect(CHECKS.orderAccount(s)).toBe(false);
    r.customerId = "c1";
    expect(CHECKS.orderAccount(s)).toBe(true);
    expect(CHECKS.sendInvoice(s)).toBe(false);
  });
});
