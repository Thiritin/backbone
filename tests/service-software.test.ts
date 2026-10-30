import { describe, expect, it } from "vitest";
import { kindServing, SERVES, softwareOf } from "../src/sim/10-catalog/platforms";
import { newGame } from "../src/sim/50-state";
import { noRoomError, supports } from "../src/sim/60-infra/cluster";
import { createVm, PANEL_VM_SIZE, provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { installBlock, installSoftware } from "../src/sim/90-actions/software";
import { hypervisor, panelVm, readyGame, skipTo, withServer, bootedMachine } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const idOf = (r: { ok: boolean; id?: string }) => (r.ok ? r.id! : "");
const cloudOf = (s: ReturnType<typeof readyGame>) => s.clusters.find((c) => c.kind === "cloud")!;

describe("service software", () => {
  it("gives DNS, VPN and storage their own software, three of each", () => {
    for (const kind of ["dns", "vpn", "storage"] as const) {
      expect(softwareOf(kind)).toHaveLength(3);
      expect(SERVES[kind]).toEqual([kind]);
      expect(kindServing(kind)).toBe(kind);
      expect(SERVES.cloud).not.toContain(kind);
    }
  });

  it("no longer sells DNS, VPN or storage on a hypervisor alone", () => {
    const s = readyGame(1), cloud = cloudOf(s);
    expect(supports(cloud, "dns")).toBe(false);
    expect(noRoomError(s, "dns")).toBe("error.needsDnsServer");
    expect(noRoomError(s, "vpn")).toBe("error.needsVpnServer");
    expect(noRoomError(s, "storage")).toBe("error.needsStorageServer");
    expect(err(provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "dns", { label: "dns.com" }))).toBe("error.needsDnsServer");
  });

  it("places DNS zones on a DNS server VM", () => {
    const s = readyGame(1), id = panelVm(s, cloudOf(s).id, "bound");
    const dns = s.clusters.find((c) => c.id === id)!;
    expect(dns).toMatchObject({ kind: "dns", name: "DNS 1", panel: "bound" });
    expect(supports(dns, "dns")).toBe(true);
    const r = provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "dns", { label: "dns.com" });
    expect(r.ok).toBe(true);
    expect(s.workloads.find((w) => w.serviceId === idOf(r))?.clusterId).toBe(id);
  });

  it("installs service software in a VM or on a free server, one per machine", () => {
    const s = readyGame(1), vm = bootedMachine(s, idOf(createVm(s, cloudOf(s).id, PANEL_VM_SIZE)));
    expect(installBlock(s, vm, "openveepeen")).toBeNull();
    expect(installBlock(s, vm, "minnio")).toBe("error.softwareNotYet");
    expect(installSoftware(s, vm, "openveepeen").ok).toBe(true);
    expect(installBlock(s, vm, "bound")).toBe("error.onePanel");

    const bare = withServer(newGame(2));
    expect(installSoftware(bare, bootedMachine(bare, "dev3"), "vsftpeed").ok).toBe(true);
    expect(bare.clusters[0]).toMatchObject({ kind: "storage", nodes: [{ deviceId: "dev3" }] });
    expect(installBlock(bare, "dev3", "vmwhere")).toBe("error.serverInUse");
  });

  it("opens newer software in its year", () => {
    const s = withServer(newGame(3));
    hypervisor(s, ["dev3"]);
    const vm = bootedMachine(s, idOf(createVm(s, s.clusters[0].id, PANEL_VM_SIZE)));
    expect(installBlock(s, vm, "wireguarded")).toBe("error.softwareNotYet");
    skipTo(s, 2018);
    expect(installBlock(s, vm, "wireguarded")).toBeNull();
  });
});
