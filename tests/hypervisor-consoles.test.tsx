import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { newGame, type GameState } from "../src/sim/50-state";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { addNode, createVm } from "../src/sim/90-actions/clusters";
import { connect } from "../src/sim/90-actions/hardware";
import { joinableServers } from "../src/sim/90-actions/software";
import { buyAppSuite } from "../src/sim/90-actions/suite";
import { STATS_HOURS } from "../src/sim/60-infra/stats";
import { tick } from "../src/sim/88-tick/tick";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { useVms, type Vm } from "../src/ui/apps/browser/consoles/HypervisorBase";
import { VmDetails } from "../src/ui/apps/browser/consoles/hypervee/HyperVee";
import { InstanceOverview, Overview } from "../src/ui/apps/browser/consoles/openstash/Horizont";
import { CtPage, HostPage } from "../src/ui/apps/browser/consoles/openveezee/OpenVeeZee";
import { VmSummary as PmxSummary } from "../src/ui/apps/browser/consoles/proxmocks/Proxmocks";
import { VmMonitor, VmSummary as VswSummary } from "../src/ui/apps/browser/consoles/vmwhere/VmWhere";
import type { Cluster } from "../src/sim/60-infra/cluster";
import { buyDevice, hypervisor, panelVm, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

// docs/design/software.md, section 9: the first year of each hypervisor console's early and late look, and its mark.
const ERAS: Record<string, [number, number, string]> = {
  proxmocks: [2008, 2015, "PROXMOCKS"], vmwhere: [2005, 2015, "vSphear"], hypervee: [2008, 2012, "HyperVee Manager"],
  openveezee: [2005, 2016, "OpenVeeZee Web Panel"], openstash: [2010, 2016, "openstash"],
};

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };

function cloud(id: string, year: number) {
  const s = withServer(newGame(3));
  skipTo(s, year);
  s.cash = 1_000_000;
  const c = hypervisor(s, ["dev3"], "Cloud 1", id);
  ok(createVm(s, c, { vcpu: 1, ramGb: 1, diskGb: 20 }));
  return { s, c };
}

const html = (s: GameState, c: string, id: string, signedIn = true) =>
  renderToString((() => { const View = CONSOLES[id]; return <View game={s} c={s.clusters.find((x) => x.id === c)!} f={consoleFeatures(id, yearOf(s.hour))} host="hv.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />; })());

describe("hypervisor consoles", () => {
  it("wear the early look before the late year and the late look from it, signed in or not", () => {
    for (const [id, [early, late, mark]] of Object.entries(ERAS)) {
      for (const [year, look] of [[early, "early"], [late - 1, "early"], [late, "late"]] as const) {
        const { s, c } = cloud(id, year);
        expect(yearOf(s.hour), id).toBe(year);
        const page = html(s, c, id);
        expect(page, `${id} ${year}`).toContain(`data-era="${look}"`);
        expect(page, `${id} ${year}`).toContain(mark);
        expect(page).toContain("hv.example.com");
        const login = html(s, c, id, false);
        expect(login, id).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("shows the App Suite tile with its fee on a VMwhere cluster", () => {
    const { s, c } = cloud("vmwhere", 2010);
    expect(html(s, c, "vmwhere")).toContain("VMwhere App Suite");
    expect(html(s, c, "vmwhere")).toContain("Buy");
    ok(buyAppSuite(s, c));
    expect(html(s, c, "vmwhere")).toContain("Cancel subscription");
    expect(html(s, c, "proxmocks")).not.toContain("VMwhere App Suite");
  });

  it("joins a second Proxmocks server from the console's node list and lists it there", () => {
    const { s, c } = cloud("proxmocks", 2010);
    const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, second, "rack2", 2));
    ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
    hypervisor(s, [second]);
    expect(consoleFeatures("proxmocks", 2010).cluster).toBe(true);
    const join = joinableServers(s, c);
    expect(join).toEqual([second]);
    ok({ ...addNode(s, c, join[0]), id: c });
    expect(s.clusters.find((x) => x.id === c)!.nodes.map((n) => n.deviceId)).toEqual(["dev3", second]);
    const name = s.devices.find((d) => d.id === second)!.hostname!;
    expect(html(s, c, "proxmocks")).toContain(name);
  });

  it("draws a VM's page with its day of samples the way each product does", () => {
    const pages: Record<string, [(g: GameState, c: Cluster, v: Vm) => ReactElement, string[]]> = {
      proxmocks: [(g, c, v) => <PmxSummary game={g} c={c} v={v} />, ["HA State", "Bootdisk size", "Network traffic", "Day (average)"]],
      vmwhere: [(g, _, v) => <><VswSummary game={g} v={v} era="late" /><VmMonitor game={g} v={v} /></>, ["VMwhere Tools", "MEMORY USAGE", "VM Hardware", "Performance Chart"]],
      hypervee: [(g, _, v) => <VmDetails game={g} v={v} generations />, ["Heartbeat", "Memory Demand", "Replication", "CPU Usage"]],
      openveezee: [(g, c, v) => <><CtPage game={g} v={v} host="hv.example.com" /><HostPage game={g} c={c} id={c.nodes[0].deviceId} vms={[v]} open={() => {}} /></>, ["Start on boot", "Diskinodes", "Barrier", "Change settings", "OS templates", "allocated of"]],
      openstash: [(g, c, v) => <><InstanceOverview game={g} v={v} flavor="m1.small" /><Overview game={g} c={c} vms={[v]} /></>, ["Security Groups", "Volumes Attached", "Limit Summary", "VCPU-Hours"]],
    };
    for (const [id, [page, marks]] of Object.entries(pages)) {
      const s = withServer(newGame(3));
      skipTo(s, 2016);
      s.cash = 1_000_000;
      const c = hypervisor(s, ["dev3"], "Cloud 1", id);
      panelVm(s, c);
      for (let i = 0; i < STATS_HOURS; i++) tick(s);
      const View = () => { const cl = s.clusters.find((x) => x.id === c)!, { vms } = useVms(s, cl, consoleFeatures(id, yearOf(s.hour))); return page(s, cl, vms[0]); };
      const out = renderToString(<View />);
      for (const m of marks) expect(out, `${id} ${m}`).toContain(m);
      expect(out, id).toMatch(/<(polyline|rect) class="cx-chart-(line|bar)"/);
    }
  });
});

describe("panel migrate availability", () => {
  it("offers Migrate from the same-panel import year", () => {
    expect(consoleFeatures("pleskit", 2006).migrate).toBe("hand");
    expect(consoleFeatures("directadmen", 2009).migrate).toBeNull();
    expect(consoleFeatures("directadmen", 2010).migrate).toBe("hand");
  });
});
