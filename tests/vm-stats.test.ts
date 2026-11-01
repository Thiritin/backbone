import { describe, expect, it } from "vitest";
import { STATS_HOURS, vmStats } from "../src/sim/60-infra/stats";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { stopWorkload } from "../src/sim/90-actions/vms";
import { hypervisor, panelVm, skipTo, withServer, newGame } from "./fixtures";

// docs/design/software.md, section 9: an own VM keeps a day of hourly samples for its console's graphs.
function panelOnVm() {
  const s = withServer(newGame(3));
  skipTo(s, 2010);
  s.cash = 1_000_000;
  const c = hypervisor(s, ["dev3"], "Cloud 1");
  const host = panelVm(s, c), vm = s.clusters.find((x) => x.id === host)!.vm!;
  return { s, vm, w: () => s.workloads.find((x) => x.id === vm)! };
}

describe("VM statistics", () => {
  it("fills the ring hour by hour and drops the oldest sample past a day", () => {
    const { s, vm, w } = panelOnVm();
    expect(w().stats).toBeUndefined();
    for (let i = 0; i < STATS_HOURS; i++) tick(s);
    const day = vmStats(s, vm)!;
    expect(day.ring).toHaveLength(STATS_HOURS);
    expect(day.ring.every((x) => x.cpu > 0 && x.cpu <= 1 && x.ram > 0 && x.disk > 0)).toBe(true);
    expect(day.uptimeHours).toBe(STATS_HOURS - 1);
    expect(day.totals.vcpuHours).toBeGreaterThan(0);
    const second = w().stats![1];
    tick(s);
    expect(w().stats).toHaveLength(STATS_HOURS);
    expect(w().stats![0]).toEqual(second);
  });

  it("samples zero for a stopped VM and forgets its uptime", () => {
    const { s, vm, w } = panelOnVm();
    tick(s);
    expect(stopWorkload(s, vm).ok).toBe(true);
    tick(s);
    expect(w().stats!.at(-1)).toEqual({ cpu: 0, ram: 0, disk: 0, netMbit: 0 });
    expect(vmStats(s, vm)!.uptimeHours).toBeNull();
  });

  it("loads a save from before statistics with an empty ring", () => {
    const { s, vm } = panelOnVm();
    const old = JSON.parse(serialize(s));
    for (const x of old.workloads) delete x.stats;
    const back = deserialize(JSON.stringify(old));
    expect(back.workloads.find((x) => x.id === vm)!.stats).toBeUndefined();
    expect(vmStats(back, vm)!.ring).toEqual([]);
  });
});
