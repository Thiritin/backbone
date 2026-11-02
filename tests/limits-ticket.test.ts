import { describe, expect, it } from "vitest";
import { STARVED_RECENT } from "../src/sim/40-support/tick";
import { productsTick } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLimits } from "../src/sim/90-actions/limits";
import { resolveTicket } from "../src/sim/90-actions/support";
import { get, ticketOf } from "./support.helpers";
import { panelVm, readyGame } from "./fixtures";

// A customer with a VPS shrunk below its need, so the next product tick starves it.
function starved() {
  const s = readyGame(1);
  const cloud = s.clusters.find((c) => c.kind === "cloud")!.id;
  panelVm(s, cloud);
  const cus = addCustomer(s, "Ada Lang", "gamer");
  const r = provisionService(s, cus, "vps", { label: "a.example", clusterId: cloud });
  if (!r.ok) throw new Error(r.error);
  const id = r.id!, svc = () => s.services.find((v) => v.id === id)!, happiness = () => s.customers.find((c) => c.id === cus)!.happiness;
  const sold = { vcpu: svc().spec.vcpu, ramGb: svc().spec.ramGb, diskGb: svc().spec.diskGb };
  setLimits(s, id, { vcpu: 0.25, ramGb: 0.25, diskGb: sold.diskGb });
  const ask = () => {
    const t = ticketOf(s, "outage", "slow", cus, id);
    expect(resolveTicket(s, t.id, "upgrade")).toMatchObject({ ok: true });
    for (let i = 0; i < 3; i++) tick(s);
    return get(s, t.id);
  };
  const requests = (ticketId: string) => s.sales.requests.filter((q) => q.ticketId === ticketId);
  const heal = () => setLimits(s, id, sold);
  return { s, id, svc, happiness, ask, heal, requests, productsTick: () => productsTick(s) };
}

describe("upgrade on a slow ticket", () => {
  it("opens an expansion request when our limit starved the service", () => {
    const { s, svc, ask, requests, productsTick } = starved();
    productsTick();
    expect(svc().starvedAt).toBe(s.hour);
    const t = ask();
    expect(t).toMatchObject({ status: "resolved", outcome: "upgraded" });
    expect(requests(t.id)).toMatchObject([{ kind: "expansion", serviceId: svc().id }]);
  });

  it("declines with a happiness penalty and no request when the host was slow", () => {
    const { s, id, svc, happiness, ask, requests, productsTick } = starved();
    productsTick();
    s.services = s.services.map((v) => (v.id === id ? { ...v, slowedAt: s.hour } : v));
    const before = happiness();
    const t = ask();
    expect(t).toMatchObject({ status: "resolved", outcome: "upgradeDeclined" });
    expect(happiness()).toBeLessThan(before);
    expect(requests(t.id)).toEqual([]);
    expect(svc().starvedAt).toBeDefined();
  });

  it("declines when the starvation is older than the window or never happened", () => {
    const old = starved();
    old.productsTick();
    old.s.hour += STARVED_RECENT + 1;
    old.heal();
    expect(old.ask()).toMatchObject({ outcome: "upgradeDeclined" });
    const never = starved();
    never.heal();
    expect(never.svc().starvedAt).toBeUndefined();
    const t = never.ask();
    expect(t).toMatchObject({ outcome: "upgradeDeclined" });
    expect(never.requests(t.id)).toEqual([]);
  });
});
