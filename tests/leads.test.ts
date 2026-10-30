import { describe, expect, it } from "vitest";
import type { Cluster } from "../src/sim/60-infra/cluster";
import { MODELS, genOf, modelById } from "../src/sim/10-catalog/hardware";
import { hostFor, stepsDone } from "../src/sim/30-market/manual";
import { newLead, shadyLead } from "../src/sim/30-market/sales";
import type { GameState } from "../src/sim/50-state";
import { betterHost, hostQuality, preferredRoute } from "../src/sim/60-infra/routes";
import { sizeOf } from "../src/sim/30-market/spec";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, createAccount, provisionOrder, quoteOrder, registerOrderDomain } from "../src/sim/90-actions/orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { orderOf } from "../src/sim/30-market/orders";
import { addRequest } from "../src/sim/30-market/sales";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { readyGame } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const step = (s: GameState, res: { ok: boolean; error?: string }) => {
  if (!res.ok) throw new Error(res.error);
  run(s, 1);
};
const req = (s: GameState, id: string) => s.sales.requests.find((x) => x.id === id)!;

describe("sales leads", () => {
  it("arrive as order tickets in Support with their SLA and are not set up before the player works the steps", () => {
    const s = readyGame(1);
    const r = newLead(s, "smallBiz", "Frankfurt", [], { product: "webHosting", size: 0, sla: "business" });
    expect(r).toMatchObject({ kind: "order", sla: "business", customerId: null, status: "open" });
    expect(r.thread[0].key).toMatch(/^sales\.msg\.webHosting/);
    const t = s.tickets.find((x) => x.id === r.ticketId)!;
    expect(t).toMatchObject({ kind: "order", status: "open" });
    const services = s.services.length;
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
    step(s, quoteOrder(s, t.id, r.reference));
    for (let i = 0; i < 40 && !stepsDone(s, req(s, r.id)).quote; i++) tick(s);
    expect(req(s, r.id).status).toBe("accepted");
    // The customer saying yes creates nothing: no account, no invoice, no service.
    expect(req(s, r.id)).toMatchObject({ customerId: null, serviceId: null });
    expect(req(s, r.id).invoiceId).toBeUndefined();
    expect(s.services).toHaveLength(services);
    step(s, createAccount(s, t.id));
    step(s, confirmOrder(s, t.id));
    expect(req(s, r.id).invoiceId).toBeTruthy();
    expect(s.services).toHaveLength(services);
    step(s, registerOrderDomain(s, t.id));
    step(s, provisionOrder(s, t.id, hostFor(s, req(s, r.id))!));
    const v = s.services.find((x) => x.id === req(s, r.id).serviceId)!;
    expect(v).toMatchObject({ product: "webHosting", sla: "business", customerId: req(s, r.id).customerId });
  });

  it("flag a shady customer once the account is created", () => {
    const s = readyGame(1);
    const r = shadyLead(s, "Frankfurt", []);
    expect(r).toMatchObject({ kind: "order", shady: true, budget: 1.8 });
    expect(r.thread[0].key).toBe("sales.msg.shady");
    s.workloads = [];
    step(s, quoteOrder(s, r.ticketId!, r.reference * 1.5));
    for (let i = 0; i < 40 && !stepsDone(s, req(s, r.id)).quote; i++) tick(s);
    if (!stepsDone(s, req(s, r.id)).quote) return expect(req(s, r.id).status).toBe("refused");
    step(s, createAccount(s, r.ticketId!));
    expect(s.customers.find((c) => c.id === req(s, r.id).customerId)!.shady).toBe(true);
  });
});

describe("host ranking", () => {
  // Two hosts of the player: one on the newest server model, one on the oldest.
  function hosts() {
    const s = readyGame(1);
    const servers = MODELS.filter((m) => m.server).sort((x, y) => genOf(y) - genOf(x));
    const base = s.devices.find((d) => modelById(d.model).server)!;
    s.devices = [...s.devices, { ...base, id: "devNew", model: servers[0].id }, { ...base, id: "devOld", model: servers.at(-1)!.id }];
    const host = (id: string, deviceId: string): Cluster => ({ ...s.clusters[0], id, vm: null, nodes: [{ deviceId, state: "active" }] });
    return { s, fresh: host("clNew", "devNew"), old: host("clOld", "devOld"), newer: genOf(servers[0]) > genOf(servers.at(-1)!) };
  }

  it("prefers the newest hardware", () => {
    const { s, fresh, old, newer } = hosts();
    expect(newer).toBe(true);
    expect([old, fresh].sort(betterHost(s))[0].id).toBe("clNew");
  });

  it("prefers the host with fewer hours down among equals", () => {
    const { s, fresh } = hosts();
    const twin = { ...fresh, id: "clTwin" };
    s.workloads = [...s.workloads, { ...s.workloads[0], id: "wl-x", clusterId: "clNew", serviceId: "svc-x" }];
    s.downHours = { "svc-x": 12 };
    expect(hostQuality(s, fresh).down).toBe(12);
    expect([fresh, twin].sort(betterHost(s))[0].id).toBe("clTwin");
  });

  it("preselects one host for the setup, the same one the order and staff would pick", () => {
    const s = readyGame(1);
    const r = newLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" });
    const pick = preferredRoute(s, r.product, r.city, sizeOf(r.spec));
    expect(pick).not.toBeNull();
    expect(hostFor(s, req(s, r.id))).toBe(pick);
  });
});

describe("saves from before leads were orders", () => {
  // The old Sales card: a request of kind "new" with no ticket, quoted or not, or finished.
  function legacy(s: GameState, over: Record<string, unknown>) {
    const r = addRequest(s, {
      kind: "order", customerId: null, contact: "Anna Albers", company: "Albers Florist", profile: "smallBiz", city: "Frankfurt", product: "webHosting",
      spec: sizeSpec("webHosting", 0, 2005), sla: "business", reference: 3, discount: 0, budget: 1.1, shady: false, serviceId: null, ticketId: null, deadline: s.hour + 72,
    }, "sales.msg.webHosting.0");
    return { ...r, ...over, kind: "new" } as unknown as GameState["sales"]["requests"][number];
  }
  const load = (s: GameState) => deserialize(serialize(s));

  it("turns an open or quoted lead into an order ticket that keeps its quote, deadline and thread", () => {
    const s = readyGame(1);
    const open = legacy(s, {}), quoted = legacy(s, { status: "quoted", quote: 2.9, replyAt: s.hour + 6, attempts: 1 });
    s.sales = { ...s.sales, requests: s.sales.requests.map((r) => (r.id === open.id ? open : r.id === quoted.id ? quoted : r)) };
    const back = load(s);
    for (const [r, status] of [[open, "open"], [quoted, "waiting"]] as const) {
      const now = back.sales.requests.find((x) => x.id === r.id)!, t = back.tickets.find((x) => x.id === now.ticketId)!;
      expect(now).toMatchObject({ kind: "order", sla: "business", quote: r.quote, deadline: r.deadline, thread: r.thread });
      expect(t).toMatchObject({ kind: "order", topic: "webHosting", status, dueAt: r.deadline });
      expect(orderOf(back, t)?.id).toBe(r.id);
    }
    expect(back.sales.requests.some((x) => (x.kind as string) === "new")).toBe(false);
  });

  it("drops finished leads and keeps working after the move", () => {
    const s = readyGame(1);
    const done = ["won", "lost", "declined"].map((status) => legacy(s, { status }));
    s.sales = { ...s.sales, requests: s.sales.requests.map((r) => done.find((d) => d.id === r.id) ?? r) };
    const waiting = legacy(s, { status: "quoted", quote: 2.9, replyAt: s.hour + 2 });
    s.sales = { ...s.sales, requests: [...s.sales.requests.filter((r) => r.id !== waiting.id), waiting] };
    const back = load(s);
    expect(back.sales.requests.map((r) => r.id)).toEqual([waiting.id]);
    run(back, 30);
    expect(["accepted", "countered", "refused", "lost"]).toContain(req(back, waiting.id)?.status ?? "lost");
  });
});
