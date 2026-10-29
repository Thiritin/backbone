import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { IN_VM, softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterOf, controlPlaneUse, vmById, vmRoom } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { addNode, createVm, deleteVm, provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { buyDevice, connect } from "../src/sim/90-actions/hardware";
import { installSoftware, softwareOn, uninstallSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, readyGame, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: R) => r.error;
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
const VM = { vcpu: 2, ramGb: 4, diskGb: 50 };

// The basement server and a second one cabled to the switch, both with nothing installed.
function twoServers() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  skipTo(s, 2010);
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  return { s, second };
}

describe("software on machines", () => {
  it("installs a hypervisor on a server after its install hours", () => {
    const { s } = twoServers();
    const hours = softwareById("proxmocks").installHours;
    const c = ok(installSoftware(s, "dev3", "proxmocks"));
    expect(softwareOn(s, "dev3")).toMatchObject([{ id: "proxmocks", doneAt: s.hour + hours }]);
    run(s, hours);
    expect(softwareOn(s, "dev3")).toMatchObject([{ id: "proxmocks", doneAt: null }]);
    expect(clusterOf(s, "dev3")).toMatchObject({ id: c, platform: "proxmocks", nodes: [{ deviceId: "dev3" }] });
  });

  it("runs one hypervisor per machine, a panel next to one only in a VM, and no hypervisor in a VM", () => {
    const { s } = twoServers();
    const c = hypervisor(s, ["dev3"]);
    expect(err(installSoftware(s, "dev3", "hypervee"))).toBe("error.oneHypervisor");
    expect(err(installSoftware(s, "dev3", "freepanel"))).toBe("error.panelInVm");
    const vm = ok(createVm(s, c, VM));
    expect(err(installSoftware(s, vm, "proxmocks"))).toBe("error.nestedHypervisor");
    ok(installSoftware(s, vm, "freepanel"));
    expect(err(installSoftware(s, vm, "cpanic"))).toBe("error.onePanel");
  });

  it("clusters servers that run the same hypervisor and refuses one with another", () => {
    const { s, second } = twoServers();
    const c = hypervisor(s, ["dev3"]);
    expect(err(addNode(s, c, second))).toBe("error.noHypervisor");
    hypervisor(s, [second], undefined, "hypervee");
    expect(err(addNode(s, c, second))).toBe("error.otherHypervisor");
    ok(uninstallSoftware(s, second));
    expect(clusterOf(s, second)).toBeUndefined();
    const own = hypervisor(s, [second]);
    ok(addNode(s, c, second));
    expect(s.clusters.some((x) => x.id === own)).toBe(false);
    expect(clusterOf(s, second)?.id).toBe(c);
    expect(softwareOn(s, second)).toMatchObject([{ id: "proxmocks" }]);
  });

  it("books a custom VM, installs a panel in it that sells web hosting, and deletes the VM once empty", () => {
    const { s } = twoServers();
    const vm = ok(createVm(s, hypervisor(s, ["dev3"]), VM));
    expect(softwareOn(s, vm)).toEqual([]);
    run(s, 24);
    expect(vmById(s, vm)).toBeDefined();
    const host = ok(installSoftware(s, vm, "cpanic"));
    run(s, softwareById("cpanic").installHours);
    expect(softwareOn(s, vm)).toMatchObject([{ id: "cpanic", doneAt: null }]);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const web = ok(provisionService(s, cus, "webHosting", { label: "ada.example", spec: sizeSpec("webHosting", 0, yearOf(s.hour)) }));
    expect(s.workloads.find((w) => w.serviceId === web)?.clusterId).toBe(host);
    expect(err(uninstallSoftware(s, vm))).toBe("error.softwareInUse");
    expect(err(deleteVm(s, vm))).toBe("error.softwareInUse");
    expect(err(uninstallSoftware(s, "dev3"))).toBe("error.softwareInUse");
    s.workloads = s.workloads.filter((w) => w.clusterId !== host);
    ok(uninstallSoftware(s, vm));
    ok(deleteVm(s, vm));
    ok(uninstallSoftware(s, "dev3"));
    expect(s.clusters).toEqual([]);
  });

  it("gives software in a VM five percent less CPU and RAM than the same booking on bare metal", () => {
    const s = readyGame(1), host = s.clusters.find((c) => c.vm)!, vm = vmById(s, host.vm)!, cp = controlPlaneUse(host);
    const { cap } = vmRoom(s, host);
    expect(IN_VM).toBe(0.95);
    expect(cap.vcpu).toBeCloseTo(vm.vcpu * 0.95 - cp.vcpu, 9);
    expect(cap.ramGb).toBeCloseTo(vm.ramGb * 0.95 - cp.ramGb, 9);
    expect(cap.diskGb).toBeCloseTo(vm.diskGb - cp.diskGb, 9);
  });

  it("books CPU and RAM past the hardware on Proxmocks and not past OpenStash's caps", () => {
    const book = (platform: string, size: typeof VM) => { const { s } = twoServers(); return createVm(s, hypervisor(s, ["dev3"], undefined, platform), size); };
    // The basement server has 2 cores and 8 GB.
    const ram = { vcpu: 1, ramGb: 7, diskGb: 10 }, cpu = { vcpu: 10, ramGb: 1, diskGb: 10 };
    expect(err(book("openstash", ram))).toBe("error.noCapacity");
    expect(err(book("openstash", cpu))).toBe("error.noCapacity");
    ok(book("proxmocks", ram));
    ok(book("proxmocks", cpu));
    expect(softwareById("openstash").overcommit).toEqual({ cpu: 4, ram: 1 });
  });

  it("loads a save with the software on its machines and drops a cluster with nothing installed", () => {
    const { s, second } = twoServers();
    const c = hypervisor(s, ["dev3"]), vm = ok(createVm(s, c, VM));
    ok(installSoftware(s, vm, "freepanel"));
    s.clusters = [...s.clusters, { ...s.clusters[0], id: "clu999", name: "Empty", nodes: [{ deviceId: second, state: "active" }], controlPlane: second, platform: null, switching: null }];
    const back = deserialize(serialize(s));
    expect(softwareOn(back, "dev3")).toMatchObject([{ id: "proxmocks" }]);
    expect(softwareOn(back, vm)).toMatchObject([{ id: "freepanel" }]);
    expect(clusterOf(back, second)).toBeUndefined();
    ok(installSoftware(back, second, "proxmocks"));
  });
});
