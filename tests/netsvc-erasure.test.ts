import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { nodeCapacity } from "../src/sim/60-infra/cluster";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { ecHealth } from "../src/sim/60-infra/netsvc-storage";
import { setParity } from "../src/sim/90-actions/netsvc-storage";
import { storageGame } from "./storage-game";

void sizeSpec;

// Eight drives on the server, so an erasure set is eight drives wide.
function eightDrives() {
  const g = storageGame("minnio"), d = g.s.devices.find((x) => x.id === "dev3")!;
  const drive = d.components.find((c) => c.kind === "hdd" || c.kind === "ssd" || c.kind === "nvme")!;
  d.components = [...d.components.filter((c) => c.id !== drive.id), ...Array.from({ length: 8 }, (_, i) => ({ ...drive, id: `ec${i}`, installedAt: 0, failedAt: null }))];
  const fail = (n: number, at = g.s.hour) => { d.components.filter((c) => c.id.startsWith("ec")).slice(0, n).forEach((c) => { c.failedAt = at; }); };
  return { ...g, d, fail };
}

describe("erasure coding health", () => {
  it("is healthy, degraded or offline by the failed drives against the parity", () => {
    const { s, cluster, v, d, fail } = eightDrives();
    expect(ecHealth(s, cluster.id)).toMatchObject({ set: 8, failed: 0, state: "healthy" });
    fail(2);
    expect(ecHealth(s, cluster.id).state).toBe("degraded");
    netsvcTick(s);
    expect(s.services.find((x) => x.id === v().id)!.slowedAt).toBe(s.hour);
    d.components.filter((c) => c.id.startsWith("ec"))[2].failedAt = s.hour;
    expect(ecHealth(s, cluster.id).state).toBe("offline");
  });

  it("takes the storage offline when the set is lost and brings it back with a drive", () => {
    const { s, cluster, v, d, fail } = eightDrives();
    fail(3);
    netsvcTick(s);
    expect(s.netsvc.broken[v().id]?.cause).toBe("storage");
    expect(serviceOnline(s, v().id)).toBe(false);
    d.components.find((c) => c.id === "ec0")!.failedAt = null;
    netsvcTick(s);
    expect(s.netsvc.broken[v().id]).toBeUndefined();
    expect(ecHealth(s, cluster.id).state).toBe("degraded");
  });

  it("wears on the customer after 72 degraded hours", () => {
    const { s, v, fail, happy } = eightDrives();
    s.hour = 24 * 40;
    fail(1, s.hour);
    const before = happy();
    s.hour += 48;
    netsvcTick(s);
    expect(happy()).toBe(before);
    s.hour = 24 * 40 + 96;
    netsvcTick(s);
    expect(happy()).toBe(before - 1);
    expect(v().id).toBeTruthy();
  });

  it("shows a replacement drive as healing for a derived time", () => {
    const { s, cluster, d } = eightDrives();
    s.hour = 1000;
    d.components.find((c) => c.id === "ec1")!.installedAt = s.hour - 0.5;
    const h = ecHealth(s, cluster.id);
    expect(h.healing).not.toBeNull();
    expect(h.healing!).toBeGreaterThan(0);
    s.hour += 24;
    expect(ecHealth(s, cluster.id).healing).toBeNull();
  });

  it("leaves less usable disk with parity 4", () => {
    const { s, cluster, d } = eightDrives();
    const two = nodeCapacity(d, s).diskGb;
    expect(setParity(s, cluster.id, 4).ok).toBe(true);
    expect(nodeCapacity(d, s).diskGb / two).toBeCloseTo(0.5 / 0.75, 5);
    expect(setParity(s, cluster.id, 3).ok).toBe(false);
  });
});
