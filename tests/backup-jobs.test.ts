import { describe, expect, it } from "vitest";
import { dateOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { backupFlows } from "../src/sim/60-infra/usage";
import { newJob, pointsOf, repoUsed, runBackups } from "../src/sim/60-infra/backups";
import { backupPool, restoreHours } from "../src/sim/85-products/products";
import { setBackup } from "../src/sim/90-actions/clusters";
import { deleteJob, pruneNow, runJobNow, saveJob } from "../src/sim/90-actions/backups";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { connect } from "../src/sim/90-actions/hardware";
import { buyDevice, named, panelServer, readyGame } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; error?: string; id?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const hourAt = (s: GameState, hod: number, dow?: number) => {
  let h = s.hour;
  while (dateOf(h).getUTCHours() !== hod || (dow !== undefined && dateOf(h).getUTCDay() !== dow)) h++;
  return h;
};

function setup() {
  const s = readyGame(7);
  s.cash = 100_000;
  const third = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, third, "rack2", 3));
  ok(connect(s, { device: third, port: 0 }, { device: "dev4", port: 2 }));
  const target = named(s, panelServer(s, third, "backula"), "Backup 1");
  const src = s.clusters[0];
  return { s, src, target };
}
const mine = (s: GameState, id: string) => s.workloads.filter((w) => w.clusterId === id && !w.template);

describe("backup jobs", () => {
  it("run at their hour, weekly ones only on Sunday", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src.id, { targetId: target, every: "daily", hour: 2 }));
    ok(saveJob(s, src.id, { targetId: target, every: "weekly", hour: 5, name: "Weekly" }));
    s.hour = hourAt(s, 2, 3);
    runBackups(s, []);
    const w = mine(s, src.id)[0];
    expect(pointsOf(w).map((p) => p.at)).toEqual([s.hour]);
    expect(w.backupAt).toBe(s.hour);
    s.hour = hourAt(s, 3);
    runBackups(s, []);
    expect(pointsOf(mine(s, src.id)[0])).toHaveLength(1);
    s.hour = hourAt(s, 5, 2);
    runBackups(s, []);
    expect(pointsOf(mine(s, src.id)[0])).toHaveLength(1);
    s.hour = hourAt(s, 5, 0);
    runBackups(s, []);
    expect(pointsOf(mine(s, src.id)[0])).toHaveLength(2);
  });

  it("keep the newest points and the base, and the repository holds their sum", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src.id, { targetId: target, every: "daily", keep: { last: 3 } }));
    for (let i = 0; i < 6; i++) { s.hour = hourAt(s, 2); runBackups(s, []); s.hour++; }
    const w = mine(s, src.id)[0], pts = pointsOf(w);
    expect(pts).toHaveLength(3);
    const full = pts[0].gb;
    expect(pts[1].gb).toBeCloseTo(pts[2].gb);
    expect(full).toBeGreaterThan(pts[1].gb * 5);
    expect(repoUsed(s, target)).toBeCloseTo(mine(s, src.id).reduce((n, x) => n + pointsOf(x).reduce((m, p) => m + p.gb, 0), 0));
    expect(backupPool(s, target).need).toBeCloseTo(repoUsed(s, target));
    const id = s.clusters.find((c) => c.id === src.id)!.jobs[0].id;
    ok(saveJob(s, src.id, { id, keep: { last: 1 } }));
    expect(pointsOf(mine(s, src.id)[0])).toHaveLength(1);
    ok(pruneNow(s, src.id, id));
  });

  it("fail with a full repository and with an unreachable target", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src.id, { targetId: target, every: "daily" }));
    const w = mine(s, src.id)[0];
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, points: [{ at: 0, gb: 1e9, jobId: "old", verified: false, bad: false, offsite: false }] } : x));
    s.clusters = s.clusters.map((c) => (c.id === src.id ? { ...c, jobs: [...c.jobs, { ...newJob("old", target), name: "Old" }] } : c));
    const events: { key: string }[] = [];
    s.hour = hourAt(s, 2);
    runBackups(s, events as never);
    const job = s.clusters.find((c) => c.id === src.id)!.jobs[0];
    expect(job).toMatchObject({ lastOk: false, lastReason: "full" });
    expect(events.map((e) => e.key)).toContain("event.backupFailed");
    ok(runJobNow(s, src.id, job.id));
    expect(s.clusters.find((c) => c.id === src.id)!.jobs[0].lastOk).toBe(false);
  });

  it("load from an old save with one schedule as one job and one point", () => {
    const { s, src, target } = setup();
    const w = mine(s, src.id)[0];
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, backupAt: s.hour - 5 } : x));
    const old = JSON.parse(serialize(s));
    for (const c of old.clusters) c.backup = c.id === src.id ? { targetId: target, every: "daily" } : { targetId: null, every: "off" };
    for (const c of old.clusters) delete c.jobs;
    const loaded = deserialize(JSON.stringify(old));
    const c = loaded.clusters.find((x) => x.id === src.id)!;
    expect(c.jobs).toHaveLength(1);
    expect(c.jobs[0]).toMatchObject({ targetId: target, every: "daily", keep: { last: 3, weekly: 0 } });
    expect(loaded.clusters.every((x) => !("backup" in x))).toBe(true);
    const lw = loaded.workloads.find((x) => x.id === w.id)!;
    expect(pointsOf(lw)).toHaveLength(1);
    expect(lw.backupAt).toBe(s.hour - 5);
    expect(restoreHours(loaded, lw)).toBeGreaterThanOrEqual(1);
  });

  it("setBackup edits the first job and off removes it with its points", () => {
    const { s, src, target } = setup();
    ok(setBackup(s, src.id, target, "weekly"));
    expect(s.clusters.find((c) => c.id === src.id)!.jobs).toHaveLength(1);
    s.hour = hourAt(s, 2, 0);
    runBackups(s, []);
    expect(mine(s, src.id)[0].backupAt).toBe(s.hour);
    expect(backupFlows(s, s.hour).length).toBeGreaterThan(0);
    ok(setBackup(s, src.id, target, "daily"));
    expect(s.clusters.find((c) => c.id === src.id)!.jobs[0].every).toBe("daily");
    expect(pointsOf(mine(s, src.id)[0])).toHaveLength(1);
    ok(setBackup(s, src.id, null, "off"));
    expect(s.clusters.find((c) => c.id === src.id)!.jobs).toHaveLength(0);
    expect(mine(s, src.id)[0].backupAt).toBeNull();
  });

  it("limit jobs per cluster and delete a job with its points", () => {
    const { s, src, target } = setup();
    for (let i = 0; i < 4; i++) ok(saveJob(s, src.id, { targetId: target, every: "daily" }));
    expect(saveJob(s, src.id, { targetId: target, every: "daily" })).toMatchObject({ ok: false, error: "error.jobLimit" });
    const id = s.clusters.find((c) => c.id === src.id)!.jobs[0].id;
    ok(runJobNow(s, src.id, id));
    ok(deleteJob(s, src.id, id));
    expect(mine(s, src.id).every((w) => pointsOf(w).length === 0)).toBe(true);
  });
});
