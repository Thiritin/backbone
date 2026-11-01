import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { APP_SUITE_FEE } from "../src/sim/10-catalog/server-os";
import { type GameState } from "../src/sim/50-state";
import { hostOfVm, machineOf } from "../src/sim/60-infra/cluster";
import { machineScreen } from "../src/sim/60-infra/oob";
import { tick } from "../src/sim/88-tick/tick";
import { deleteVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { buyAppSuite, cancelAppSuite, deployFromSuite, SUITE_OS_HOURS } from "../src/sim/90-actions/suite";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, withServer, newGame } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => r.error;
const ok = (r: { ok: boolean; error?: string; id?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const monthEnd = (s: GameState) => {
  while (!isMonthStart(s.hour + 1)) s.hour++;
  tick(s);
};
const suiteLines = (s: GameState) => s.ledger.filter((l) => l.key === "ledger.appSuite");

describe("VMwhere App Suite", () => {
  it("is sold for VMwhere clusters only, once, and kept in the save", () => {
    const s = withServer(newGame(6)), c = hypervisor(s, ["dev3"], "Cloud 1", "vmwhere");
    expect(err(deployFromSuite(s, c, PANEL_VM_SIZE, "cpanic"))).toBe("error.noAppSuite");
    ok(buyAppSuite(s, c));
    expect(err(buyAppSuite(s, c))).toBe("error.hasAppSuite");
    expect(deserialize(serialize(s)).clusters.find((x) => x.id === c)?.appSuite).toBe(true);
    const other = withServer(newGame(6)), p = hypervisor(other, ["dev3"]);
    expect(err(buyAppSuite(other, p))).toBe("error.notVmwhere");
  });

  it("deploys a VM with the software's OS and the software in one step, done an hour after its install hours", () => {
    const s = withServer(newGame(6)), c = hypervisor(s, ["dev3"], "Cloud 1", "vmwhere");
    ok(buyAppSuite(s, c));
    const hours = softwareById("tcadmen").installHours + SUITE_OS_HOURS;
    const host = ok(deployFromSuite(s, c, PANEL_VM_SIZE, "tcadmen"));
    const vm = s.clusters.find((x) => x.id === host)!.vm!;
    expect(machineOf(s, vm)?.os).toMatchObject({ id: "windoors" });
    expect(hostOfVm(s, vm)?.switching).toMatchObject({ to: "tcadmen", doneAt: s.hour + hours });
    expect(machineScreen(s, vm)).toMatchObject({ kind: "installing", software: "tcadmen" });
    expect(err(deployFromSuite(s, c, PANEL_VM_SIZE, "openveezee"))).toBe("error.nestedHypervisor");
    for (let h = 0; h < hours - 1; h++) tick(s);
    expect(hostOfVm(s, vm)?.panel).toBeNull();
    tick(s);
    expect(hostOfVm(s, vm)?.panel).toBe("tcadmen");
    expect(machineScreen(s, vm)).toEqual({ kind: "login", os: "windoors" });
  });

  it("deletes a deployed VM together with its empty host, powered off or not", () => {
    const s = withServer(newGame(6)), c = hypervisor(s, ["dev3"], "Cloud 1", "vmwhere");
    ok(buyAppSuite(s, c));
    const host = ok(deployFromSuite(s, c, PANEL_VM_SIZE, "tcadmen")), vm = s.clusters.find((x) => x.id === host)!.vm!;
    ok(deleteVm(s, vm));
    expect(s.clusters.some((x) => x.id === host)).toBe(false);
    expect(s.workloads.some((w) => w.id === vm)).toBe(false);
  });

  it("is billed monthly until cancelled", () => {
    const s = withServer(newGame(6)), c = hypervisor(s, ["dev3"], "Cloud 1", "vmwhere");
    ok(buyAppSuite(s, c));
    monthEnd(s);
    expect(suiteLines(s).map((l) => [l.amount, l.params])).toEqual([[-APP_SUITE_FEE, { cluster: "Cloud 1" }]]);
    ok(cancelAppSuite(s, c));
    expect(err(cancelAppSuite(s, c))).toBe("error.noAppSuite");
    monthEnd(s);
    expect(suiteLines(s)).toHaveLength(1);
  });
});
