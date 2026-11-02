import { describe, expect, it } from "vitest";
import { BILL_HAPPINESS, overageAmount, overuseOf, overuseTick, THROTTLE_HAPPINESS } from "../src/sim/80-business/overuse";
import type { GameState } from "../src/sim/50-state";
import { addCustomer, addService, answerTraffic, liftThrottle } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

// Four years of 20% growth put a VPS started at hour 0 well over the traffic its plan books.
function overSpent(seed = 7): { s: GameState; cid: string; sid: string } {
  const s = newGame(seed);
  const cid = addCustomer(s, "Traffic GmbH", "smallBiz");
  const sid = addService(s, cid, "vps", "VPS M", 0.02, "hour");
  s.services = s.services.map((v) => (v.id === sid ? { ...v, startedAt: 0 } : v));
  s.hour = 4 * 8760 + 12;
  return { s, cid, sid };
}
const svc = (s: GameState, id: string) => s.services.find((v) => v.id === id)!;
const err = (r: { ok: boolean }) => (r as { error?: string }).error;
const happy = (s: GameState, id: string) => s.customers.find((c) => c.id === id)!.happiness;

describe("traffic overuse", () => {
  it("measures traffic over the plan", () => {
    const { s, sid } = overSpent();
    const use = overuseOf(s, svc(s, sid))!;
    expect(use.overGb).toBeGreaterThan(0);
    expect(use.usedGb).toBeGreaterThan(use.includedGb);
  });

  it("bills the overage once a month at the line's traffic rate", () => {
    const { s, cid, sid } = overSpent();
    const before = happy(s, cid), over = overuseOf(s, svc(s, sid))!.overGb, n = s.invoices.length;
    expect(answerTraffic(s, sid, "bill").ok).toBe(true);
    const line = s.invoices[n].lines[0];
    expect(line.key).toBe("invoice.line.trafficOverage");
    expect(line.amount).toBe(overageAmount(s, svc(s, sid), over));
    expect(line.amount).toBeGreaterThan(0);
    expect(happy(s, cid)).toBe(before + BILL_HAPPINESS);
    expect(err(answerTraffic(s, sid, "bill"))).toBe("error.overuseHandled");
    s.hour += 730;
    expect(answerTraffic(s, sid, "bill").ok).toBe(true);
  });

  it("throttles traffic to the plan and lifts it again", () => {
    const { s, cid, sid } = overSpent();
    const before = happy(s, cid), used = overuseOf(s, svc(s, sid))!.usedGb;
    expect(answerTraffic(s, sid, "throttle").ok).toBe(true);
    expect(svc(s, sid).throttled).toBe(true);
    expect(happy(s, cid)).toBe(before + THROTTLE_HAPPINESS);
    expect(overuseOf(s, svc(s, sid))!.usedGb).toBeLessThan(used / 1.4);
    expect(liftThrottle(s, sid).ok).toBe(true);
    expect(svc(s, sid).throttled).toBeUndefined();
  });

  it("offers an upgrade as an upgrade ticket", () => {
    const { s, sid } = overSpent();
    expect(answerTraffic(s, sid, "upgrade").ok).toBe(true);
    expect(s.tickets.some((t) => t.serviceId === sid && t.kind === "upgrade" && t.topic === "traffic")).toBe(true);
    expect(err(answerTraffic(s, sid, "upgrade"))).toBe("error.overuseHandled");
  });

  it("refuses a service within its traffic", () => {
    const { s, sid } = overSpent();
    s.services = s.services.map((v) => (v.id === sid ? { ...v, startedAt: s.hour - 24 } : v));
    expect(err(answerTraffic(s, sid, "bill"))).toBe("error.noOveruse");
  });

  it("applies a set policy at noon and leaves services alone without one", () => {
    const { s, sid } = overSpent();
    const n = s.invoices.length;
    overuseTick(s);
    expect(s.invoices.length).toBe(n);
    s.overusePolicy = "bill";
    overuseTick(s);
    expect(s.invoices.length).toBe(n + 1);
    expect(svc(s, sid).overuseAt).toBe(s.hour);
    overuseTick(s);
    expect(s.invoices.length).toBe(n + 1);
  });

  it("loads an old save without a policy", () => {
    const raw = JSON.parse(serialize(newGame(3)));
    delete raw.overusePolicy;
    expect(deserialize(JSON.stringify(raw)).overusePolicy).toBeNull();
  });
});
