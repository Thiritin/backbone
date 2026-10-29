import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { specText } from "../src/sim/30-market/spec";
import { invoiceOf } from "../src/sim/30-market/manual";
import { domainOf, DOMAIN_FEE, registryCost, REGISTRIES } from "../src/sim/30-customers/registry";
import { serviceOnline } from "../src/sim/40-support/status";
import { sendStep, STEPS } from "../src/sim/45-billing/billing";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { routeOptions } from "../src/sim/60-infra/routes";
import { tick } from "../src/sim/88-tick/tick";
import { acceptUpgrade, confirmOrder, createAccount, provisionOrder, registerOrderDomain, renewDomain } from "../src/sim/90-actions/orders";
import { hire } from "../src/sim/90-actions/staff";
import { createTicket } from "../src/sim/40-support/tickets";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { closeTicket } from "../src/sim/90-actions/support";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { readyGame } from "./fixtures";

const MONDAY_9 = 48 + 9;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const web = { product: "webHosting" as const, size: 0, sla: "basic" as const };
const vps = { product: "vps" as const, size: 0, sla: "basic" as const };

function order(s: GameState, need: typeof web | typeof vps = web) {
  const r = orderLead(s, "private", "Frankfurt", [], need, true);
  const id = r.ticketId!;
  return { r, id, req: () => s.sales.requests.find((x) => x.id === r.id)!, tk: () => s.tickets.find((x) => x.id === id)! };
}
// Runs one step and the hour it takes.
const done = (s: GameState, res: { ok: boolean; error?: string }) => {
  if (!res.ok) throw new Error(res.error);
  run(s, 1);
};
const payNow = (s: GameState, invoiceId: string) => {
  s.invoices = s.invoices.map((i) => (i.id === invoiceId ? { ...i, payStep: 0, payAt: s.hour } : i));
};

describe("custom orders", () => {
  it("asks for its own resources, different for each order, and the order form places one at once", () => {
    const s = readyGame(3);
    const specs = Array.from({ length: 6 }, () => order(s).r);
    for (const r of specs) {
      expect(specText(r.product, r.spec)).toMatch(/^Web hosting, /);
      expect(r.reference).toBeGreaterThan(0);
      expect(r.thread[0].key).toMatch(/^order\.msg\.webHosting/);
    }
    expect(new Set(specs.map((r) => JSON.stringify(r.spec))).size).toBeGreaterThan(2);
    const v = order(s, vps).r;
    expect(specText(v.product, v.spec)).toMatch(/^VPS, /);
    expect(v.spec.vcpu).toBeGreaterThanOrEqual(1);
    // With the order form, an order without an email places itself.
    s.cash = 1e6;
    setUpChannel(s, "website");
    setUpChannel(s, "orderForm");
    const placed = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(placed.ticketId).toBeNull();
    expect(s.sales.requests.find((x) => x.id === placed.id)!.status).toBe("won");
  });

  it("works the first order of a company without customers", () => {
    const s = readyGame(11);
    Object.assign(s, { customers: [], services: [], workloads: [] });
    const { id, req } = order(s);
    done(s, createAccount(s, id));
    expect(s.customers.map((c) => c.id)).toEqual([req().customerId]);
  });

  it("runs its steps only in order", () => {
    const s = readyGame(1);
    const { id } = order(s);
    expect(provisionOrder(s, id)).toEqual({ ok: false, error: "error.needsAccount" });
    expect(confirmOrder(s, id, 10)).toEqual({ ok: false, error: "error.needsAccount" });
    done(s, createAccount(s, id));
    expect(createAccount(s, id)).toEqual({ ok: false, error: "error.stepDone" });
    expect(confirmOrder(s, id, 0)).toEqual({ ok: false, error: "error.quotePrice" });
    expect(registerOrderDomain(s, id)).toEqual({ ok: false, error: "error.needsInvoice" });
    expect(provisionOrder(s, id)).toEqual({ ok: false, error: "error.needsInvoice" });
    done(s, confirmOrder(s, id, 9.5));
    expect(provisionOrder(s, id)).toEqual({ ok: false, error: "error.needsDomain" });
  });

  it("waits for the payment, then sets up the service with its own resources", () => {
    const s = readyGame(2);
    const { id, req, tk } = order(s);
    done(s, createAccount(s, id));
    const c = s.customers.find((x) => x.id === req().customerId)!;
    expect(c.name).toBe(req().contact);
    expect(s.services.some((v) => v.customerId === c.id)).toBe(false);
    expect(tk().replies.length + req().thread.filter((m) => m.from === "you").length).toBe(1);
    done(s, confirmOrder(s, id, 12));
    const inv = invoiceOf(s, req())!;
    expect(inv.lines.map((l) => l.amount)).toEqual([12, req().owned ? 5 : DOMAIN_FEE]);
    expect(tk().status).toBe("waiting");
    payNow(s, inv.id);
    run(s, 1);
    expect(tk()).toMatchObject({ status: "open", unread: true });
    expect(tk().dueAt).toBeGreaterThan(s.hour);
    const cash = s.cash;
    done(s, registerOrderDomain(s, id));
    expect(domainOf(s, req().domain!)).toMatchObject({ customerId: c.id, transfer: !!req().owned });
    expect(s.cash).toBeCloseTo(cash - registryCost(req().domain!, 2005), 2);
    done(s, provisionOrder(s, id));
    const v = s.services.find((x) => x.id === req().serviceId)!;
    expect(v.spec).toEqual(req().spec);
    expect(v.price * 730).toBeCloseTo(12, 6);
    const w = s.workloads.find((x) => x.serviceId === v.id)!;
    expect([w.vcpu, w.ramGb, w.diskGb]).toEqual([req().spec!.vcpu, req().spec!.ramGb, req().spec!.diskGb]);
    expect(req().status).toBe("won");
    expect(tk()).toMatchObject({ status: "resolved", outcome: "accepted", serviceId: v.id });
    expect(req().thread.filter((m) => m.from === "you").map((m) => m.key.replace(/\.\d$/, ""))).toEqual(
      ["reply.order.account", "reply.order.invoice", req().owned ? "reply.order.transfer" : "reply.order.domain", "reply.order.live"]);
    // The first month is prepaid: the next monthly invoice bills only the hours past it.
    runTo(s, 31 * 24 + 1);
    const line = s.invoices.flatMap((i) => i.lines).find((l) => l.serviceId === v.id)!;
    expect(line.params.hours).toBe(31 * 24 - v.prepaidUntil!);
  });

  it("costs happiness when the paid setup waits past the customer's reply time", () => {
    const s = readyGame(4);
    const { id, req } = order(s, vps);
    done(s, createAccount(s, id));
    done(s, confirmOrder(s, id, 20));
    payNow(s, req().invoiceId!);
    run(s, 1);
    const c = () => s.customers.find((x) => x.id === req().customerId)!, before = c().happiness;
    run(s, 24 * 7);
    expect(c().happiness).toBeLessThan(before);
  });

  it("closes the account and ends the service when a provisioned order is never paid", () => {
    const s = readyGame(5);
    const { id, req, tk } = order(s, vps);
    done(s, createAccount(s, id));
    done(s, confirmOrder(s, id, 20));
    s.invoices = s.invoices.map((i) => (i.id === req().invoiceId ? { ...i, payStep: 4, payAt: null } : i));
    done(s, provisionOrder(s, id));
    const v = req().serviceId!;
    expect(s.services.find((x) => x.id === v)!.endedAt).toBeNull();
    expect(tk().status).toBe("waiting");
    const inv = s.invoices.find((i) => i.id === req().invoiceId)!;
    for (let i = 0; i < STEPS.length; i++) sendStep(s, inv, i);
    run(s, 2);
    expect(s.customers.find((x) => x.id === req().customerId)!.churnedAt).not.toBeNull();
    expect(s.services.find((x) => x.id === v)!.endedAt).not.toBeNull();
    expect(req().status).toBe("lost");
    expect(s.sales.lost.at(-1)!.reason).toBe("lost.unpaid");
  });

  it("closes the account when a confirmed order is declined", () => {
    const s = readyGame(6);
    const { id, req } = order(s, vps);
    done(s, createAccount(s, id));
    done(s, confirmOrder(s, id, 20));
    s.invoices = s.invoices.map((i) => (i.id === req().invoiceId ? { ...i, payAt: null } : i));
    expect(closeTicket(s, id).ok).toBe(true);
    run(s, 1);
    expect(s.customers.find((x) => x.id === req().customerId)!.churnedAt).not.toBeNull();
    expect(invoiceOf(s, req())!.status).toBe("writtenOff");
  });
});

describe("domains", () => {
  function live(seed: number) {
    const s = readyGame(seed);
    const o = order(s);
    done(s, createAccount(s, o.id));
    done(s, confirmOrder(s, o.id, 8));
    payNow(s, o.req().invoiceId!);
    run(s, 1);
    done(s, registerOrderDomain(s, o.id));
    done(s, provisionOrder(s, o.id));
    return { s, ...o };
  }

  it("has a registry pun and a changing yearly cost per TLD", () => {
    expect(REGISTRIES.de.name).toBe("DENIQ");
    expect(registryCost("x.de", 2005)).toBeGreaterThan(registryCost("x.de", 2026));
  });

  it("warns before expiry, takes the site down when it lapses and comes back on renewal", () => {
    const { s, req } = live(7);
    const name = req().domain!, v = req().serviceId!, d = domainOf(s, name)!;
    expect(serviceOnline(s, v)).toBe(true);
    s.hour = d.expiresAt - 30 * 24 - (d.expiresAt % 24) - 1;
    const events = [] as string[];
    while (s.hour < d.expiresAt + 24) events.push(...tick(s).map((e) => e.key));
    expect(events).toContain("event.domainExpiring");
    expect(events).toContain("event.domainExpired");
    expect(serviceOnline(s, v)).toBe(false);
    const invoices = s.invoices.length;
    expect(renewDomain(s, name).ok).toBe(true);
    expect(serviceOnline(s, v)).toBe(true);
    expect(domainOf(s, name)!.expiresAt).toBeGreaterThan(s.hour + 8000);
    expect(s.invoices.length).toBe(invoices + 1);
    expect(s.invoices.at(-1)!.lines[0]).toMatchObject({ key: "invoice.line.domainRenewal", amount: DOMAIN_FEE });
  });

  it("loads saves from before domains", () => {
    const { s } = live(8);
    const data = JSON.parse(serialize(s));
    delete data.domains;
    expect(deserialize(JSON.stringify(data)).domains).toEqual([]);
    expect(deserialize(serialize(s)).domains).toEqual(s.domains);
  });
});

describe("staff on custom orders", () => {
  it("create the account and invoice, then set up the service once paid", () => {
    const s = readyGame(1);
    runTo(s, MONDAY_9);
    s.cash = 1e5;
    const c = visibleCandidates(s).find((x) => x.role === "support")!;
    const hired = hire(s, c.id);
    if (!hired.ok) throw new Error(hired.error);
    s.staff.find((e) => e.id === hired.id)!.trained = ["order"];
    const { req, tk } = order(s, vps);
    run(s, 3);
    expect(req().customerId).not.toBeNull();
    expect(req().invoiceId).toBeDefined();
    expect(req().thread.filter((m) => m.from === "you").every((m) => m.by === s.staff[0].name)).toBe(true);
    expect(tk().status).toBe("waiting");
    payNow(s, req().invoiceId!);
    run(s, 3);
    expect(req().status).toBe("won");
    expect(tk().outcome).toBe("accepted");
  });
});

describe("routing and upgrades", () => {
  it("sets up on a chosen node and refuses one without room", () => {
    const s = readyGame(9);
    const { id, req } = order(s, vps);
    done(s, createAccount(s, id));
    done(s, confirmOrder(s, id, 20));
    const options = routeOptions(s, "vps", "Frankfurt", req().spec!);
    expect(options.length).toBe(1);
    const node = options[0].nodes[0];
    expect(provisionOrder(s, id, "dev999")).toEqual({ ok: false, error: "error.unknownCluster" });
    done(s, provisionOrder(s, id, node.id));
    expect(s.workloads.find((w) => w.serviceId === req().serviceId)!.deviceId).toBe(node.id);
    const big = order(s, vps);
    done(s, createAccount(s, big.id));
    s.sales.requests = s.sales.requests.map((r) => (r.id === big.r.id ? { ...r, spec: { ...r.spec!, ramGb: 10_000 } } : r));
    done(s, confirmOrder(s, big.id, 20));
    expect(provisionOrder(s, big.id, node.id)).toEqual({ ok: false, error: "error.noCapacity" });
  });

  it("asks what upgrading costs and grows the service in one step", () => {
    const s = readyGame(10);
    const { id, req } = order(s, vps);
    done(s, createAccount(s, id));
    done(s, confirmOrder(s, id, 20));
    done(s, provisionOrder(s, id));
    const v = s.services.find((x) => x.id === req().serviceId)!, c = s.customers.find((x) => x.id === v.customerId)!;
    const t = createTicket(s, c, "upgrade", v.id, "grow");
    run(s, 1);
    const up = s.sales.requests.find((r) => r.kind === "expansion" && r.ticketId === t.id)!;
    expect(up.thread[0].key).toBe("sales.msg.upgrade");
    expect(up.spec!.ramGb).toBeGreaterThan(v.spec!.ramGb);
    expect(s.tickets.find((x) => x.id === t.id)!.topic).toBe("more");
    expect(acceptUpgrade(s, up.id, up.reference * 0.5).ok).toBe(true);
    const after = s.services.find((x) => x.id === v.id)!;
    expect(after.spec).toEqual(up.spec);
    expect(after.price * 730).toBeCloseTo(up.reference * 0.5, 2);
    expect(s.workloads.find((w) => w.serviceId === v.id)!.ramGb).toBe(up.spec!.ramGb);
    expect(s.sales.requests.find((r) => r.id === up.id)!.status).toBe("won");
  });
});
