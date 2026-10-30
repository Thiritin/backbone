import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { newGame, type GameState } from "../src/sim/50-state";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { addNode, createVm } from "../src/sim/90-actions/clusters";
import { connect } from "../src/sim/90-actions/hardware";
import { joinableServers } from "../src/sim/90-actions/software";
import { buyAppSuite } from "../src/sim/90-actions/suite";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { buyDevice, hypervisor, skipTo, withServer } from "./fixtures";
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
});
