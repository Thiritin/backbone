import { describe, expect, it } from "vitest";
import { vmById } from "../src/sim/60-infra/cluster";
import { projectsOf, projectUsage } from "../src/sim/60-infra/projects";
import { createVm, resizeVm } from "../src/sim/90-actions/clusters";
import { allocateFloatingIp, createVolume } from "../src/sim/90-actions/horizont";
import { deleteProject, saveProject, setInstanceProject } from "../src/sim/90-actions/projects";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, ok, pmx, SMALL } from "./pmx";

const NONE = { instances: null, vcpu: null, ramGb: null, volumeGb: null, floatingIps: null };

function cloud() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openstash" } : c));
  const cl = () => x.s.clusters.find((c) => c.id === x.c)!;
  return { ...x, cl, project: (quota = {}) => ok(saveProject(x.s, x.c, { name: "tenant", quota: { ...NONE, ...quota } })) };
}

describe("horizont projects", () => {
  it("starts with an unlimited admin project that holds every instance", () => {
    const x = cloud();
    expect(projectsOf(x.cl()).map((p) => p.id)).toEqual(["admin"]);
    ok(createVm(x.s, x.c, { vcpu: 4, ramGb: 8, diskGb: 20 }));
    expect(projectUsage(x.s, x.cl(), "admin").instances).toBe(1);
  });

  it("refuses create beyond the instance and RAM quota", () => {
    const x = cloud(), p = x.project({ instances: 1, ramGb: 2 });
    const vm = ok(createVm(x.s, x.c, SMALL, null, p));
    expect(vmById(x.s, vm)!.projectId).toBe(p);
    expect(err(createVm(x.s, x.c, SMALL, null, p))).toBe("error.quotaExceeded");
    expect(err(createVm(x.s, x.c, SMALL, null, "nope"))).toBe("error.unknownProject");
    ok(createVm(x.s, x.c, { vcpu: 8, ramGb: 8, diskGb: 20 }));
  });

  it("refuses a resize that outgrows the quota and allows one inside it", () => {
    const x = cloud(), p = x.project({ vcpu: 2, ramGb: 4 });
    const vm = ok(createVm(x.s, x.c, SMALL, null, p));
    expect(err(resizeVm(x.s, vm, { vcpu: 3, ramGb: 1, diskGb: 20 }))).toBe("error.quotaExceeded");
    ok(resizeVm(x.s, vm, { vcpu: 2, ramGb: 4, diskGb: 20 }));
  });

  it("counts volumes and floating IPs against the project", () => {
    const x = cloud(), p = x.project({ volumeGb: 60, floatingIps: 0 });
    ok(createVolume(x.s, x.c, "a", 50, p));
    expect(err(createVolume(x.s, x.c, "b", 20, p))).toBe("error.quotaExceeded");
    expect(err(allocateFloatingIp(x.s, x.c, p))).toBe("error.quotaExceeded");
  });

  it("moves an instance only into a project with room, and deletes only an empty project", () => {
    const x = cloud(), p = x.project({ instances: 0 });
    const vm = ok(createVm(x.s, x.c, SMALL));
    expect(err(setInstanceProject(x.s, vm, p))).toBe("error.quotaExceeded");
    ok(saveProject(x.s, x.c, { id: p, name: "tenant", quota: { ...NONE, instances: 1 } }));
    ok(setInstanceProject(x.s, vm, p));
    expect(err(deleteProject(x.s, x.c, p))).toBe("error.projectInUse");
    expect(err(deleteProject(x.s, x.c, "admin"))).toBe("error.adminProject");
    ok(setInstanceProject(x.s, vm, "admin"));
    ok(deleteProject(x.s, x.c, p));
  });

  it("ties a project to an existing customer", () => {
    const x = cloud();
    expect(err(saveProject(x.s, x.c, { name: "t", customerId: "cu1", quota: NONE }))).toBe("error.unknownCustomer");
    x.s.customers.push({ id: "cu1" } as never);
    const p = ok(saveProject(x.s, x.c, { name: "t", customerId: "cu1", quota: NONE }));
    expect(projectsOf(x.cl()).find((q) => q.id === p)!.customerId).toBe("cu1");
  });

  it("an old save loads with the admin project only", () => {
    const x = cloud();
    ok(createVm(x.s, x.c, SMALL));
    const raw = JSON.parse(serialize(x.s));
    for (const c of raw.clusters) delete c.projects;
    for (const w of raw.workloads) delete w.projectId;
    const back = deserialize(JSON.stringify(raw))!;
    expect(projectsOf(back.clusters.find((c) => c.id === x.c)!).map((p) => p.id)).toEqual(["admin"]);
  });
});
