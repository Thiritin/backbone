import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { hostFor, invoiceOf, orderChoices, stepMinutes } from "../src/sim/30-market/manual";
import type { Spec } from "../src/sim/10-catalog/products";
import type { GameState } from "../src/sim/50-state";
import { workloadUse } from "../src/sim/60-infra/usage";
import { tick } from "../src/sim/88-tick/tick";
import { suggestedUsername, type PackageDef } from "../src/sim/80-business/packages";
import { confirmOrder, createAccount, provisionOrder, quoteOrder, registerOrderDomain } from "../src/sim/90-actions/orders";
import { addPackage, changePackage } from "../src/sim/90-actions/packages";
import { mailed, readyGame } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const must = (r: { ok: boolean; error?: string }) => { if (!r.ok) throw new Error(r.error); run(s0, 1); };
let s0: GameState;

// An accepted, invoiced, paid and domain-ready web hosting order; returns the ticket id, a request reader and the host cluster.
function ready(seed: number) {
  const s = s0 = readyGame(seed);
  const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true), id = r.ticketId!;
  s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
  quoteOrder(s, id, 10);
  for (let i = 0; i < 60 && !s.sales.requests.find((x) => x.id === r.id)!.customerId && s.sales.requests.find((x) => x.id === r.id)!.status !== "accepted"; i++) tick(s);
  const req = () => s.sales.requests.find((x) => x.id === r.id)!;
  must(createAccount(s, id, mailed(s, id)));
  must(confirmOrder(s, id));
  s.invoices = s.invoices.map((i) => (i.id === invoiceOf(s, req())!.id ? { ...i, payStep: 0, payAt: s.hour } : i));
  run(s, 1);
  must(registerOrderDomain(s, id));
  return { s, id, req, host: hostFor(s, req())! };
}
const pkg = (sold: Spec, name: string, f: (k: number) => number): PackageDef => ({
  name, product: "webHosting", spec: { ...sold, vcpu: sold.vcpu * f(0), ramGb: sold.ramGb * f(1), diskGb: sold.diskGb * f(2) },
});
const make = ready;

describe("provision from a package", () => {
  it("books the package size for a larger package and keeps the sold spec", () => {
    const { s, id, req, host } = make(21);
    expect(addPackage(s, host, pkg(req().spec, "Big", () => 2)).ok).toBe(true);
    must(provisionOrder(s, id, host, { package: "big" }));
    const v = s.services.find((x) => x.id === req().serviceId)!, w = s.workloads.find((x) => x.serviceId === v.id)!;
    expect(v.pkg).toBe("Big");
    expect(v.spec.ramGb).toBe(req().spec.ramGb);
    expect([w.vcpu, w.ramGb, w.diskGb]).toEqual([req().spec.vcpu * 2, req().spec.ramGb * 2, req().spec.diskGb * 2]);
    expect(w.promised).toBeUndefined();
  });

  it("books less for a smaller package and records what was sold", () => {
    const { s, id, req, host } = make(22);
    addPackage(s, host, pkg(req().spec, "Small", (k) => (k === 1 ? 0.5 : 1)));
    must(provisionOrder(s, id, host, { package: "Small" }));
    const w = s.workloads.find((x) => x.serviceId === req().serviceId)!;
    expect(w.ramGb).toBe(req().spec.ramGb * 0.5);
    expect(w.promised).toMatchObject({ vcpu: req().spec.vcpu, ramGb: req().spec.ramGb, diskGb: req().spec.diskGb });
    const full = { ...w, promised: undefined };
    expect(workloadUse(s, w).ramGb).toBeCloseTo(workloadUse(s, full).ramGb * 2, 9);
  });

  it("refuses a package below the floor or one that is missing", () => {
    const { s, id, req, host } = make(23);
    addPackage(s, host, pkg(req().spec, "Tiny", () => 0.1));
    expect(provisionOrder(s, id, host, { package: "Tiny" })).toEqual({ ok: false, error: "error.packageTooSmall" });
    expect(provisionOrder(s, id, host, { package: "Nope" })).toEqual({ ok: false, error: "error.packageMissing" });
  });

  it("works with three arguments as before", () => {
    const { s, id, req, host } = make(24);
    addPackage(s, host, pkg(req().spec, "Big", () => 2));
    must(provisionOrder(s, id, host));
    const v = s.services.find((x) => x.id === req().serviceId)!;
    expect(v.pkg).toBeUndefined();
    expect(s.workloads.find((x) => x.serviceId === v.id)!.ramGb).toBe(req().spec.ramGb);
  });

  it("takes 8 minutes with a covering package and 15 otherwise", () => {
    const { s, id, req, host } = make(25);
    expect(stepMinutes("provision", s, req())).toBe(15);
    addPackage(s, host, pkg(req().spec, "Big", () => 2));
    addPackage(s, host, pkg(req().spec, "Small", (k) => (k === 1 ? 0.5 : 1)));
    provisionOrder(s, id, host, { package: "Small" });
    expect(stepMinutes("provision", s, req())).toBe(15);
    s.sales.requests = s.sales.requests.map((x) => (x.id === req().id ? { ...x, pkg: "Big" } : x));
    expect(stepMinutes("provision", s, req())).toBe(8);
  });

  it("checks the username by year and uniqueness, and stores it", () => {
    const { s, id, req, host } = make(26);
    expect(provisionOrder(s, id, host, { username: "Bad Name" })).toEqual({ ok: false, error: "error.username" });
    expect(provisionOrder(s, id, host, { username: "abcdefghijk" })).toEqual({ ok: false, error: "error.username" });
    s.services.push({ ...structuredClone(s.services[0] ?? ({} as never)), id: "svcX", endedAt: null, username: "taken" });
    expect(provisionOrder(s, id, host, { username: "taken" })).toEqual({ ok: false, error: "error.usernameTaken" });
    must(provisionOrder(s, id, host, { username: "mysite" }));
    expect(s.services.find((x) => x.id === req().serviceId)!.username).toBe("mysite");
  });

  it("suggests a free username that fits the limit", () => {
    const s = readyGame(27);
    expect(suggestedUsername(s, "my-long-domain.example", 2005)).toBe("mylongdo");
    s.services.push({ id: "a", username: "mylongdo", endedAt: null } as never);
    expect(suggestedUsername(s, "my-long-domain.example", 2005)).toBe("mylongd2");
  });

  it("lists the open orders with the reason one is not ready", () => {
    const s = readyGame(28);
    const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
    quoteOrder(s, r.ticketId!, 10);
    for (let i = 0; i < 60 && orderChoices(s, ["webHosting"]).every((c) => c.requestId !== r.id); i++) tick(s);
    const c = orderChoices(s, ["webHosting"]).find((x) => x.requestId === r.id)!;
    expect(c).toMatchObject({ ticketId: r.ticketId, error: "error.needsAccount", paid: false });
    expect(JSON.stringify(c)).not.toContain("shady");
    expect(orderChoices(s, ["vps"]).some((x) => x.requestId === r.id)).toBe(false);
  });
});

describe("change package", () => {
  const sold = (seed: number, first?: string) => {
    const m = make(seed);
    addPackage(m.s, m.host, pkg(m.req().spec, "Big", () => 2));
    addPackage(m.s, m.host, pkg(m.req().spec, "Lean", (k) => (k === 1 ? 0.5 : 1)));
    must(provisionOrder(m.s, m.id, m.host, first ? { package: first } : undefined));
    const v = () => m.s.services.find((x) => x.id === m.req().serviceId)!, w = () => m.s.workloads.find((x) => x.serviceId === v().id)!;
    return { ...m, v, w };
  };

  it("books the new package in place and keeps the sold spec", () => {
    const { s, v, w } = sold(61);
    const spec = { ...v().spec };
    expect(changePackage(s, v().id, "big").ok).toBe(true);
    expect([v().pkg, w().ramGb, w().promised]).toEqual(["Big", spec.ramGb * 2, undefined]);
    expect(v().spec).toEqual(spec);
    expect(s.activity.at(-1)).toMatchObject({ key: "activity.changePackage", minutes: 60 });
  });

  it("sets promised for a smaller package and clears it again", () => {
    const { s, req, v, w } = sold(62);
    changePackage(s, v().id, "Lean");
    expect(w().promised).toMatchObject({ ramGb: req().spec.ramGb });
    expect(w().ramGb).toBe(req().spec.ramGb * 0.5);
    changePackage(s, v().id, "Big");
    expect(w().promised).toBeUndefined();
  });

  it("refuses a missing package, one below the floor and a full node", () => {
    const { s, req, host, v, w } = sold(63);
    expect(changePackage(s, v().id, "Nope")).toEqual({ ok: false, error: "error.packageMissing" });
    addPackage(s, host, pkg(req().spec, "Tiny", () => 0.1));
    expect(changePackage(s, v().id, "Tiny")).toEqual({ ok: false, error: "error.packageTooSmall" });
    addPackage(s, host, pkg(req().spec, "Huge", () => 10000));
    const before = w().ramGb;
    expect(changePackage(s, v().id, "Huge")).toEqual({ ok: false, error: "error.noCapacity" });
    expect(w().ramGb).toBe(before);
  });
});
