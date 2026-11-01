import { describe, expect, it } from "vitest";
import { LOG_SOURCES, logLines } from "../src/sim/80-business/readouts";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host(seed = 1) {
  const s = readyGame(seed);
  skipTo(s, 2008);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id), c = s.clusters.find((x) => x.id === id)!;
  s.services.push({ id: "svc-x", domain: "shop.example.com", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 1 } } as never);
  s.workloads.push({ id: "w-x", serviceId: "svc-x", clusterId: c.id, diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never);
  return { s, c };
}

describe("log viewer", () => {
  it("writes the request of an abuse notice before the ticket", () => {
    const { s, c } = host();
    const at = s.hour - 5;
    s.tickets.push({ id: "t-x", serviceId: "svc-x", createdAt: at, topic: "spam", notice: { url: "https://shop.example.com/bad", sender: "x", from: "x", video: null, real: true, round: 1, followAt: null } } as never);
    const line = logLines(s, c, "access", 500).find((x) => x.params.path === "/bad")!;
    expect(line.hour).toBeLessThan(at);
    expect(logLines(s, c, "mail", 50).some((x) => x.hour < at)).toBe(true);
  });

  it("shows a foreign login at the hour of a breach", () => {
    const { s, c } = host();
    s.breaches.push({ hour: s.hour - 3, hostId: c.id, ticketId: "t", ransom: 0, decision: null, sold: false, fineAt: null, fine: null });
    expect(logLines(s, c, "auth", 500).some((x) => x.key === "auth.ok" && x.hour === s.hour - 3)).toBe(true);
  });

  it("shows error lines for the devices of a power incident", () => {
    const { s, c } = host();
    const d = s.devices[0].id;
    c.nodes.push({ deviceId: d } as never);
    s.ops.incidents.push({ id: "i-x", hour: s.hour - 4, cause: "grid", locationId: "l", minutes: 60, dark: 1, devices: [d], customers: [], agency: null, returnAt: null });
    expect(logLines(s, c, "error", 50).some((x) => x.key === "error.power" && x.hour === s.hour - 4)).toBe(true);
  });

  it("repeats for the same seed and differs for another", () => {
    const a = host(1), b = host(2);
    for (const src of LOG_SOURCES) expect(logLines(a.s, a.c, src, 100)).toEqual(logLines(a.s, a.c, src, 100));
    expect(logLines(a.s, a.c, "auth", 100)).not.toEqual(logLines(b.s, b.c, "auth", 100));
  });
});
