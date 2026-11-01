import { describe, expect, it } from "vitest";
import { chance, hashRng } from "../src/sim/00-core/rng";
import { dateOf } from "../src/sim/00-core/time";
import { idNum } from "../src/sim/10-catalog/usage";
import type { GameState } from "../src/sim/50-state";
import { BAD_POINT, holdsCopy, pointsOf, runBackups } from "../src/sim/60-infra/backups";
import { hasBackupElsewhere } from "../src/sim/60-infra/incidents";
import { lostDisk } from "../src/sim/60-infra/cluster";
import { restoreHours, WAN_GB_PER_HOUR } from "../src/sim/85-products/products";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { saveJob, testRestore } from "../src/sim/90-actions/backups";
import { connect } from "../src/sim/90-actions/hardware";
import { restoreWorkload } from "../src/sim/90-actions/vms";
import { buyDevice, hypervisor, named, panelServer, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; error?: string; id?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const nextAt = (s: GameState, hod: number, dow?: number) => {
  let h = s.hour + 1;
  while (dateOf(h).getUTCHours() !== hod || (dow !== undefined && dateOf(h).getUTCDay() !== dow)) h++;
  return h;
};
const step = (s: GameState, to: number, events: unknown[] = []) => {
  for (s.hour++; s.hour <= to; s.hour++) runBackups(s, events as never);
  s.hour = to;
};

function server(s: GameState, slot: number, port: number) {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", slot));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
  return id;
}

// Two hypervisor nodes with a customer's VPS, a backup server in the zone and one in another zone.
function setup() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = server(s, 2, 1), third = server(s, 3, 2), fourth = server(s, 4, 3);
  const src = hypervisor(s, ["dev3", second], "Cloud 1");
  const target = named(s, panelServer(s, third, "backula"), "Backup 1"), far = named(s, panelServer(s, fourth, "backula"), "Backup 2");
  s.clusters = s.clusters.map((c) => (c.id === far ? { ...c, az: "other-az" } : c));
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: src }));
  return { s, src, target, far, cus, vps };
}
const mine = (s: GameState, _id: string) => s.workloads.find((w) => w.serviceId && w.clusterId === _id)!;
const lose = (s: GameState, deviceId: string) => {
  s.devices = s.devices.map((d) => (d.id === deviceId ? { ...d, dataLost: s.hour } : d));
  tick(s);
};

describe("restore tests and bad points", () => {
  it("draw bit rot from the seed", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily" }));
    step(s, nextAt(s, 2));
    const w = mine(s, src), p = pointsOf(w)[0];
    expect(p.bad).toBe(chance(hashRng(s.seed, idNum(w.id), p.at), BAD_POINT));
  });

  it("a bad point nobody tested comes back empty, a tested one is skipped for the point before", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily" }));
    step(s, nextAt(s, 2));
    step(s, nextAt(s, 2));
    const w = mine(s, src), [older, newer] = [...pointsOf(w)].sort((a, b) => a.at - b.at);
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, points: x.points!.map((p) => ({ ...p, bad: p === newer })) } : x));
    // The test takes the restore time and leaves the workload running.
    ok(testRestore(s, w.id, newer.at));
    expect(testRestore(s, w.id, newer.at)).toMatchObject({ ok: false, error: "error.testBusy" });
    expect(pointsOf(mine(s, src))[1].verified).toBe(false);
    step(s, s.hour + 5);
    const tested = pointsOf(mine(s, src)).find((p) => p.at === newer.at)!;
    expect(tested).toMatchObject({ verified: true, bad: true });
    expect(mine(s, src).backupAt).toBe(older.at);
    lose(s, w.deviceId!);
    expect(lostDisk(s, mine(s, src))).toBe(true);
    ok(restoreWorkload(s, w.id));
    expect(mine(s, src).busyUntil).toBeGreaterThan(s.hour - 1);
  });

  it("restoring an untested bad point wastes the hours and then shows it as bad", () => {
    const { s, src, target, cus } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily" }));
    step(s, nextAt(s, 2));
    const w = mine(s, src);
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, points: x.points!.map((p) => ({ ...p, bad: true })) } : x));
    const before = s.customers.find((c) => c.id === cus)!.happiness, hours = restoreHours(s, mine(s, src));
    lose(s, w.deviceId!);
    ok(restoreWorkload(s, w.id));
    expect(mine(s, src).busyUntil).toBe(s.hour + hours);
    expect(pointsOf(mine(s, src))[0].verified).toBe(true);
    expect(mine(s, src).backupAt).toBeNull();
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBeLessThan(before);
  });
});

describe("offsite copy", () => {
  it("copies the newest point on Sunday three hours after the job, over the internet", () => {
    const { s, src, target, far } = setup();
    expect(saveJob(s, src, { targetId: target, every: "daily", offsiteId: target })).toMatchObject({ ok: false });
    ok(saveJob(s, src, { targetId: target, every: "daily", offsiteId: far }));
    step(s, nextAt(s, 2, 0));
    expect(pointsOf(mine(s, src)).some((p) => p.offsite)).toBe(false);
    step(s, nextAt(s, 5, 0));
    const w = mine(s, src), copy = pointsOf(w).find((p) => p.offsite)!;
    expect(copy).toBeTruthy();
    expect(copy.readyAt).toBe(s.hour + Math.ceil(copy.gb / WAN_GB_PER_HOUR));
    // The offsite repository is charged for the copy.
    const lines = pointsOf(w).filter((p) => p.offsite).reduce((n, p) => n + p.gb, 0);
    expect(lines).toBeGreaterThan(0);
  });

  it("keeps a backup alive when the primary repository is gone", () => {
    const { s, src, target, far } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily", offsiteId: far }));
    step(s, nextAt(s, 5, 0));
    const w = mine(s, src);
    expect(hasBackupElsewhere(s, w.id)).toBe(true);
    s.clusters = s.clusters.map((c) => (c.id === target ? { ...c, nodes: [], vm: null } : c));
    expect(holdsCopy(s, mine(s, src))).toBe(true);
    s.clusters = s.clusters.map((c) => (c.id === far ? { ...c, nodes: [], vm: null } : c));
    expect(hasBackupElsewhere(s, w.id)).toBe(false);
  });
});

describe("failed job alerts", () => {
  it("fire once a day and only when the job notifies", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily", hour: 2 }));
    s.clusters = s.clusters.map((c) => (c.id === target ? { ...c, switching: { kind: "backup", to: "backula", doneAt: s.hour + 1000 } as never } : c));
    const events: { key: string }[] = [];
    const first = nextAt(s, 2);
    step(s, first, events);
    expect(events.filter((e) => e.key === "event.backupFailed")).toHaveLength(1);
    s.hour = first + 1;
    const again = s.clusters.find((c) => c.id === src)!.jobs[0];
    step(s, first + 24 + 1, events);
    expect(events.filter((e) => e.key === "event.backupFailed")).toHaveLength(2);
    expect(again.lastOk).not.toBe(true);
    s.clusters = s.clusters.map((c) => (c.id === src ? { ...c, jobs: c.jobs.map((j) => ({ ...j, notify: false })) } : c));
    step(s, first + 48 + 1, events);
    expect(events.filter((e) => e.key === "event.backupFailed")).toHaveLength(2);
  });
});
