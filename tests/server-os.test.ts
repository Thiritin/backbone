import { describe, expect, it } from "vitest";
import { hashRng } from "../src/sim/00-core/rng";
import { isMonthStart, yearOf } from "../src/sim/00-core/time";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { APP_SUITE_FEE, SERVER_OS, serverOsAt, serverOsById } from "../src/sim/10-catalog/server-os";
import { newGame, type GameState } from "../src/sim/50-state";
import { machineOf } from "../src/sim/60-infra/cluster";
import { seize } from "../src/sim/60-infra/incidents";
import { licenseCost } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { addNode, createVm, deleteVm } from "../src/sim/90-actions/clusters";
import { connect } from "../src/sim/90-actions/hardware";
import { installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, panelServer, panelVm, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { expect(r.error).toBeUndefined(); return r.id!; };
const VM = { vcpu: 2, ramGb: 4, diskGb: 50 };

// The basement server and two more cabled to the switch, nothing installed, in 2010.
function threeServers() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  skipTo(s, 2010);
  const more = [2, 3].map((slot) => {
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", slot));
    ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: slot - 1 }));
    return id;
  });
  return { s, second: more[0], third: more[1] };
}
const monthEnd = (s: GameState) => {
  while (!isMonthStart(s.hour + 1)) s.hour++;
  tick(s);
};

describe("server operating systems", () => {
  it("has Debiant and Windoors with their fees, boot minutes and install hours", () => {
    expect(SERVER_OS.map((o) => [o.id, o.name, o.fee, o.bootMinutes, o.installHours])).toEqual([
      ["lunix", "Debiant GNU/Lunix", 0, 20, 1],
      ["windoors", "Windoors Server", 15, 40, 2],
    ]);
    expect(APP_SUITE_FEE).toBe(25);
    expect(SOFTWARE.every((sw) => sw.os.length > 0 && sw.site.host.endsWith(".example"))).toBe(true);
    const hosts = [...SOFTWARE.map((sw) => sw.site.host), ...SERVER_OS.map((o) => o.site.host)];
    expect(new Set(hosts).size).toBe(hosts.length);
  });

  it("installs the newest version out in the game year", () => {
    expect(serverOsAt("lunix", 2005).version).toBe("3.1");
    expect(serverOsAt("lunix", 2016)).toMatchObject({ version: "8", name: "Jessie" });
    expect(serverOsAt("lunix", 2030).version).toBe("12");
    expect(serverOsAt("windoors", 2007).version).toBe("2003");
    expect(serverOsAt("windoors", 2011).version).toBe("2008 R2");
    expect(serverOsAt("windoors", 2025).version).toBe("2025");
    expect(serverOsAt("windoors", 2000).version).toBe("2003");
  });

  it("gives an empty machine the first OS its software runs on, and writes its software list in the cluster layer", () => {
    const { s, second, third } = threeServers();
    ok(installSoftware(s, "dev3", "tcadmen"));
    expect(machineOf(s, "dev3")).toMatchObject({
      os: { id: "windoors", version: "2008 R2", installedAt: s.hour },
      software: [{ id: "tcadmen", version: "2010", installedAt: s.hour, doneAt: s.hour + 2 }],
    });
    const cloud = hypervisor(s, [second]);
    hypervisor(s, [third]);
    ok(addNode(s, cloud, third));
    expect(machineOf(s, third)).toMatchObject({ os: { id: "lunix" }, software: [{ id: "proxmocks" }] });
    const vm = ok(createVm(s, cloud, VM));
    expect(machineOf(s, vm)).toMatchObject({ os: null, software: [] });
    ok(installSoftware(s, vm, "cpanic"));
    expect(machineOf(s, vm)).toMatchObject({ os: { id: "lunix" }, software: [{ id: "cpanic" }] });
    ok(uninstallSoftware(s, vm));
    expect(machineOf(s, vm)).toMatchObject({ os: { id: "lunix" }, software: [] });
    ok(deleteVm(s, vm));
    // A node that leaves keeps its OS and loses the hypervisor.
    ok(uninstallSoftware(s, third));
    expect(machineOf(s, third)).toMatchObject({ os: { id: "lunix" }, software: [] });
    seize(s, second, "Europoll", hashRng(1), []);
    expect(s.ops.seized[0].device).toMatchObject({ id: second, software: [] });
  });

  it("bills Windoors per machine and the App Suite per cluster with the licenses", () => {
    const { s, second } = threeServers();
    const host = panelServer(s, "dev3", "tcadmen");
    const cloud = hypervisor(s, [second], undefined, "hypervee");
    expect(licenseCost(s, s.clusters.find((c) => c.id === host)!)).toEqual({ panel: 25, platform: 15 });
    expect(licenseCost(s, s.clusters.find((c) => c.id === cloud)!)).toEqual({ panel: 0, platform: 20 + 15 });
    s.clusters = s.clusters.map((c) => (c.id === cloud ? { ...c, appSuite: true } : c));
    expect(licenseCost(s, s.clusters.find((c) => c.id === cloud)!).platform).toBe(20 + 15 + 25);
    monthEnd(s);
    expect(s.ledger.filter((l) => l.category === "licenses").map((l) => [l.key, l.amount])).toEqual([
      ["ledger.license", -25], ["ledger.license", -20], ["ledger.appSuite", -25], ["ledger.windoors", -30],
    ]);
    expect(s.ledger.find((l) => l.key === "ledger.windoors")?.params).toEqual({ count: 2 });
  });
});

describe("old saves", () => {
  it("fill every machine's OS and software from its clusters, and map the old ISO to Lunix", () => {
    const { s, second, third } = threeServers();
    const cloud = hypervisor(s, ["dev3"]);
    const hv = hypervisor(s, [second], undefined, "hypervee");
    const game = panelServer(s, third, "tcadmen");
    const panel = panelVm(s, cloud, "freepanel");
    const empty = ok(createVm(s, cloud, VM));
    const raw = JSON.parse(serialize(s));
    for (const m of [...raw.devices, ...raw.workloads]) { delete m.os; delete m.software; }
    raw.workloads.find((w: { id: string }) => w.id === empty).media = "iso";
    const old = deserialize(JSON.stringify(raw));
    const at = (id: string) => old.clusters.find((c) => c.id === id)!.updatedAt;
    const os = (id: "lunix" | "windoors", clusterId: string) => ({ id, version: serverOsAt(id, yearOf(at(clusterId))).version, installedAt: at(clusterId) });
    expect(machineOf(old, "dev3")).toMatchObject({ os: os("lunix", cloud), software: [{ id: "proxmocks", doneAt: null }] });
    expect(machineOf(old, second)).toMatchObject({ os: os("windoors", hv), software: [{ id: "hypervee", doneAt: null }] });
    expect(machineOf(old, third)).toMatchObject({ os: os("windoors", game), software: [{ id: "tcadmen", doneAt: null }] });
    const vm = old.clusters.find((c) => c.id === panel)!.vm!;
    expect(machineOf(old, vm)).toMatchObject({ os: os("lunix", panel), software: [{ id: "freepanel", doneAt: null }] });
    expect(machineOf(old, empty)).toMatchObject({ os: null, software: [], media: "lunix" });
    expect(machineOf(old, "dev4")).toMatchObject({ os: null, software: [] });
    expect(serverOsById("windoors").fee).toBe(15);
    // A current save keeps what it has.
    expect(machineOf(deserialize(serialize(old)), second)).toEqual(machineOf(old, second));
  });
});
