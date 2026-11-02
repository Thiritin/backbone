import { yearOf } from "../src/sim/00-core/time";
import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { setupFee, specText } from "../src/sim/30-market/spec";
import { hostFor, invoiceOf, nextStep, stepsDone } from "../src/sim/30-market/manual";
import { domainOf, domainFee, registryCost, REGISTRIES } from "../src/sim/30-customers/registry";
const DOMAIN_FEE = domainFee(2005);
import { serviceOnline } from "../src/sim/40-support/status";
import { sendStep, STEPS } from "../src/sim/45-billing/billing";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { SalesRequest } from "../src/sim/30-market/market";
import type { GameState } from "../src/sim/50-state";
import { routeOptions } from "../src/sim/60-infra/routes";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, offerUpgrade, createAccount, provisionOrder, quoteOrder, registerOrderDomain, renewDomain, setAutoOrders } from "../src/sim/90-actions/orders";
import { hire } from "./fixtures";
import { createTicket } from "../src/sim/40-support/tickets";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { closeTicket } from "../src/sim/90-actions/support";
import { setDomainRenewal } from "../src/sim/90-actions/registrar";
import { SKILLS } from "../src/sim/10-catalog/research";
import { research } from "../src/sim/90-actions/store";
import { setRate } from "../src/sim/90-actions/rates";
import { mailed, owner, panelVm, readyGame, openShop } from "./fixtures";

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
// A quote the customer accepts for sure: a deep purse, then the hours until the answer.
function accepted(s: GameState, need: typeof web | typeof vps = web, price = 10, setup?: number) {
  const o = order(s, need);
  s.sales.requests = s.sales.requests.map((r) => (r.id === o.r.id ? { ...r, budget: 100 } : r));
  const sent: { ok: boolean; error?: string } = o.req().replyAt === null ? quoteOrder(s, o.id, price, setup) : { ok: true };
  if (!sent.ok) throw new Error(sent.error);
  for (let i = 0; i < 60 && !stepsDone(s, o.req()).quote; i++) tick(s);
  if (!stepsDone(s, o.req()).quote) throw new Error(`not accepted: ${o.req().status}`);
  return o;
}
const host = (s: GameState, o: { req: () => SalesRequest }) => hostFor(s, o.req())!;
// Runs one step and the hour it takes.
const done = (s: GameState, res: { ok: boolean; error?: string }) => {
  if (!res.ok) throw new Error(res.error);
  run(s, 1);
};
const payNow = (s: GameState, invoiceId: string) => {
  s.invoices = s.invoices.map((i) => (i.id === invoiceId ? { ...i, payStep: 0, payAt: s.hour, bank: undefined } : i));
};

describe("custom orders", () => {
  it("asks for its own resources, different for each order, and the shop accepts the website price", () => {
    const s = readyGame(5);
    const specs = Array.from({ length: 6 }, () => order(s).r);
    for (const r of specs) {
      expect(specText(r.product, r.spec)).toMatch(/^Web hosting, /);
      expect(r.reference).toBeGreaterThan(0);
      expect(r.thread[0].key).toMatch(/^order\.msg\.webHosting/);
    }
    expect(new Set(specs.map((r) => JSON.stringify(r.spec))).size).toBeGreaterThan(2);
    const v = order(s, vps).r;
    expect(specText(v.product, v.spec)).toMatch(/^VPS, /);
    expect(v.spec.vcpu).toBeGreaterThanOrEqual(0.5);
    // The shop order waits for the steps like an email order, with the website's price as the accepted quote.
    s.cash = 1e6;
    openShop(s);
    const placed = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(placed.ticketId).not.toBeNull();
    expect(s.sales.requests.find((x) => x.id === placed.id)!).toMatchObject({ status: "accepted", shop: true });
  });

  it("works the first order of a company without customers", () => {
    const s = readyGame(11);
    Object.assign(s, { customers: [], services: [], workloads: [] });
    const { id, req } = accepted(s);
    done(s, createAccount(s, id, mailed(s, id)));
    expect(s.customers.map((c) => c.id)).toEqual([req().customerId]);
  });

  it("opens the account and the other steps only once the quote is accepted", () => {
    const s = readyGame(1);
    const { id } = order(s);
    const a = accepted(s);
    const hostId = host(s, a);
    expect(createAccount(s, id, mailed(s, id))).toEqual({ ok: false, error: "error.needsQuote" });
    expect(confirmOrder(s, id)).toEqual({ ok: false, error: "error.needsQuote" });
    expect(provisionOrder(s, id, hostId)).toEqual({ ok: false, error: "error.needsQuote" });
    expect(quoteOrder(s, id, 0)).toEqual({ ok: false, error: "error.quotePrice" });
    expect(provisionOrder(s, a.id, hostId)).toEqual({ ok: false, error: "error.needsAccount" });
    expect(confirmOrder(s, a.id)).toEqual({ ok: false, error: "error.needsAccount" });
    done(s, createAccount(s, a.id, mailed(s, a.id)));
    expect(createAccount(s, a.id, mailed(s, a.id))).toEqual({ ok: false, error: "error.stepDone" });
    expect(provisionOrder(s, a.id, hostId)).toEqual({ ok: false, error: "error.needsDomain" });
    done(s, registerOrderDomain(s, a.id, ...owner(s, a.id)));
    expect(provisionOrder(s, a.id, hostId)).toEqual({ ok: false, error: "error.needsInvoice" });
  });

  it("sets up the service with its own resources, mails once and waits for the payment", () => {
    const s = readyGame(2);
    const { id, req, tk } = accepted(s, web, 12);
    done(s, createAccount(s, id, mailed(s, id)));
    const c = s.customers.find((x) => x.id === req().customerId)!;
    expect(c.name).toBe(req().contact);
    expect(s.services.some((v) => v.customerId === c.id)).toBe(false);
    expect(tk().replies.length + req().thread.filter((m) => m.from === "you").length).toBe(1);
    done(s, confirmOrder(s, id));
    const inv = invoiceOf(s, req())!;
    expect(inv.lines.map((l) => l.amount)).toEqual([setupFee(s, "webHosting"), 12, req().owned ? 5 : DOMAIN_FEE]);
    expect(inv.status).toBe("draft");
    expect(tk().status).toBe("open");
    const cash = s.cash;
    done(s, registerOrderDomain(s, id, ...owner(s, id)));
    expect(domainOf(s, req().domain!)).toMatchObject({ customerId: c.id, transfer: !!req().owned });
    // The registrar bills the registry cost at the month start, not at the registration.
    expect(s.cash).toBeCloseTo(cash, 2);
    done(s, provisionOrder(s, id, hostFor(s, req())!));
    const v = s.services.find((x) => x.id === req().serviceId)!;
    expect(v.spec).toMatchObject(req().spec!);
    expect(v.price * 730).toBeCloseTo(12, 6);
    const w = s.workloads.find((x) => x.serviceId === v.id)!;
    expect([w.vcpu, w.ramGb, w.diskGb]).toEqual([req().spec!.vcpu, req().spec!.ramGb, req().spec!.diskGb]);
    expect(invoiceOf(s, req())!.status).toBe("open");
    expect(tk().status).toBe("waiting");
    expect(req().thread.filter((m) => m.from === "you").map((m) => m.key.replace(/\.\d$/, ""))).toEqual(["reply.order.quote", "reply.order.done"]);
    payNow(s, inv.id);
    run(s, 1);
    expect(req().status).toBe("won");
    expect(tk()).toMatchObject({ status: "resolved", outcome: "accepted", serviceId: v.id });
    // The first month is prepaid: the next monthly invoice bills only the hours past it.
    runTo(s, 62 * 24 + 1);
    const bill = s.invoices.find((i) => i.lines.some((l) => l.serviceId === v.id))!;
    expect(bill.lines.find((l) => l.serviceId === v.id)!.params.hours).toBe(bill.issuedAt - v.prepaidUntil!);
  });

  it("costs happiness when the setup waits past the customer's reply time", () => {
    const s = readyGame(4);
    const { id, req } = accepted(s, vps, 20);
    done(s, createAccount(s, id, mailed(s, id)));
    done(s, confirmOrder(s, id));
    const c = () => s.customers.find((x) => x.id === req().customerId)!, before = c().happiness;
    run(s, 24 * 7);
    expect(c().happiness).toBeLessThan(before);
  });

  it("closes the account and ends the service when a provisioned order is never paid", () => {
    const s = readyGame(5);
    const { id, req, tk } = accepted(s, vps, 20);
    done(s, createAccount(s, id, mailed(s, id)));
    done(s, confirmOrder(s, id));
    s.invoices = s.invoices.map((i) => (i.id === req().invoiceId ? { ...i, payStep: 4, payAt: null } : i));
    done(s, provisionOrder(s, id, hostFor(s, req())!));
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
    const { id, req } = accepted(s, vps, 20);
    done(s, createAccount(s, id, mailed(s, id)));
    done(s, confirmOrder(s, id));
    s.invoices = s.invoices.map((i) => (i.id === req().invoiceId ? { ...i, payAt: null } : i));
    expect(closeTicket(s, id).ok).toBe(true);
    run(s, 1);
    expect(s.customers.find((x) => x.id === req().customerId)!.churnedAt).not.toBeNull();
    expect(invoiceOf(s, req())!.status).toBe("writtenOff");
  });

  it("bills the setup fee on the confirmation invoice, the rate's by default and the quote's when given", () => {
    const s = readyGame(2);
    s.cash = 1e6;
    expect(setRate(s, "webHosting", "setup", 25).ok).toBe(true);
    const a = accepted(s, web, 12);
    done(s, createAccount(s, a.id, mailed(s, a.id)));
    done(s, confirmOrder(s, a.id));
    const first = invoiceOf(s, a.req())!.lines.filter((l) => l.key !== "invoice.line.domain" && l.key !== "invoice.line.domainTransfer");
    expect(first.map((l) => [l.key, l.amount])).toEqual([["invoice.line.setupFee", 25], ["invoice.line.firstMonth", 12]]);
    expect(quoteOrder(s, order(s).id, 12, -1)).toEqual({ ok: false, error: "error.quotePrice" });
    const b = accepted(s, web, 12, 40);
    done(s, createAccount(s, b.id, mailed(s, b.id)));
    done(s, confirmOrder(s, b.id));
    expect(invoiceOf(s, b.req())!.lines[0]).toMatchObject({ key: "invoice.line.setupFee", amount: 40 });
    const c = accepted(s, web, 12, 0);
    done(s, createAccount(s, c.id, mailed(s, c.id)));
    done(s, confirmOrder(s, c.id));
    expect(invoiceOf(s, c.req())!.lines.some((l) => l.key === "invoice.line.setupFee")).toBe(false);
  });
});

describe("domains", () => {
  function live(seed: number) {
    const s = readyGame(seed);
    const o = accepted(s, web, 8);
    done(s, createAccount(s, o.id, mailed(s, o.id)));
    done(s, confirmOrder(s, o.id));
    payNow(s, o.req().invoiceId!);
    run(s, 1);
    done(s, registerOrderDomain(s, o.id, ...owner(s, o.id)));
    done(s, provisionOrder(s, o.id, host(s, o)));
    return { s, ...o };
  }

  it("has a registry pun and a changing yearly cost per TLD", () => {
    expect(REGISTRIES.de.name).toBe("DENIQ");
    expect(registryCost("x.de", 2005)).toBeGreaterThan(registryCost("x.de", 2026));
  });

  it("warns before expiry, takes the site down when a cancelled domain lapses and comes back on renewal", () => {
    const { s, req } = live(16);
    const name = req().domain!, v = req().serviceId!, d = domainOf(s, name)!;
    expect(serviceOnline(s, v)).toBe(true);
    expect(setDomainRenewal(s, name, false).ok).toBe(true);
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
    expect(s.invoices.at(-1)!.lines[0]).toMatchObject({ key: "invoice.line.domainRenewal", amount: domainFee(yearOf(s.hour)) });
  });

  it("loads saves from before domains", () => {
    const { s } = live(13);
    const data = JSON.parse(serialize(s));
    delete data.domains;
    expect(deserialize(JSON.stringify(data)).domains).toEqual([]);
    expect(deserialize(serialize(s)).domains).toEqual(s.domains);
  });
});

describe("staff on custom orders", () => {
  it("leave the quote to the player, then create the account and invoice and set up the service once paid", () => {
    const s = readyGame(1);
    runTo(s, MONDAY_9);
    s.cash = 1e5;
    const c = visibleCandidates(s).find((x) => x.role === "support")!;
    const hired = hire(s, c.id);
    if (!hired.ok) throw new Error(hired.error);
    s.staff.find((e) => e.id === hired.id)!.trained = ["order"];
    const { req, tk } = order(s, vps);
    run(s, 3);
    expect(req().customerId).toBeNull();
    s.sales.requests = s.sales.requests.map((r) => (r.id === req().id ? { ...r, budget: 100 } : r));
    done(s, quoteOrder(s, tk().id, 20));
    for (let i = 0; i < 24 * 4 && !req().serviceId; i++) tick(s);
    expect(req().customerId).not.toBeNull();
    expect(req().invoiceId).toBeDefined();
    expect(req().serviceId).toBeDefined();
    const mine = req().thread.filter((m) => m.from === "you");
    expect(mine[0].by).toBeUndefined();
    expect(mine.slice(1).every((m) => m.by === s.staff[0].name)).toBe(true);
    expect(tk().status).toBe("waiting");
    payNow(s, req().invoiceId!);
    for (let i = 0; i < 24 * 4 && req().status !== "won"; i++) tick(s);
    expect(req().status).toBe("won");
    expect(tk().outcome).toBe("accepted");
  });
});

describe("routing and upgrades", () => {
  it("sets up on a chosen node and refuses one without the disk", () => {
    const s = readyGame(9);
    const { id, req } = accepted(s, vps, 20);
    done(s, createAccount(s, id, mailed(s, id)));
    done(s, confirmOrder(s, id));
    const options = routeOptions(s, "vps", "Frankfurt", req().spec!);
    expect(options.length).toBe(1);
    const node = options[0].nodes[0];
    expect(options[0].free.diskGb).toBeCloseTo(Math.max(0, options[0].cap.diskGb - options[0].used.diskGb));
    expect(options[0].cap.diskGb).toBeCloseTo(options[0].nodes.reduce((a, n) => a + n.cap.diskGb, 0));
    expect(provisionOrder(s, id, "dev999")).toEqual({ ok: false, error: "error.unknownCluster" });
    done(s, provisionOrder(s, id, node.id));
    expect(s.workloads.find((w) => w.serviceId === req().serviceId)!.deviceId).toBe(node.id);
    expect(routeOptions(s, "vps", "Frankfurt", req().spec!)[0].nodes.find((n) => n.id === node.id)!.used.vcpu).toBeCloseTo(node.used.vcpu + s.workloads.find((w) => w.serviceId === req().serviceId)!.vcpu);
    const big = accepted(s, vps, 20);
    done(s, createAccount(s, big.id, mailed(s, big.id)));
    s.sales.requests = s.sales.requests.map((r) => (r.id === big.r.id ? { ...r, spec: { ...r.spec!, diskGb: 10_000_000 } } : r));
    done(s, confirmOrder(s, big.id));
    expect(provisionOrder(s, big.id, node.id)).toEqual({ ok: false, error: "error.noCapacity" });
  });

  it("offers the upgrade price, locks the request until the customer answers and then grows the service", () => {
    const s = readyGame(10);
    const { id, req } = accepted(s, vps, 20);
    done(s, createAccount(s, id, mailed(s, id)));
    done(s, confirmOrder(s, id));
    done(s, provisionOrder(s, id, hostFor(s, req())!));
    const v = s.services.find((x) => x.id === req().serviceId)!, c = s.customers.find((x) => x.id === v.customerId)!;
    const t = createTicket(s, c, "upgrade", v.id, "grow");
    run(s, 1);
    const up = s.sales.requests.find((r) => r.kind === "expansion" && r.ticketId === t.id)!;
    expect(up.thread[0].key).toBe("sales.msg.upgrade");
    expect(up.spec!.ramGb).toBeGreaterThan(v.spec!.ramGb);
    expect(s.tickets.find((x) => x.id === t.id)!.topic).toBe("more");
    expect(offerUpgrade(s, up.id, up.reference * 0.5).ok).toBe(true);
    expect(s.sales.requests.find((r) => r.id === up.id)!.status).toBe("quoted");
    expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("waiting");
    expect(offerUpgrade(s, up.id, up.reference * 0.4)).toEqual({ ok: false, error: "error.unknownRequest" });
    expect(s.services.find((x) => x.id === v.id)!.spec).toEqual(v.spec);
    run(s, 25);
    const after = s.services.find((x) => x.id === v.id)!;
    expect(after.spec).toEqual(up.spec);
    expect(after.price * 730).toBeCloseTo(up.reference * 0.5, 1);
    expect(s.workloads.find((w) => w.serviceId === v.id)!.ramGb).toBe(up.spec!.ramGb);
    expect(s.sales.requests.find((r) => r.id === up.id)!.status).toBe("won");
  });
});

// Learns the provisioning skill without waiting for the training.
const learnAutomation = (s: GameState) => { s.unlocks = [...s.unlocks, "products", "provisioning"]; };

describe("quote first", () => {
  it("shows the quote first and opens no account before the customer accepts", () => {
    const s = readyGame(1);
    const customers = s.customers.length;
    const { id, r, req, tk } = order(s);
    expect(nextStep(s, req())).toBe("quote");
    expect(stepsDone(s, req())).toMatchObject({ quote: false, account: false });
    expect(confirmOrder(s, id)).toEqual({ ok: false, error: "error.needsQuote" });
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
    done(s, quoteOrder(s, id, r.reference));
    expect(req()).toMatchObject({ status: "quoted", attempts: 1 });
    expect(tk().status).toBe("waiting");
    expect(req().thread.at(-1)!.key).toMatch(/^reply\.order\.quote\./);
    expect(quoteOrder(s, id, 9)).toEqual({ ok: false, error: "error.quoteSent" });
    expect(nextStep(s, req())).toBeNull();
    for (let i = 0; i < 48 && req().status === "quoted"; i++) tick(s);
    expect(req().status).toBe("accepted");
    expect(tk()).toMatchObject({ status: "open", unread: true });
    expect(req().thread.some((m) => m.key === "sales.reply.accept")).toBe(true);
    expect(s.customers).toHaveLength(customers);
    expect(nextStep(s, req())).toBe("account");
    done(s, createAccount(s, id, mailed(s, id)));
    expect(s.customers).toHaveLength(customers + 1);
  });

  it("closes the ticket when the customer turns the quote down", () => {
    const s = readyGame(1);
    const customers = s.customers.length;
    const { id, r, req, tk } = order(s);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 0.1, attempts: 1 } : x));
    done(s, quoteOrder(s, id, r.reference));
    for (let i = 0; i < 48 && req().status === "quoted"; i++) tick(s);
    expect(req().status).toBe("lost");
    expect(tk().status).toBe("closed");
    expect(s.sales.lost.at(-1)!.reason).toBe("lost.price");
    expect(s.customers).toHaveLength(customers);
  });

  it("sends a refused or countered quote back to the inbox for another price", () => {
    const s = readyGame(1);
    const { id, r, req, tk } = order(s);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 0.1 } : x));
    done(s, quoteOrder(s, id, r.reference));
    for (let i = 0; i < 48 && req().status === "quoted"; i++) tick(s);
    expect(["refused", "countered"]).toContain(req().status);
    expect(tk()).toMatchObject({ status: "open", unread: true });
    expect(nextStep(s, req())).toBe("quote");
    expect(quoteOrder(s, id, r.reference * 0.5).ok).toBe(true);
  });

  it("lists the hosts with what is booked and sets up on the chosen one", () => {
    const s = readyGame(2);
    const first = s.clusters.find((c) => c.vm)!.id;
    const second = panelVm(s, s.clusters.find((c) => !c.vm && c.platform)!.id);
    const o = accepted(s, web, 12);
    done(s, createAccount(s, o.id, mailed(s, o.id)));
    done(s, confirmOrder(s, o.id));
    done(s, registerOrderDomain(s, o.id, ...owner(s, o.id)));
    const hosts = routeOptions(s, "webHosting", "Frankfurt", o.req().spec!);
    expect(hosts.map((h) => h.id).sort()).toEqual([first, second].sort());
    for (const h of hosts) {
      expect(h.cap.ramGb).toBeGreaterThan(0);
      expect(h.cap.diskGb).toBeGreaterThan(0);
      expect(h.used.ramGb).toBeLessThanOrEqual(h.cap.ramGb + 1e-9);
    }
    done(s, provisionOrder(s, o.id, second));
    expect(s.workloads.find((w) => w.serviceId === o.req().serviceId)!.clusterId).toBe(second);
  });

  it("refuses Automatic without the provisioning skill and places it with the skill", () => {
    const s = readyGame(4);
    const o = accepted(s, vps, 20);
    done(s, createAccount(s, o.id, mailed(s, o.id)));
    done(s, confirmOrder(s, o.id));
    expect(provisionOrder(s, o.id, "auto")).toEqual({ ok: false, error: "error.needsAutomation" });
    expect(s.services.some((v) => v.id === o.req().serviceId)).toBe(false);
    learnAutomation(s);
    done(s, provisionOrder(s, o.id, "auto"));
    expect(s.workloads.some((w) => w.serviceId === o.req().serviceId)).toBe(true);
    expect(o.req().route).toBe("auto");
  });

  it("learns the provisioning skill in ten days after Product management", () => {
    const skill = SKILLS.find((k) => k.id === "provisioning")!;
    expect(skill).toMatchObject({ name: "Provisioning automation", tier: 2, knowHow: 150, days: 10, needs: ["products"] });
    const s = readyGame(1);
    s.knowHow = 500;
    expect(research(s, "provisioning")).toEqual({ ok: false, error: "error.missingSkill" });
    s.unlocks = [...s.unlocks, "products"];
    expect(research(s, "provisioning").ok).toBe(true);
    expect(s.knowHow).toBe(350);
    run(s, 10 * 24);
    expect(s.unlocks).toContain("provisioning");
  });

  it("runs the whole chain on acceptance with the switch on", () => {
    const s = readyGame(3);
    expect(s.autoOrders).toBe(false);
    expect(setAutoOrders(s, true)).toEqual({ ok: false, error: "error.needsAutomation" });
    learnAutomation(s);
    expect(setAutoOrders(s, true).ok).toBe(true);
    const o = accepted(s, web, 10);
    const r = o.req();
    expect(r).toMatchObject({ route: "auto" });
    expect(r.customerId).not.toBeNull();
    expect(r.invoiceId).toBeDefined();
    expect(domainOf(s, r.domain!)?.customerId).toBe(r.customerId);
    expect(s.services.find((v) => v.id === r.serviceId)!.customerId).toBe(r.customerId);
    expect(r.thread.filter((m) => m.from === "you").slice(1).every((m) => m.by === "Automation")).toBe(true);
    payNow(s, r.invoiceId!);
    run(s, 2);
    expect(o.req().status).toBe("won");
    expect(setAutoOrders(s, false).ok).toBe(true);
    expect(s.autoOrders).toBe(false);
  });

  it("quotes an email order at the line's rate with the switch on", () => {
    const s = readyGame(3);
    learnAutomation(s);
    setAutoOrders(s, true);
    const o = order(s, web);
    expect(o.req()).toMatchObject({ status: "quoted" });
    expect(o.req().quote).toBeGreaterThan(0);
    expect(o.req().thread.at(-1)).toMatchObject({ from: "you", by: "Automation" });
    expect(o.tk().status).toBe("waiting");
  });

  it("leaves the order at the failed step when the chain cannot place it", () => {
    const s = readyGame(3);
    learnAutomation(s);
    const o = order(s, vps);
    setAutoOrders(s, true);
    s.sales.requests = s.sales.requests.map((x) => (x.id === o.r.id ? { ...x, budget: 100, spec: { ...x.spec!, diskGb: 10_000_000 } } : x));
    done(s, quoteOrder(s, o.id, 20));
    for (let i = 0; i < 60 && !stepsDone(s, o.req()).quote; i++) tick(s);
    expect(o.req().invoiceId).toBeDefined();
    expect(o.req().serviceId).toBeNull();
    expect(provisionOrder(s, o.id, "auto")).toEqual({ ok: false, error: "error.noCapacity" });
  });

  it("makes a shop order wait for the steps without automation and skips the quote", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    openShop(s);
    s.shop.optionDiscount = { quarterly: -3, annual: -3, biennial: -3 };
    const customers = s.customers.length, r = orderLead(s, "private", "Frankfurt", [], web, false);
    const req = () => s.sales.requests.find((x) => x.id === r.id)!;
    expect(req()).toMatchObject({ shop: true, status: "accepted", serviceId: null });
    expect(s.customers).toHaveLength(customers);
    expect(stepsDone(s, req()).quote).toBe(true);
    expect(nextStep(s, req())).toBe("account");
    expect(quoteOrder(s, r.ticketId!, 5)).toEqual({ ok: false, error: "error.stepDone" });
    done(s, createAccount(s, r.ticketId!, mailed(s, r.ticketId!)));
    done(s, confirmOrder(s, r.ticketId!));
    expect(invoiceOf(s, req())!.lines.find((l) => l.key === "invoice.line.firstMonth")!.amount).toBe(r.quote);
  });

  it("loads saves with half-done orders and counts a started order's quote as accepted", () => {
    const s = readyGame(5);
    const idle = order(s), started = accepted(s, vps, 20);
    done(s, createAccount(s, started.id, mailed(s, started.id)));
    // As an older save kept it: the account exists, the status is still open and no quote was ever sent.
    s.sales.requests = s.sales.requests.map((x) => (x.id === started.r.id ? { ...x, status: "open", attempts: 0 } : x));
    const back = deserialize(JSON.stringify({ ...JSON.parse(serialize(s)), version: 4 }));
    const old = (id: string) => back.sales.requests.find((x) => x.id === id)!;
    expect(nextStep(back, old(idle.r.id))).toBe("quote");
    expect(stepsDone(back, old(started.r.id))).toMatchObject({ quote: true, account: true, invoice: false });
    expect(nextStep(back, old(started.r.id))).toBe("invoice");
    expect(confirmOrder(back, started.id).ok).toBe(true);
    expect(() => run(back, 48)).not.toThrow();
    expect(old(started.r.id).invoiceId).toBeDefined();
    expect(back.autoOrders).toBe(false);
  });
});
