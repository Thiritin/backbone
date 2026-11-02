import { describe, expect, it } from "vitest";
import { dateOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { newGame } from "../src/sim/50-state";
import { finishedJobs, holdsCopy, pointsOf, runBackups } from "../src/sim/60-infra/backups";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { saveJob } from "../src/sim/90-actions/backups";
import { dropCluster } from "../src/sim/60-infra/cluster";
import { connect } from "../src/sim/90-actions/hardware";
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
const step = (s: GameState, to: number) => {
  for (s.hour++; s.hour <= to; s.hour++) runBackups(s, []);
  s.hour = to;
};
function server(s: GameState, slot: number, port: number) {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", slot));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
  return id;
}
function setup() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = server(s, 2, 1), third = server(s, 3, 2), fourth = server(s, 4, 3);
  const src = hypervisor(s, ["dev3", second], "Cloud 1");
  const target = named(s, panelServer(s, third, "backula"), "Backup 1"), far = named(s, panelServer(s, fourth, "backula"), "Backup 2");
  s.clusters = s.clusters.map((c) => (c.id === far ? { ...c, az: "other-az" } : c));
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  ok(provisionService(s, cus, "vps", { label: "Box", clusterId: src }));
  return { s, src, target, far };
}
const vm = (s: GameState, id: string) => s.workloads.find((w) => w.serviceId && w.clusterId === id)!;

describe("removing an offsite repository", () => {
  it("drops its copies and the job's link to it", () => {
    const { s, src, target, far } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily", offsiteId: far }));
    step(s, nextAt(s, 5, 0));
    expect(pointsOf(vm(s, src)).some((p) => p.offsite)).toBe(true);
    dropCluster(s, far);
    expect(pointsOf(vm(s, src)).some((p) => p.offsite)).toBe(false);
    expect(s.clusters.find((c) => c.id === src)!.jobs[0].offsiteId).toBeNull();
    s.clusters = s.clusters.map((c) => (c.id === target ? { ...c, nodes: [], vm: null } : c));
    expect(holdsCopy(s, vm(s, src))).toBe(false);
  });
});

describe("saves with older job shapes", () => {
  it("fill missing job fields and drop copies to a repository that is gone", () => {
    const { s, src, target } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily" }));
    step(s, nextAt(s, 2));
    const old = JSON.parse(serialize(s));
    for (const c of old.clusters) for (const j of c.jobs) { delete j.keep; delete j.notify; j.offsiteId = "gone"; }
    for (const w of old.workloads) for (const p of [...(w.points ?? [])]) { delete p.offsite; w.points.push({ ...p, offsite: true }); }
    const back = deserialize(JSON.stringify(old))!;
    const job = back.clusters.find((c) => c.id === src)!.jobs[0];
    expect(job.keep.last).toBeGreaterThan(0);
    expect(job.offsiteId).toBeNull();
    expect(pointsOf(vm(back, src)).every((p) => p.offsite === false)).toBe(true);
    step(back, nextAt(back, 2));
    expect(() => step(back, nextAt(back, 2))).not.toThrow();
  });
});

describe("Backula host CLI", () => {
  it("lists only the jobs that write to this repository, with their own result", () => {
    const { s, src, target, far } = setup();
    ok(saveJob(s, src, { targetId: target, every: "daily", name: "Near" }));
    ok(saveJob(s, src, { targetId: far, every: "daily", name: "Far" }));
    step(s, nextAt(s, 2));
    expect(finishedJobs(s, target).map((j) => j.name)).toEqual(["Cloud 1 Near"]);
    s.clusters = s.clusters.map((c) => (c.id === src ? { ...c, jobs: c.jobs.map((j) => ({ ...j, lastOk: false })) } : c));
    expect(finishedJobs(s, far)[0].ok).toBe(false);
  });
});
