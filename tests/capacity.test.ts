import { describe, expect, it } from "vitest";
import { SLOW_PENALTY } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { bookable } from "../src/sim/60-infra/cluster";
import { homePeak, networkTick, zoneDemand } from "../src/sim/60-infra/network";
import { tick } from "../src/sim/88-tick/tick";
import { takeLoan } from "../src/sim/90-actions/billing";

import { connect, orderHomeLine } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { research } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { checkDone } from "../src/sim/checklist";
import { join, readyGame } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const happiness = (s: GameState) => s.customers.map((c) => c.happiness);
const clusterRam = (s: GameState) => s.clusters[0].nodes.reduce((n, x) => n + bookable(s, s.devices.find((d) => d.id === x.deviceId)!, true).ramGb, 0);

// Scales every basement service's traffic so the basement sends exactly mbit this hour (an evening hour).
function sendAt(s: GameState, mbit: number) {
  s.hour = s.hour - (s.hour % 24) + 20;
  const now = zoneDemand(s).loc1;
  s.services = s.services.map((v) => (v.zone ? { ...v, spec: { ...v.spec, trafficGb: v.spec.trafficGb * (mbit / now) } } : v));
  expect(zoneDemand(s).loc1).toBeCloseTo(mbit, 6);
}

describe("early capacity (docs/design/economy.md, Home line)", () => {
  it("slows the basement sites by the traffic the full home line drops, and says so once", () => {
    const s = readyGame(1);
    sendAt(s, 1.5);
    const before = happiness(s);
    const events = networkTick(s);
    const sites = s.services.filter((v) => v.zone).length;
    expect(sites).toBeGreaterThan(0);
    // 1.5 Mbit/s on a 1 Mbit/s upload drops a third: each site costs SLOW_PENALTY x 1/3 this hour.
    const lost = before.map((h, i) => h - happiness(s)[i]);
    expect(lost.reduce((a, b) => a + b, 0)).toBeCloseTo(sites * SLOW_PENALTY * (1 / 3), 6);
    expect(events.filter((e) => e.key === "event.lineFull")).toHaveLength(1);
    expect(events.some((e) => e.key === "event.saturated")).toBe(false);
    expect(s.homeLine.full).toBe(true);
    expect(homePeak(s)).toBeCloseTo(1.5, 2);
    s.hour++;
    sendAt(s, 1.5);
    expect(networkTick(s).some((e) => e.key === "event.lineFull")).toBe(false);
  });

  it("stops the slowdown once a line with more upload connects", () => {
    const s = readyGame(1);
    ok(orderHomeLine(s, "sdsl-2"));
    expect(s.homeLine.next?.id).toBe("sdsl-2");
    while (s.homeLine.id !== "sdsl-2") tick(s);
    expect(checkDone(s, "homeLine")).toBe(true);
    sendAt(s, 1.5);
    const before = happiness(s);
    expect(networkTick(s).some((e) => e.key === "event.lineFull")).toBe(false);
    expect(happiness(s)).toEqual(before);
  });

  it("doubles the cluster's RAM with a loan and a second basement server", () => {
    const s = readyGame(1);
    const ram = clusterRam(s);
    expect(buyDevice(s, "g1-compute", "Dwell", 1, "loc1").ok).toBe(false);
    ok(takeLoan(s, 5_000, 3));
    expect(checkDone(s, "loan")).toBe(true);
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", 2));
    ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 1 }));
    expect(checkDone(s, "secondServer")).toBe(true);
    join(s, s.clusters[0].id, id);
    // The new node adds its full 8 GB; the control plane already sits on the first.
    expect(clusterRam(s)).toBeCloseTo(ram + 8, 6);
  });

  it("teaches Product management as a tier 1 skill for 100 know-how in a week", () => {
    const s = { ...readyGame(1), knowHow: 99 };
    expect(research(s, "products").ok).toBe(false);
    s.knowHow = 100;
    const at = s.hour;
    ok(research(s, "products"));
    expect(s.knowHow).toBeCloseTo(0, 6);
    while (s.training) tick(s);
    expect(s.unlocks).toContain("products");
    expect(s.hour - at).toBe(7 * 24);
  });

  it("loads a save from before the full-line flag", () => {
    const s = readyGame(1);
    const raw = JSON.parse(serialize(s));
    raw.homeLine = { id: "dsl-16", next: null };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.homeLine.full).toBeUndefined();
    expect(checkDone(loaded, "homeLine")).toBe(false);
    sendAt(loaded, 1.5);
    expect(networkTick(loaded).some((e) => e.key === "event.lineFull")).toBe(true);
  });
});
