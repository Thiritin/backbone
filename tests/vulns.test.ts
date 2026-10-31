import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { updateBreaks } from "../src/sim/60-infra/channel";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { visibleCandidates, type Task } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { MONITORING, securityTick } from "../src/sim/60-infra/security";
import {
  DAILY_RISK, PATCH_DAYS, VULN_RATE, affects, dailyRisk, exposureDays, instanceRisk, monitoring, openVulns, urgentSoftware, vulnsFor, type Severity,
} from "../src/sim/60-infra/vulns";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice, bootedMachine } from "./fixtures";
import { cleanUp } from "../src/sim/90-actions/security";
import { installSoftware, updateSoftware } from "../src/sim/90-actions/software";
import { hire, queueOperation, setTechRules } from "../src/sim/90-actions/staff";
import { install, research } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, panelServer, withCompany, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));

// The first vulnerability of the severity in a family's releases after the start.
function find(family: string, severity: Severity, seed = 1) {
  for (let y = 2006; y < 2060; y++) {
    const v = vulnsFor(family, y, seed).find((x) => x.severity === severity);
    if (v) return v;
  }
  throw new Error("none");
}

// The basement's second server, cabled in.
function second(s: GameState): string {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 2));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 1 }));
  return id;
}
const start = () => ({ ...withServer(newGame(1)), cash: 100_000 });
// A bare-metal panel host with one web space.
function host(s: GameState, device = "dev3", label = "ada.de") {
  const id = panelServer(s, device), cus = addCustomer(s, "Ada Lang", "hobbyDev");
  ok(provisionService(s, cus, "webHosting", { label, spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: id }));
  return id;
}
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const patch = (s: GameState, id: string, fields: Partial<GameState["clusters"][number]>) => { s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, ...fields } : c)); };

describe("generated vulnerabilities", () => {
  it("are the same for the same family, year and seed", () => {
    const a = vulnsFor("freepanel", 2012, 7);
    expect(vulnsFor("freepanel", 2012, 7)).toEqual(a);
    const years = Array.from({ length: 40 }, (_, i) => 2006 + i);
    expect(years.map((y) => vulnsFor("freepanel", y, 7).length)).not.toEqual(years.map((y) => vulnsFor("freepanel", y, 8).length));
    expect(years.map((y) => vulnsFor("freepanel", y, 7).length)).not.toEqual(years.map((y) => vulnsFor("cpanic", y, 7).length));
  });

  it("follow the count, severity, disclosure and patch rules", () => {
    const all = (family: string) => Array.from({ length: 400 }, (_, i) => vulnsFor(family, 2005 + i, 3)).flat();
    const panel = all("cpanic"), cloud = all("proxmocks");
    expect(panel.length / 400).toBeGreaterThan(VULN_RATE.panel * 0.9);
    expect(panel.length / 400).toBeLessThan(VULN_RATE.panel * 1.1);
    expect(cloud.length / 400).toBeGreaterThan(VULN_RATE.cloud * 0.85);
    expect(cloud.length / 400).toBeLessThan(VULN_RATE.cloud * 1.15);
    const share = (sev: Severity) => panel.filter((v) => v.severity === sev).length / panel.length;
    expect(share("low")).toBeGreaterThan(0.45);
    expect(share("low")).toBeLessThan(0.55);
    expect(share("high")).toBeGreaterThan(0.3);
    expect(share("high")).toBeLessThan(0.4);
    expect(share("critical")).toBeGreaterThan(0.1);
    expect(share("critical")).toBeLessThan(0.2);
    for (const v of panel.slice(0, 300)) {
      expect(yearOf(v.disclosedAt)).toBe(v.year);
      expect(v.patchedAt).toBeGreaterThanOrEqual(v.disclosedAt);
      expect(v.patchedAt - v.disclosedAt).toBeLessThanOrEqual(PATCH_DAYS[v.severity] * 24);
    }
    expect(panel.filter((v) => v.severity === "critical").every((v) => v.patchedAt - v.disclosedAt <= 72)).toBe(true);
  });

  it("raise the daily compromise risk at 30 and 90 days exposed", () => {
    const v = find("freepanel", "high");
    const s = start(), id = panelServer(s, "dev3");
    patch(s, id, { version: v.year, updatedAt: v.patchedAt - 1 });
    const risk = (days: number) => dailyRisk(openVulns(s, id, v.patchedAt + days * 24).find((x) => x.id === v.id)!);
    expect([0, 29, 30, 89, 90, 400].map(risk)).toEqual([1, 1, 2, 2, 4, 4].map((n) => n * DAILY_RISK.high));
    expect(exposureDays(cluster(s, id), v, v.patchedAt + 30 * 24 + 5)).toBe(30);
    expect(openVulns(s, id, v.patchedAt - 1).find((x) => x.id === v.id)).toBeUndefined();
    expect(instanceRisk([])).toBe(0);
  });

  it("compromise a panel host by chance until it is updated", () => {
    const s = start(), a = host(s, "dev3", "ada.de"), b = host(s, second(s), "lang.de");
    s.hour = year(2030);
    for (const id of [a, b]) patch(s, id, { version: 2005, updatedAt: 0, channel: "edge" });
    expect(openVulns(s, a).length).toBeGreaterThan(10);
    ok(updateSoftware(s, b));
    expect(openVulns(s, b)).toEqual([]);
    const events: SimEvent[] = [];
    for (let d = 0; d < 200 && !s.security.hacked.length; d++) { s.hour += 24; events.push(...securityTick(s)); }
    expect(s.security.hacked).toEqual([a]);
    expect(events.find((e) => e.key === "event.vuln.hacked")?.params).toMatchObject({ device: cluster(s, a).name, customers: 1, kind: "panel" });
    for (let d = 0; d < 200; d++) { s.hour += 24; securityTick(s); }
    expect(s.security.hacked).toEqual([a]);
  });

  it("compromise a hypervisor with the same effects and clean up the same way", () => {
    const s = start(), id = hypervisor(s, ["dev3"], "Web 1");
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    ok(provisionService(s, cus, "vps", { label: "box", spec: sizeSpec("vps", 0, 2005), clusterId: id }));
    s.hour = year(2030);
    patch(s, id, { version: 2005, updatedAt: 0, channel: "edge" });
    const events: SimEvent[] = [];
    for (let d = 0; d < 200 && !s.security.hacked.length; d++) { s.hour += 24; events.push(...securityTick(s)); }
    expect(s.security.hacked).toEqual([id]);
    expect(events.find((e) => e.key === "event.vuln.hacked")?.params).toMatchObject({ kind: "cloud", customers: 1 });
    const w = s.workloads.find((x) => x.serviceId)!;
    expect(workloadOnline(s, w)).toBe(false);
    expect(s.tickets.some((t) => t.kind === "abuse")).toBe(true);
    ok(cleanUp(s, id));
    expect(s.security.hacked).toEqual([]);
  });

  it("do not reach software without customers, except the mail host", () => {
    const s = start();
    s.hour = year(2030);
    const empty = panelServer(s, "dev3");
    patch(s, empty, { version: 2005, updatedAt: 0, channel: "edge" });
    for (let d = 0; d < 100; d++) { s.hour += 24; securityTick(s); }
    expect(s.security.hacked).toEqual([]);
  });
});

describe("updating software", () => {
  it("closes every vulnerability patched so far and lists the software worst first", () => {
    const s = start(), a = host(s, "dev3", "ada.de"), b = host(s, second(s), "lang.de");
    s.hour = year(2020);
    patch(s, a, { version: 2005, updatedAt: 0, channel: "edge" });
    patch(s, b, { version: 2020, updatedAt: s.hour });
    const rows = monitoring(s);
    expect(rows.map((r) => r.cluster.id)).toEqual([a, b]);
    expect(rows[0].worst).not.toBeNull();
    expect(rows[1].worst).toBeNull();
    ok(updateSoftware(s, a));
    expect(cluster(s, a)).toMatchObject({ version: 2020, updatedAt: s.hour });
    expect(openVulns(s, a)).toEqual([]);
    expect(err(updateSoftware(s, a))).toBe("error.upToDate");
    expect(err(updateSoftware(s, "nope"))).toBe("error.unknownCluster");
    // The next release's patches reach the updated software again.
    const next = find("freepanel", "critical");
    patch(s, a, { version: next.year, updatedAt: next.patchedAt - 1 });
    expect(affects(cluster(s, a), next)).toBe(true);
    expect(openVulns(s, a, next.patchedAt + 24).some((v) => v.id === next.id)).toBe(true);
  });

  it("takes the sites of a panel host down for 30 minutes", () => {
    const s = start(), a = host(s);
    s.hour = year(2010);
    patch(s, a, { version: 2009, updatedAt: 0, channel: "edge" });
    ok(updateSoftware(s, a));
    const w = s.workloads.find((x) => x.serviceId)!;
    expect(w.busyUntil).toBe(s.hour + 0.5);
    expect(s.downHours[w.serviceId]).toBe(0.5);
  });

  it("takes a hypervisor's virtual machines down for 2 hours unless it moves them live to a second node", () => {
    for (const [platform, nodes, down] of [["openveezee", 2, true], ["proxmocks", 1, true], ["proxmocks", 2, false]] as const) {
      const s = start();
      const id = hypervisor(s, nodes === 2 ? ["dev3", second(s)] : ["dev3"], "Web 1", platform);
      const cus = addCustomer(s, "Ada Lang", "hobbyDev");
      ok(provisionService(s, cus, "vps", { label: "box", spec: sizeSpec("vps", 0, 2005), clusterId: id }));
      patch(s, id, { version: 2004, channel: "edge" });
      while (updateBreaks(s, cluster(s, id))) s.hour++;
      const before = s.hour;
      ok(updateSoftware(s, id));
      const w = s.workloads.find((x) => x.serviceId)!;
      expect(w.busyUntil).toBe(down ? before + 2 : 0);
      expect(s.downHours[w.serviceId]).toBe(down ? 1 : undefined);
    }
  });

  it("takes the mail host through the same update without customers", () => {
    const s = withCompany(start());
    ok(installSoftware(s, bootedMachine(s, "dev3"), "postfixit"));
    s.clusters = s.clusters.map((c) => ({ ...c, switching: null, panel: "postfixit", version: 2004, channel: "edge" }));
    ok(updateSoftware(s, s.clusters[0].id));
    expect(s.clusters[0].version).toBe(2005);
  });
});

describe("urgent software", () => {
  it("lists high and critical instances, critical first, and drops an updated one", () => {
    const s = start(), a = host(s, "dev3", "ada.de"), b = host(s, second(s), "lang.de");
    // 2014 has a critical patch followed by a high one.
    s.hour = 87_000;
    patch(s, a, { version: 2014, updatedAt: 86_400 });
    patch(s, b, { version: 2014, updatedAt: 0 });
    expect(urgentSoftware(s).map((r) => [r.clusterId, r.worst])).toEqual([[b, "critical"], [a, "high"]]);
    expect(urgentSoftware(s)[0]).toMatchObject({ software: "FreePanel", host: cluster(s, b).name, days: 28 });
    ok(updateSoftware(s, b));
    expect(urgentSoftware(s).map((r) => r.clusterId)).toEqual([a]);
  });

  it("leaves out an instance with only a low vulnerability", () => {
    const s = start(), a = host(s);
    // 2019 has a single low vulnerability.
    s.hour = 129_384 + 24;
    patch(s, a, { version: 2019, updatedAt: 0 });
    expect(openVulns(s, a).map((v) => v.severity)).toEqual(["low"]);
    expect(urgentSoftware(s)).toEqual([]);
  });
});

describe("notices", () => {
  const setup = (family: string, severity: Severity) => {
    const v = find(family, severity), s = start(), id = host(s);
    patch(s, id, { version: v.year, updatedAt: v.patchedAt - 5 });
    s.hour = v.patchedAt - 1;
    return { s, id, v };
  };

  it("raise a banner for a low or high vulnerability only with monitoring installed", () => {
    for (const severity of ["low", "high"] as const) {
      const { s } = setup("freepanel", severity);
      expect(run(s, 1).some((e) => e.key === "event.vulnOpen")).toBe(false);
      const { s: owned } = setup("freepanel", severity);
      owned.installed = [...owned.installed, MONITORING];
      const events = run(owned, 1).filter((e) => e.key === "event.vulnOpen");
      expect(events).toHaveLength(1);
      expect(events[0].params).toMatchObject({ software: "FreePanel", severity });
    }
  });

  it("raise an alert for a critical vulnerability", () => {
    const { s } = setup("freepanel", "critical");
    const events = run(s, 1).filter((e) => e.key === "event.vulnCritical");
    expect(events).toHaveLength(1);
    expect(events[0].app).toBe("Security");
  });
});

describe("Nagiosaurus", () => {
  it("needs the monitoring skill", () => {
    const s = start();
    expect(storeItem(MONITORING)?.monthly).toBe(15);
    expect(err(install(s, MONITORING))).toBe("error.needsResearch");
    s.unlocks = [...s.unlocks, "monitoring"];
    const cash = s.cash;
    ok(install(s, MONITORING));
    expect(s.installed).toContain(MONITORING);
    expect(cash - s.cash).toBe(subscriptionPrice(storeItem(MONITORING)!, 2005));
    expect(err(research(s, "monitoring"))).toBe("error.researched");
  });
});

describe("technicians", () => {
  function technician(s: GameState, trained: Task[] = ["servers", "panels"]): void {
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const id = ok(hire(s, c.id));
    s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: [...trained] } : e));
  }
  // The first Monday 9:00 tick after the patch, one hour ahead.
  const monday = (at: number) => at + (((57 - at) % 168) + 168) % 168 - 1;

  it("update software with a high or critical vulnerability when the rule is on, and not otherwise", () => {
    const v = find("freepanel", "critical");
    for (const rule of [false, true]) {
      const s = start(), id = host(s);
      technician(s);
      ok(setTechRules(s, { updates: rule }));
      patch(s, id, { version: v.year, updatedAt: v.patchedAt - 5 });
      s.hour = monday(v.patchedAt + 24);
      const events = run(s, 3);
      expect(events.some((e) => e.key === "event.techUpdated")).toBe(rule);
      expect(cluster(s, id).updatedAt > v.patchedAt).toBe(rule);
      expect(openVulns(s, id).some((x) => x.id === v.id)).toBe(!rule);
    }
  });

  it("queue an update by hand and refuse one that is not due", () => {
    const s = start(), id = host(s);
    expect(err(queueOperation(s, "update", "dev3", id))).toBe("error.noTechnician");
    technician(s);
    expect(err(queueOperation(s, "update", "dev3", id))).toBe("error.upToDate");
    patch(s, id, { version: 2004, channel: "edge" });
    expect(err(queueOperation(s, "update", "dev4", id))).toBe("error.unknownCluster");
    ok(queueOperation(s, "update", "dev3", id));
    expect(err(queueOperation(s, "update", "dev3", id))).toBe("error.alreadyQueued");
  });
});

describe("old saves", () => {
  it("get the install year from an install in progress, and two years before the save otherwise", () => {
    const s = start(), a = host(s), id = second(s), b = ok(installSoftware(s, bootedMachine(s, id), "freepanel"));
    s.hour = year(2012) + 24 * 60;
    patch(s, b, { switching: { kind: "panel", to: "freepanel", doneAt: s.hour + 5 } });
    const data = JSON.parse(serialize(s));
    for (const c of data.clusters) { delete c.version; delete c.updatedAt; }
    const back = deserialize(JSON.stringify(data));
    expect(back.clusters.find((c) => c.id === a)).toMatchObject({ version: 2010, updatedAt: s.hour });
    expect(back.clusters.find((c) => c.id === b)).toMatchObject({ version: 2012, updatedAt: s.hour + 5 });
    expect(back.techRules.updates).toBe(false);
    expect(openVulns(back, a).every((v) => v.year >= 2011)).toBe(true);
  });

  it("stamp the install year on new installs", () => {
    const s = start();
    s.hour = year(2012);
    const id = ok(installSoftware(s, bootedMachine(s, "dev3"), "freepanel"));
    expect(cluster(s, id)).toMatchObject({ version: 2012, updatedAt: s.hour });
  });
});
