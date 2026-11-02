import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { type GameState } from "../src/sim/50-state";
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
import { CtPage, HostPage, TemplatesPage } from "../src/ui/apps/browser/consoles/openveezee/OpenVeeZee";
import { VmSummary as PmxSummary } from "../src/ui/apps/browser/consoles/proxmocks/Proxmocks";
import { VmMonitor, VmSummary as VswSummary } from "../src/ui/apps/browser/consoles/vmwhere/VmWhere";
import { hostOfVm, type Cluster } from "../src/sim/60-infra/cluster";
import { buyProvider } from "../src/sim/60-infra/addresses";
import { buyDevice, hypervisor, lateVersions, panelVm, pinVersion, skipTo, withServer, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

// docs/design/software.md, section 9: a year of each hypervisor console's early look, a year of its late look, and its mark.
const ERAS: Record<string, [number, number, string]> = {
  openveezee: [2005, 2016, "OpenVeeZee Web Panel"],
};
// docs/design/software.md, section 10: the first version of each UI generation, the look it draws, and a mark of its page.
const GENERATIONS: [string, string, string, string][] = [
  ["vmwhere", "2.5", "thickClient", "vSphear"], ["vmwhere", "5.0", "flecks", "Web Client"], ["vmwhere", "6.5", "clearity", "vSphear"],
  ["proxmocks", "0.9", "legacy", "PROXMOCKS"], ["proxmocks", "2.0", "extGrey", "PROXMOCKS"], ["proxmocks", "4.0", "flatline", "PROXMOCKS"],
  ["hypervee", "2008", "glossy", "HyperVee Manager"], ["hypervee", "2012", "flat", "HyperVee Manager"], ["hypervee", "2019", "honoloo", "Windoors Admin Center"],
];

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
  it("wear the look of the installed version, signed in or not", () => {
    for (const [id, [early, late, mark]] of Object.entries(ERAS)) {
      const [before, from] = lateVersions(id);
      for (const [year, look, version] of [[early, "early", undefined], [late, "early", before], [late, "late", from]] as const) {
        const { s, c } = cloud(id, year);
        if (version) pinVersion(s, s.clusters.find((x) => x.id === c)!, id, version);
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

  it("draws VMwhere, Proxmocks and HyperVee in the look of each generation's first version, whatever the year", () => {
    for (const [id, version, look, mark] of GENERATIONS) {
      const { s, c } = cloud(id, 2026);
      pinVersion(s, s.clusters.find((x) => x.id === c)!, id, version);
      const page = html(s, c, id);
      expect(page, `${id} ${version}`).toContain(`data-era="${look}"`);
      expect(page, `${id} ${version}`).toContain(mark);
      const login = html(s, c, id, false);
      expect(login, `${id} ${version}`).toContain(`data-era="${look}"`);
      expect(login).toContain("Password");
    }
  });

  it("names only the game's puns in every look of VMwhere, Proxmocks and HyperVee", () => {
    for (const [id, version] of GENERATIONS) {
      const { s, c } = cloud(id, 2026);
      pinVersion(s, s.clusters.find((x) => x.id === c)!, id, version);
      for (const signedIn of [true, false]) expect(html(s, c, id, signedIn), `${id} ${version}`).not.toMatch(/VMware|vSphere|Hyper-V|Proxmox|Microsoft|\bWindows\b/);
    }
  });

  it("shows the HyperVee release of a guest's integration services and the installed Proxmocks version", () => {
    const hv = cloud("hypervee", 2010);
    expect(html(hv.s, hv.c, "hypervee")).toContain(">2008 R2</td>");
    const pmx = cloud("proxmocks", 2026);
    pinVersion(pmx.s, pmx.s.clusters.find((x) => x.id === pmx.c)!, "proxmocks", "8.4");
    expect(html(pmx.s, pmx.c, "proxmocks")).toContain('class="pmx-ver num">8.4<');
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
      vmwhere: [(g, _, v) => <><VswSummary game={g} v={v} era="clearity" /><VmMonitor game={g} v={v} /></>, ["VMwhere Tools", "MEMORY USAGE", "VM Hardware", "Performance Chart"]],
      hypervee: [(g, _, v) => <VmDetails game={g} v={v} generations />, ["Heartbeat", "Memory Demand", "Replication", "CPU Usage"]],
      openveezee: [(g, c, v) => <><CtPage game={g} v={v} host="hv.example.com" /><HostPage game={g} c={c} id={c.nodes[0].deviceId} vms={[v]} open={() => {}} /><TemplatesPage game={g} vms={[v]} /></>, ["Start on boot", "Diskinodes", "Barrier", "Change settings", "OS templates", "allocated of"]],
      openstash: [(g, c, v) => <><InstanceOverview game={g} c={c} v={v} flavor="m1.small" /><Overview game={g} c={c} vms={[v]} /></>, ["Security Groups", "Volumes Attached", "Limit Summary", "VCPU-Hours"]],
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

  it("shows a VM's public address on its page in every console", () => {
    const pages: Record<string, (g: GameState, c: Cluster, v: Vm) => ReactElement> = {
      proxmocks: (g, c, v) => <PmxSummary game={g} c={c} v={v} />,
      vmwhere: (g, _, v) => <VswSummary game={g} v={v} era="clearity" />,
      hypervee: (g, _, v) => <VmDetails game={g} v={v} generations />,
      openveezee: (g, _, v) => <CtPage game={g} v={v} host="hv.example.com" />,
      openstash: (g, c, v) => <InstanceOverview game={g} c={c} v={v} flavor="m1.small" />,
    };
    for (const [id, page] of Object.entries(pages)) {
      const s = withServer(newGame(3));
      skipTo(s, 2016);
      s.cash = 1_000_000;
      const c = hypervisor(s, ["dev3"], "Cloud 1", id), host = panelVm(s, c), vm = s.workloads.find((w) => hostOfVm(s, w.id)?.id === host)!.id;
      const { ip } = buyProvider(s, s.locations[0], 4, vm);
      const View = () => { const cl = s.clusters.find((x) => x.id === c)!, v = useVms(s, cl, consoleFeatures(id, yearOf(s.hour))).vms.find((x) => x.id === vm)!; return page(s, cl, v); };
      expect(renderToString(<View />), id).toContain(ip);
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
