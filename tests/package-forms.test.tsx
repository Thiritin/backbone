import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { orderLead } from "../src/sim/30-market/orders";
import { hostFor, invoiceOf, orderChoices } from "../src/sim/30-market/manual";
import type { GameState } from "../src/sim/50-state";
import { familyOf } from "../src/sim/60-infra/vulns";
import { createFormFor, createLink } from "../src/sim/80-business/consoles";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, createAccount, provisionOrder, quoteOrder, registerOrderDomain } from "../src/sim/90-actions/orders";
import { addPackage } from "../src/sim/90-actions/packages";
import { ProvisionForm } from "../src/ui/apps/browser/consoles/PackageForms";
import { panelVm, readyGame } from "./fixtures";

let s0: GameState;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const must = (r: { ok: boolean; error?: string }) => { if (!r.ok) throw new Error(r.error); run(s0, 1); };

// An accepted web hosting order; with ready it also has its account, invoice and domain done.
function order(seed: number, ready: boolean) {
  const s = s0 = readyGame(seed);
  const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true), id = r.ticketId!;
  s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
  quoteOrder(s, id, 10);
  const req = () => s.sales.requests.find((x) => x.id === r.id)!;
  for (let i = 0; i < 60 && req().status !== "accepted" && !req().customerId; i++) tick(s);
  if (ready) {
    must(createAccount(s, id));
    must(confirmOrder(s, id));
    s.invoices = s.invoices.map((i) => (i.id === invoiceOf(s, req())!.id ? { ...i, payStep: 0, payAt: s.hour } : i));
    run(s, 1);
    must(registerOrderDomain(s, id));
  }
  return { s, id, req, host: hostFor(s, req())! };
}
const form = (s: GameState, host: string, id?: string) =>
  renderToString(<ProvisionForm game={s} c={s.clusters.find((c) => c.id === host)!} products={["webHosting"]} order={id} />);

describe("create account form", () => {
  it("is prefilled from a ready order", () => {
    const { s, id, req, host } = order(31, true);
    const html = form(s, host, id);
    expect(html).toContain(req().domain!);
    expect(html).toContain(`value="${orderChoices(s, ["webHosting"])[0].suggestedUsername}"`);
    expect(html).toContain(`contact@${req().domain}`);
  });

  it("lists an order that is not ready disabled with its reason", () => {
    const { s, id, host } = order(32, false);
    const choice = orderChoices(s, ["webHosting"]).find((o) => o.ticketId === id)!;
    expect(choice.error).not.toBeNull();
    const html = renderToString(<ProvisionForm game={s} c={s.clusters.find((c) => c.id === host)!} products={["webHosting"]} />);
    expect(html).toMatch(/<option value="[^"]+" disabled="">/);
    expect(html).toContain(t(choice.error!));
  });

  it("offers the packages of the host, larger ones first and smaller ones marked", () => {
    const { s, id, req, host } = order(33, true);
    const sold = req().spec;
    addPackage(s, host, { name: "Big", product: "webHosting", spec: { ...sold, vcpu: sold.vcpu * 2 } });
    addPackage(s, host, { name: "Lean", product: "webHosting", spec: { ...sold, ramGb: sold.ramGb * 0.5 } });
    const html = form(s, host, id);
    expect(html.indexOf(">Big<")).toBeGreaterThan(0);
    expect(html.indexOf(">Big<")).toBeLessThan(html.indexOf("Lean (oversells)"));
  });

  it("makes the same call the form submits: host, package and username", () => {
    const { s, id, req, host } = order(34, true);
    addPackage(s, host, { name: "Big", product: "webHosting", spec: { ...req().spec, vcpu: req().spec.vcpu * 2 } });
    const user = orderChoices(s, ["webHosting"])[0].suggestedUsername!;
    must(provisionOrder(s, id, host, { package: "Big", username: user }));
    const v = s.services.find((x) => x.id === req().serviceId)!;
    expect([v.pkg, v.username]).toEqual(["Big", user]);
  });

  it("links from Support only for a console with a form", () => {
    const { s, id, host } = order(35, true);
    expect(createFormFor(familyOf(s.clusters.find((x) => x.id === host)!), "webHosting")).toBe(false);
    const cp = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
    expect(createFormFor(familyOf(s.clusters.find((x) => x.id === cp)!), "webHosting")).toBe(true);
    expect(createLink(s, cp, id)).toContain(`/scripts/wwwacct?order=${id}`);
  });
});
