import { describe, expect, it } from "vitest";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { addressOf, freeAddresses, gatewayOf, leaseTick } from "../src/sim/60-infra/lan";
import { machineAddress } from "../src/sim/60-infra/addresses";
import { privateNetOf } from "../src/sim/60-infra/private";
import { linkStatus } from "../src/sim/60-infra/status";
import { loadSaved } from "../src/sim/60-infra/switches";
import { resolve } from "../src/sim/80-business/browser";
import { runCommand } from "../src/sim/60-infra/terminal";
import { addLocation, buyRack } from "../src/sim/90-actions/hardware";
import { createVm, placeService } from "../src/sim/90-actions/clusters";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { setOwnRouterLan, setRemoteAccess } from "../src/sim/90-actions/routers";
import { saveSwitchConfig, setPortVlan, setRouted } from "../src/sim/90-actions/switches";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { bootedMachine, freeFloor, hypervisor, join, routerOnLine } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const cable = (s: GameState, a: string, ap: number, b: string, bp: number) =>
  s.cables.push({ id: `cab-${a}-${ap}`, a: { device: a, port: ap }, b: { device: b, port: bp }, kind: "copper", color: null });

// A ready suite at Hetzler Park: the MicroTick CCR1036 rtr's first port on the handoff, its second on port 1 of the layer 3
// Junipurr EX4200 sw, and servers srvA and srvB on the switch's ports 2 and 3.
function datacenter(seed = 1) {
  const s = newGame(seed);
  s.cash = 1e6;
  const loc = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
  s.locations = s.locations.map((l) => (l.id === loc ? { ...l, readyAt: s.hour } : l));
  const rack = ok(buyRack(s, loc, "rack-42", 1));
  s.racks = s.racks.map((r) => (r.id === rack ? { ...r, arriveAt: null } : r));
  const handoff = s.devices.find((d) => d.panel === loc)!.id;
  s.devices.push(device("rtr", "ccr1036", "MicroTick", rack, 40, null, "rtr", 1000), device("sw", "ex4200-48t", "Junipurr", rack, 38, null, "sw", 6500),
    device("srvA", "g1-compute", "Dwell", rack, 1, null, "srvA", 2500), device("srvB", "g1-compute", "Dwell", rack, 3, null, "srvB", 2500));
  s.devices.find((d) => d.id === "srvA")!.hostname = "node101";
  s.devices.find((d) => d.id === "srvB")!.hostname = "node102";
  cable(s, "rtr", 0, handoff, 0);
  cable(s, "rtr", 1, "sw", 0);
  cable(s, "srvA", 0, "sw", 1);
  cable(s, "srvB", 0, "sw", 2);
  return { s, loc, handoff };
}

describe("own routers in a datacenter", () => {
  it("takes its uplink address from the handoff and hands its servers its own range", () => {
    const { s, handoff } = datacenter();
    expect(gatewayOf(s, "rtr")).toBe(handoff);
    expect(addressOf(s, "rtr")).toMatch(/^10\.2\.0\.\d+$/);
    expect(gatewayOf(s, "srvA")).toBe("rtr");
    expect(addressOf(s, "srvA")).toMatch(/^192\.168\.88\.\d+$/);
    expect(linkStatus(s, "srvA").online).toBe(true);
  });

  it("takes its servers offline when its uplink does not reach the handoff", () => {
    const { s } = datacenter();
    s.cables = s.cables.filter((c) => c.id !== "cab-rtr-0");
    expect(linkStatus(s, "rtr").online).toBe(false);
    expect(linkStatus(s, "srvA").online).toBe(false);
    cable(s, "rtr", 2, "sw", 5);
    expect(linkStatus(s, "srvA").online).toBe(false);
  });

  it("answers the desk on its uplink address and lets it into its network only over its VPN", () => {
    const { s } = datacenter();
    expect(resolve(s, `http://${addressOf(s, "rtr")}/`).page).toEqual({ kind: "router", deviceId: "rtr" });
    const server = () => resolve(s, `http://${addressOf(s, "srvA")}/`);
    expect(server().load).toBe("down");
    expect(resolve(s, "http://192.168.88.1/").load).toBe("down");
    ok(setRemoteAccess(s, "rtr", true));
    expect(server().load).not.toBe("down");
    expect(resolve(s, "http://192.168.88.1/").page).toEqual({ kind: "router", deviceId: "rtr" });
  });

  it("times ssh out to a server behind it until its VPN is on", () => {
    const { s } = datacenter();
    routerOnLine(s);
    s.homeLine = { id: "dsl-16", next: null };
    bootedMachine(s, "srvA");
    const ssh = () => runCommand(s, null, `ssh ${addressOf(s, "srvA")}`).output.join("\n");
    expect(ssh()).toMatch(/Connection timed out/);
    ok(setRemoteAccess(s, "rtr", true));
    expect(ssh()).toMatch(/^Welcome to node101/);
  });

  it("moves its network to a range the player sets and refuses broken ones", () => {
    const { s, handoff } = datacenter();
    expect(err(setOwnRouterLan(s, handoff, "10.20.0.1", 16, "10.20.0.10", "10.20.3.254"))).toBe("error.notOwnRouter");
    expect(err(setOwnRouterLan(s, "rtr", "10.20.0.1", 8, "10.20.0.10", "10.20.3.254"))).toBe("error.badPrefix");
    expect(err(setOwnRouterLan(s, "rtr", "8.8.8.1", 24, "8.8.8.10", "8.8.8.20"))).toBe("error.badAddress");
    expect(err(setOwnRouterLan(s, "rtr", "10.20.0.1", 24, "10.20.1.10", "10.20.1.20"))).toBe("error.badPool");
    expect(err(setOwnRouterLan(s, "rtr", "10.20.0.1", 16, "10.20.0.1", "10.20.0.20"))).toBe("error.badPool");
    ok(setOwnRouterLan(s, "rtr", "10.20.0.1", 16, "10.20.0.10", "10.20.3.254"));
    expect(addressOf(s, "srvA")).toMatch(/^10\.20\.0\.\d+$/);
    expect(freeAddresses(s, "rtr")).toBeGreaterThan(900);
  });
});

describe("routing between VLANs", () => {
  it("reaches the router from another VLAN only through a layer 3 switch that routes both", () => {
    const { s } = datacenter();
    ok(setPortVlan(s, "sw", 1, { untagged: 10, tagged: [] }));
    expect(linkStatus(s, "srvA").online).toBe(false);
    expect(addressOf(s, "srvA")).toBeNull();
    ok(setRouted(s, "sw", [1, 10]));
    expect(linkStatus(s, "srvA").online).toBe(true);
    expect(gatewayOf(s, "srvA")).toBe("rtr");
  });

  it("routes only on layer 3 switches and loads the saved routing on a reboot", () => {
    const { s } = datacenter();
    s.devices.push(device("sw2", "sw-8", "Sysko", s.devices.find((d) => d.id === "sw")!.rackId, 30, null, "sw2", 60));
    expect(err(setRouted(s, "sw2", [1, 10]))).toBe("error.notLayer3");
    ok(setRouted(s, "sw", [1, 10]));
    ok(saveSwitchConfig(s, "sw"));
    ok(setRouted(s, "sw", []));
    const sw = s.devices.find((d) => d.id === "sw")!;
    loadSaved(sw);
    expect(sw.routed).toEqual([1, 10]);
  });
});

describe("VMs on the location's network", () => {
  it("gives each VM its own lease from its host's router and none once the pool is full", () => {
    const { s } = datacenter(2);
    const cluster = hypervisor(s, ["srvA"]);
    const vm = ok(createVm(s, cluster, { vcpu: 1, ramGb: 1, diskGb: 10 }));
    expect(machineAddress(s, vm)).toMatch(/^192\.168\.88\.\d+$/);
    expect(machineAddress(s, vm)).not.toBe(addressOf(s, "srvA"));
    leaseTick(s);
    const pool = (n: number) => ok(setOwnRouterLan(s, "rtr", "192.168.88.1", 24, "192.168.88.10", `192.168.88.${9 + n}`));
    pool(32);
    leaseTick(s);
    pool(32 - freeAddresses(s, "rtr"));
    leaseTick(s);
    expect(freeAddresses(s, "rtr")).toBe(0);
    expect(workloadOnline(s, s.workloads.find((w) => w.id === vm)!)).toBe(true);
    const late = ok(createVm(s, cluster, { vcpu: 1, ramGb: 1, diskGb: 10 }));
    expect(machineAddress(s, late)).toBeNull();
    expect(workloadOnline(s, s.workloads.find((w) => w.id === late)!)).toBe(false);
    const svc = addService(s, addCustomer(s, "Ada", "hobbyDev"), "vps", "vps", 10, "hour");
    expect(err(placeService(s, svc, cluster))).toBe("error.poolFull");
  });
});

describe("customer private networks", () => {
  it("gives an enterprise customer's VMs a VLAN they reach each other in only where every server's port carries it", () => {
    const { s } = datacenter(3);
    const cluster = hypervisor(s, ["srvA"]);
    join(s, cluster, "srvB");
    const corp = addCustomer(s, "Initech", "enterprise"), dev = addCustomer(s, "Bob", "hobbyDev");
    const a = ok(placeService(s, addService(s, corp, "vps", "a", 10, "hour"), cluster, "srvA"));
    const b = ok(placeService(s, addService(s, corp, "vps", "b", 10, "hour"), cluster, "srvB"));
    ok(placeService(s, addService(s, dev, "vps", "c", 10, "hour"), cluster, "srvA"));
    expect(privateNetOf(s, corp)?.vlan).toBe(100);
    expect(privateNetOf(s, dev)).toBeUndefined();
    const up = () => [a, b].map((id) => workloadOnline(s, s.workloads.find((w) => w.id === id)!));
    expect(up()).toEqual([false, false]);
    ok(setPortVlan(s, "sw", 1, { untagged: 1, tagged: [100] }));
    expect(up()).toEqual([false, false]);
    ok(setPortVlan(s, "sw", 2, { untagged: 1, tagged: [], all: true }));
    expect(up()).toEqual([true, true]);
  });

  it("fills an empty list into a save from before private networks", () => {
    const { s } = datacenter();
    const raw = JSON.parse(serialize(s));
    delete raw.privateNets;
    expect(deserialize(JSON.stringify(raw)).privateNets).toEqual([]);
  });
});
