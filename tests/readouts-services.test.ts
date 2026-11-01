import { describe, expect, it } from "vitest";
import { companyDomain } from "../src/sim/30-customers/domains";
import { mailChecks, QUERIES_PER_ZONE_HOUR, seriesOf, vpnSessions } from "../src/sim/80-business/readouts";
import type { SoftwareKind } from "../src/sim/10-catalog/platforms";
import { panelVm, readyGame, skipTo } from "./fixtures";

// A cluster of the given kind hosted by a virtual machine, with one customer workload on it.
function host(kind: SoftwareKind, spec: object, seed = 1) {
  const s = readyGame(seed);
  skipTo(s, 2008);
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id), c = s.clusters.find((x) => x.id === id)!;
  c.kind = kind;
  s.customers.push({ id: "cu-x", name: "Ada Byron", profile: "soleProp" } as never);
  s.services.push({ id: "svc-x", customerId: "cu-x", product: kind === "storage" ? "storage" : kind === "vpn" ? "vpn" : "dns", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 40, trafficGb: 50, mailboxes: 0, ...spec } } as never);
  const w = { id: "w-7", serviceId: "svc-x", clusterId: c.id, diskGb: 40, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never;
  s.workloads.push(w);
  return { s, c, w: w as never as typeof s.workloads[number] };
}

describe("infrastructure readouts", () => {
  it("draws the query curve from the load and zeroes it for a down workload", () => {
    const { s, w } = host("dns", { zones: 3 });
    const q = seriesOf(s, [w], "queries");
    expect(q).toHaveLength(24);
    expect(Math.max(...q)).toBeGreaterThan(0);
    expect(Math.max(...q)).toBeLessThanOrEqual(3 * QUERIES_PER_ZONE_HOUR * 1.2 ** (s.hour / 8760) * 2);
    w.stopped = true;
    expect(seriesOf(s, [w], "queries").every((x) => x === 0)).toBe(true);
  });

  it("checks SPF and DKIM as pass, missing and not checked", () => {
    const { s } = host("dns", { zones: 1 }), domain = companyDomain(s);
    expect(mailChecks(s, domain).spf).toBe("unchecked");
    const mail = host("mail", {}).c;
    s.clusters.push({ ...mail, id: "mail-x", kind: "mail" });
    expect(mailChecks(s, domain)).toEqual({ spf: "pass", dkim: "pass", dmarc: "missing" });
    expect(mailChecks(s, "elsewhere.example").spf).toBe("unchecked");
    s.clusters = s.clusters.filter((c) => c.kind !== "dns");
    expect(mailChecks(s, domain).spf).toBe("missing");
  });

  it("keeps sessions within the booked users and empties them when down", () => {
    const { s, c, w } = host("vpn", { users: 10 });
    const list = vpnSessions(s, c);
    expect(list.length).toBeLessThanOrEqual(10);
    expect(vpnSessions(s, c)).toEqual(list);
    for (const h of [s.hour, s.hour + 5, s.hour + 11]) expect(vpnSessions(s, c, h).length).toBeLessThanOrEqual(10);
    w.stopped = true;
    expect(vpnSessions(s, c)).toEqual([]);
  });

  it("fills storage without passing the booked disk or shrinking", () => {
    const { s, w } = host("storage", {});
    const v = seriesOf(s, [w], "storage");
    expect(v).toHaveLength(30);
    expect(Math.max(...v)).toBeLessThanOrEqual(w.diskGb);
    expect(v.every((x, i) => i === 0 || x >= v[i - 1])).toBe(true);
  });
});
