import { describe, expect, it } from "vitest";
import { serviceOnline } from "../src/sim/40-support/status";
import { holdReason, serviceHeld } from "../src/sim/45-billing/billing";
import { HELD_LOAD, workloadLoad } from "../src/sim/60-infra/usage";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { suspendService, terminateService, unsuspendService } from "../src/sim/90-actions/holds";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame, newGame } from "./fixtures";

function setup() {
  const s = readyGame(1);
  panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const mk = (label: string) => { const r = provisionService(s, cus, "webHosting", { label }); if (!r.ok) throw new Error(r.error); return r.id!; };
  const a = mk("a.com"), b = mk("b.com");
  return { s, cus, a, b, svc: (id: string) => s.services.find((v) => v.id === id)! };
}

describe("service holds", () => {
  it("holds one account and not its sibling, then brings it back", () => {
    const { s, a, b, svc } = setup();
    expect(suspendService(s, a, "manual").ok).toBe(true);
    expect(serviceHeld(s, svc(a))).toBe(true);
    expect(serviceHeld(s, svc(b))).toBe(false);
    expect(serviceOnline(s, a)).toBe(false);
    expect(serviceOnline(s, b)).toBe(true);
    expect(holdReason(s, svc(a))).toBe("manual");
    expect(unsuspendService(s, a).ok).toBe(true);
    expect(serviceOnline(s, a)).toBe(true);
  });

  it("refuses to lift a payment hold while the invoice is unpaid", () => {
    const { s, cus, a, svc } = setup();
    s.invoices.push({ id: "inv1", number: "1", customerId: cus, status: "overdue", suspended: true, lines: [], reminders: [], dueAt: 0, suspendedAt: s.hour } as never);
    expect(holdReason(s, svc(a))).toBe("payment");
    expect(unsuspendService(s, a)).toEqual({ ok: false, error: "error.holdPayment" });
  });

  it("closes an open abuse notice and costs a shady customer no happiness", () => {
    const { s, cus, a } = setup();
    s.customers.find((c) => c.id === cus)!.shady = true;
    const before = s.customers.find((c) => c.id === cus)!.happiness;
    s.tickets.push({ id: "tkt900", kind: "notice", serviceId: a, customerId: cus, status: "open" } as never);
    suspendService(s, a, "abuse");
    expect(s.tickets.find((t) => t.id === "tkt900")).toMatchObject({ status: "resolved", outcome: "takenDown" });
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBe(before);
  });

  it("frees used CPU on a held account", () => {
    const { s, a } = setup();
    const w = workloadsOf(s, a)[0];
    s.hour += 24 * 40 + 14;
    suspendService(s, a, "manual");
    expect(workloadLoad(s, w, s.hour)).toBe(HELD_LOAD);
  });

  it("terminates an account and frees its booking", () => {
    const { s, a, b, svc } = setup();
    suspendService(s, a, "manual");
    expect(terminateService(s, a).ok).toBe(true);
    expect(svc(a).endedAt).toBe(s.hour);
    expect(workloadsOf(s, a)).toHaveLength(0);
    expect(workloadsOf(s, b)).toHaveLength(1);
    expect(s.heldServices[a]).toBeUndefined();
  });

  it("loads an old save without heldServices and round trips holds", () => {
    const { s, a } = setup();
    suspendService(s, a, "abuse");
    expect(deserialize(serialize(s)).heldServices).toEqual({ [a]: "abuse" });
    const old = JSON.parse(serialize(newGame(2)));
    delete old.heldServices;
    expect(deserialize(JSON.stringify(old)).heldServices).toEqual({});
  });
});
