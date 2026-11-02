import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { runJob } from "../src/sim/60-infra/backups";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { workloadUse } from "../src/sim/60-infra/usage";
import { RESTORE_MINUTES_PER_GB } from "../src/sim/60-infra/webpanel";
import { tick } from "../src/sim/88-tick/tick";
import { restoreSite, saveJob } from "../src/sim/90-actions/backups";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, named, panelServer, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// A Pleskit host with two sites on release 2014, a backup server in the zone and one daily point.
function world() {
  const s = { ...withServer(newGame(3)), cash: 100_000 };
  const host = panelServer(s, "dev3", "pleskit");
  const box = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, box, "rack2", 2));
  ok(connect(s, { device: box, port: 0 }, { device: "dev4", port: 1 }));
  const store = named(s, panelServer(s, box, "backula"), "Backup 1");
  s.hour = hourOf(new Date(Date.UTC(2018, 0, 1)));
  const [a, b] = [0, 1].map((i) => ok(provisionService(s, addCustomer(s, `Customer ${i}`, "hobbyDev"), "webHosting", {
    label: `site${i}.de`, spec: { ...sizeSpec("webHosting", 0, 2005), app: "wordpass", appVersion: 2014, appUpdatedAt: hourOf(new Date(Date.UTC(2014, 0, 1))) }, clusterId: host,
  })));
  s.workloads = s.workloads.map((w) => (w.serviceId === a ? { ...w, diskGb: 100 } : w));
  ok(saveJob(s, host, { targetId: store, every: "daily" }));
  const c = s.clusters.find((x) => x.id === host)!;
  runJob(s, c, c.jobs[0], []);
  const at = s.hour;
  s.hour += 1;
  return { s, host, box, a, b, at };
}
const site = (s: ReturnType<typeof world>["s"], id: string) => s.workloads.find((w) => w.serviceId === id)!;

describe("restoring a site from a backup point", () => {
  it("runs three minutes per GB of disk use with the site down, then leaves it healthy on the point's release", () => {
    const { s, host, a, at } = world();
    expect(site(s, a).points?.[0].appVersion).toBe(2014);
    s.services = s.services.map((v) => (v.id === a ? { ...v, spec: { ...v.spec, appVersion: 2018 } } : v));
    s.webpanel = { ...s.webpanel, appBroken: { [a]: s.hour + 99 }, appBack: { [a]: { appVersion: 2014, appUpdatedAt: 0 } }, phpBroken: { [a]: "7.0" } };
    const gb = workloadUse(s, site(s, a)).diskGb, from = s.hour;
    ok(restoreSite(s, host, a, at));
    const until = from + Math.ceil((gb * RESTORE_MINUTES_PER_GB) / 60);
    expect(until - from).toBeGreaterThan(1);
    expect(s.webpanel.restoring[a]).toEqual({ from, until });
    expect(workloadOnline(s, site(s, a))).toBe(false);
    while (s.hour < until) {
      expect(s.webpanel.restoring[a]).toBeDefined();
      tick(s);
    }
    expect(s.webpanel.restoring[a]).toBeUndefined();
    expect(s.webpanel.appBroken[a] ?? s.webpanel.appBack[a] ?? s.webpanel.phpBroken[a]).toBeUndefined();
    expect(s.services.find((v) => v.id === a)!.spec.appVersion).toBe(2014);
    expect(workloadOnline(s, site(s, a))).toBe(true);
  });

  it("clears the host's hacked flag only when the restored site is its only one", () => {
    const { s, host, a, b, at } = world();
    s.security = { ...s.security, hacked: [host] };
    ok(restoreSite(s, host, b, at));
    while (s.webpanel.restoring[b]) tick(s);
    expect(s.security.hacked).toEqual([host]);
    s.workloads = s.workloads.filter((w) => w.serviceId !== b);
    ok(restoreSite(s, host, a, at));
    while (s.webpanel.restoring[a]) tick(s);
    expect(s.security.hacked).toEqual([]);
  });

  it("is refused while the backup server is halted, without a point, or while another restore runs on the host", () => {
    const { s, host, box, a, b, at } = world();
    expect(restoreSite(s, host, a, at + 5)).toEqual({ ok: false, error: "error.noPoint" });
    s.devices = s.devices.map((d) => (d.id === box ? { ...d, on: false } : d));
    expect(restoreSite(s, host, a, at)).toEqual({ ok: false, error: "error.backupStoreOffline" });
    s.devices = s.devices.map((d) => (d.id === box ? { ...d, on: true } : d));
    ok(restoreSite(s, host, a, at));
    expect(restoreSite(s, host, b, at)).toEqual({ ok: false, error: "error.restoring" });
    expect(s.webpanel.restoring[b]).toBeUndefined();
  });

  it("loads an old save without restores", () => {
    const raw = JSON.parse(serialize(newGame(1)));
    delete raw.webpanel.restoring;
    expect(deserialize(JSON.stringify(raw)).webpanel.restoring).toEqual({});
  });
});
