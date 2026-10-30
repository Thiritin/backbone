import { describe, expect, it } from "vitest";
import { FIRST_ORDER_DAYS, isStandard, orderLead, orderOf } from "../src/sim/30-market/orders";
import { targetFor } from "../src/sim/30-market/sales";
import { MINUTES } from "../src/sim/40-support/tickets";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { quoteOrder, setAutoOrders } from "../src/sim/90-actions/orders";
import { buyModule } from "../src/sim/90-actions/shop";
import { moduleFor } from "../src/sim/80-business/shop";
import { hire } from "../src/sim/90-actions/staff";
import { readyGame } from "./fixtures";
import { closeTicket, resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";

const MONDAY_9 = 48 + 9;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const web = { product: "webHosting" as const, size: 0, sla: "basic" as const };

function order(s: GameState, city = "Frankfurt") {
  const r = orderLead(s, "private", city, [], web);
  const t = s.tickets.find((x) => x.id === r.ticketId)!;
  return { r, t, req: () => s.sales.requests.find((x) => x.id === r.id)!, tk: () => s.tickets.find((x) => x.id === t.id)! };
}

describe("orders by email", () => {
  it("brings the first order email within two weeks and no direct customers", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = readyGame(seed);
      runTo(s, FIRST_ORDER_DAYS * 24);
      const orders = s.tickets.filter((t) => t.kind === "order");
      expect(orders.length).toBeGreaterThan(0);
      expect(s.customers.length).toBe(3);
      expect(s.sales.requests.filter((r) => r.kind === "new").every((r) => !isStandard(r.profile, r.sla))).toBe(true);
    }
  });

  it("keeps business SLAs and big budgets in sales", () => {
    expect(isStandard("private", "basic")).toBe(true);
    expect(isStandard("smallBiz", "business")).toBe(false);
    expect(isStandard("office", "basic")).toBe(false);
  });

  it("creates the customer and the service when accepted, after the ticket minutes", () => {
    const s = readyGame(1);
    const { r, t, req, tk } = order(s);
    expect(t).toMatchObject({ kind: "order", topic: "webHosting", customerId: "", status: "open", dueAt: r.deadline });
    expect(r.quote).toBe(r.reference);
    expect(resolveTicket(s, t.id, "accept")).toEqual({ ok: true, id: t.id });
    expect(s.playerBusyUntil).toBe(s.hour * 60 + MINUTES.order);
    run(s, 1);
    const c = s.customers.find((x) => x.id === req().customerId)!;
    const v = s.services.find((x) => x.customerId === c.id)!;
    expect(req().status).toBe("won");
    expect(v).toMatchObject({ product: "webHosting", spec: r.spec, sla: "basic" });
    expect(v.price).toBeCloseTo(r.quote! / 730, 6);
    expect(tk()).toMatchObject({ status: "resolved", outcome: "accepted", customerId: c.id, serviceId: v.id });
  });

  it("refuses to accept without disk or an offer in the city", () => {
    const s = readyGame(1);
    const { r, t } = order(s);
    const friend = s.customers[0].id, cluster = s.clusters.find((c) => c.kind === "panel")!.id;
    for (let i = 0; i < 500 && targetFor(s, r); i++) provisionService(s, friend, "webHosting", { label: `fill${i}`, spec: r.spec, clusterId: cluster });
    expect(resolveTicket(s, t.id, "accept")).toEqual({ ok: false, error: "error.noCapacity" });
    expect(resolveTicket(s, order(s, "London").t.id, "accept")).toEqual({ ok: false, error: "error.orderNotOffered" });
  });

  it("loses the lead when declined or closed", () => {
    const s = readyGame(1);
    const a = order(s), b = order(s);
    resolveTicket(s, a.t.id, "reject");
    run(s, 1);
    expect(a.req().status).toBe("declined");
    expect(a.tk()).toMatchObject({ status: "closed", outcome: "declined" });
    expect(closeTicket(s, b.t.id).ok).toBe(true);
    expect(b.req().status).toBe("declined");
    expect(s.sales.lost.filter((l) => l.reason === "lost.declined")).toHaveLength(2);
    expect(s.customers).toHaveLength(3);
  });

  it("goes to a competitor when left past its due time", () => {
    const s = readyGame(1);
    const { r, req, tk } = order(s);
    runTo(s, r.deadline + 1);
    expect(req().status).toBe("lost");
    expect(tk().status).toBe("closed");
    expect(s.sales.lost.at(-1)).toMatchObject({ name: r.company ?? r.contact, reason: "lost.expired" });
  });

  it("is worked by a support employee trained on orders once the player has quoted", () => {
    const s = readyGame(1);
    runTo(s, MONDAY_9);
    const c = visibleCandidates(s).find((x) => x.role === "support")!;
    const id = hire(s, c.id);
    if (!id.ok) throw new Error(id.error);
    s.staff.find((e) => e.id === id.id)!.trained = ["order"];
    const { r, req, tk } = order(s);
    run(s, 3);
    expect(req().customerId).toBeNull();
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
    expect(quoteOrder(s, tk().id, r.quote!).ok).toBe(true);
    for (let i = 0; i < 24 * 4 && !req().invoiceId; i++) run(s, 1);
    expect(tk().status).toBe("waiting");
    s.invoices = s.invoices.map((i) => (i.id === req().invoiceId ? { ...i, payStep: 0, payAt: s.hour } : i));
    for (let i = 0; i < 24 * 4 && req().status !== "won"; i++) run(s, 1);
    expect(req().status).toBe("won");
    expect(tk().replies).toEqual([]);
    expect(tk().outcome).toBe("accepted");
  });

  it("orders directly once the order form is set up and orders run automatically", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    expect(setUpChannel(s, "website").ok).toBe(true);
    expect(setUpChannel(s, "orderForm").ok).toBe(true);
    s.unlocks = [...s.unlocks, "products", "provisioning"];
    expect(setAutoOrders(s, true).ok).toBe(true);
    // Without a custom script for the panel the form order waits in Support.
    const waiting = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(waiting.status).toBe("accepted");
    expect(buyModule(s, moduleFor(s, "webHosting", targetFor(s, waiting)!.clusterId)).ok).toBe(true);
    const tickets = s.tickets.length;
    const r = orderLead(s, "private", "Frankfurt", [], web, false);
    const done = s.sales.requests.find((x) => x.id === r.id)!;
    expect(done.status).toBe("won");
    expect(s.tickets.length).toBe(tickets);
    expect(s.services.some((v) => v.customerId === done.customerId && v.id === done.serviceId)).toBe(true);
    expect(s.services.find((v) => v.id === done.serviceId)!.spec).toMatchObject(r.spec);
    // Without room the order still arrives as an email.
    expect(orderLead(s, "private", "London", [], web, false).ticketId).not.toBeNull();
  });

  it("keeps an open order through a save", () => {
    const s = readyGame(1);
    const { t } = order(s);
    const back = deserialize(serialize(s));
    expect(orderOf(back, back.tickets.find((x) => x.id === t.id)!)?.status).toBe("open");
    run(back, 1);
    const old = JSON.parse(serialize(readyGame(2)));
    expect(() => run(deserialize(JSON.stringify(old)), 24)).not.toThrow();
  });
});
