import { describe, expect, it } from "vitest";
import { LEVEL_BAD, LEVEL_WARN, accountUse, levelOf } from "../src/sim/80-business/readouts";
import { readyGame, skipTo } from "./fixtures";

// A web account whose service has run since 2005 and is judged in a later year.
function account() {
  const s = readyGame(1);
  skipTo(s, 2006);
  const base = s.services[0] ?? null;
  const v = { ...(base ?? {}), id: "svc-x", customerId: s.customers[0]?.id ?? "c", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 3 } } as never;
  s.services.push(v);
  const w = { id: "w-x", serviceId: "svc-x", clusterId: "none", diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never;
  s.workloads.push(w);
  return { s, w: w as (typeof s.workloads)[number] };
}

describe("account usage", () => {
  it("turns amber at 80% and red at 95%", () => {
    expect(levelOf(0.79, 1)).toBe("ok");
    expect(levelOf(LEVEL_WARN, 1)).toBe("warn");
    expect(levelOf(0.94, 1)).toBe("warn");
    expect(levelOf(LEVEL_BAD, 1)).toBe("bad");
  });

  it("exceeds the traffic limit of a service run for years", () => {
    const { s, w } = account();
    skipTo(s, 2012);
    const u = accountUse(s, w);
    expect(u.traffic[0]).toBeGreaterThan(u.traffic[1]);
    expect(u.level).toBe("bad");
    expect(u.mailboxes).toBe(3);
  });

  it("gives the same figure twice", () => {
    const { s, w } = account();
    expect(accountUse(s, w)).toEqual(accountUse(s, w));
  });
});
