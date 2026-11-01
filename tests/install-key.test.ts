import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { assignedKey, issueKey, licenceStatus, panelMachine, releaseKey, unassignedKeys } from "../src/sim/60-infra/licence";
import { tick } from "../src/sim/88-tick/tick";
import { createPanelVm, deleteVm, provisionService, setBackup } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { activateLicence } from "../src/sim/90-actions/licence";
import { buyDevice, hypervisor, panelServer, readyGame, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }): string => { expect(r).toMatchObject({ ok: true }); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

function server(s: GameState, slot: number, port: number) {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", slot));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
  return id;
}

describe("ended licences", () => {
  it("refuse new VMs on a hypervisor and stop backups to Veeham until a key is entered", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    skipTo(s, 2010);
    const second = server(s, 2, 1), cloud = hypervisor(s, ["dev3"], "Cloud 1", "vmwhere"), backup = panelServer(s, second, "veeham");
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const hv = assignedKey(s, "dev3", "vmwhere")!, vb = assignedKey(s, second, "veeham")!;
    releaseKey(s, hv.id);
    expect(licenceStatus(s, "dev3", "vmwhere")).toBe("ended");
    expect(err(provisionService(s, cus, "vps", { label: "Box", clusterId: cloud }))).toBe("error.licenceExpired");
    ok(activateLicence(s, "dev3", "vmwhere", hv.key));
    const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cloud }));
    ok(setBackup(s, cloud, backup, "daily"));
    releaseKey(s, vb.id);
    run(s, 24);
    expect(workloadsOf(s, vps)[0].backupAt).toBeNull();
    ok(activateLicence(s, second, "veeham", vb.key));
    run(s, 24);
    expect(workloadsOf(s, vps)[0].backupAt).not.toBeNull();
  });
});

describe("released keys", () => {
  it("go back to My account when their VM is deleted", () => {
    const s = readyGame(1), cloud = s.clusters.find((c) => c.kind === "cloud")!.id, k = issueKey(s, "directadmen", "standard");
    const host = ok(createPanelVm(s, cloud, "directadmen")), vm = panelMachine(s.clusters.find((c) => c.id === host)!)!;
    expect(assignedKey(s, vm, "directadmen")?.id).toBe(k.id);
    ok(deleteVm(s, vm));
    expect(unassignedKeys(s, "directadmen").map((x) => x.id)).toEqual([k.id]);
  });
});
