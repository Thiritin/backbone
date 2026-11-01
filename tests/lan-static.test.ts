import { describe, expect, it } from "vitest";
import { device, type GameState } from "../src/sim/50-state";
import { clusterReachable, memberUp, pinMembers } from "../src/sim/60-infra/cluster";
import { addressOf, conflicted, gatewayOf, holderOf, ifaceOf, leaseTick } from "../src/sim/60-infra/lan";
import { linkStatus } from "../src/sim/60-infra/status";
import { reboot } from "../src/sim/90-actions/hardware";
import { setIface, setRuntimeIface } from "../src/sim/90-actions/lan";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const STATIC = { mode: "static" as const, ip: "192.168.178.5", prefix: 24, gw: "192.168.178.1", dns: "192.168.178.1" };
const online = (s: GameState, id = "dev3") => linkStatus(s, id).online;
const err = (r: object) => (r as { error?: string }).error;
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

describe("static addresses", () => {
  it("holds a static address in the router's range and stays online without a lease", () => {
    const s = readyGame(3);
    expect(setIface(s, "dev3", STATIC).ok).toBe(true);
    expect(addressOf(s, "dev3")).toBe("192.168.178.5");
    expect(gatewayOf(s, "dev3")).toBe("dev5");
    expect(holderOf(s, "192.168.178.5")).toEqual({ deviceId: "dev3", iface: "eth" });
    expect(online(s)).toBe(true);
  });

  it("is offline with a wrong gateway, an address outside the range or no address", () => {
    const s = readyGame(3);
    setIface(s, "dev3", { ...STATIC, gw: "192.168.178.254" });
    expect(online(s)).toBe(false);
    setIface(s, "dev3", { ...STATIC, ip: "10.0.0.5", gw: "10.0.0.1" });
    expect(online(s)).toBe(false);
    setIface(s, "dev3", { mode: "static" });
    expect(addressOf(s, "dev3")).toBeNull();
    setIface(s, "dev3", { mode: "dhcp" });
    expect(online(s)).toBe(true);
  });

  it("refuses a setting with a malformed address and a device that is no server", () => {
    const s = readyGame(3);
    expect(err(setIface(s, "dev3", { ...STATIC, ip: "192.168.178.300" }))).toBe("error.badIp");
    expect(err(setIface(s, "dev5", STATIC))).toBe("error.notServerNet");
  });

  it("takes both holders of one address offline", () => {
    const s = readyGame(3);
    s.devices.push(device("dev9", "g2-compute", "Dwell", "rack2", 4, null, "fra1-srv-02", 0));
    s.cables.push({ id: "cab-9", a: { device: "dev9", port: 0 }, b: { device: "dev4", port: 3 }, kind: "copper", color: null });
    const leased = addressOf(s, "dev9")!;
    expect(online(s)).toBe(true);
    setIface(s, "dev3", { ...STATIC, ip: leased });
    expect(conflicted(s, "dev3")).toBe(true);
    expect(conflicted(s, "dev9")).toBe(true);
    expect(online(s)).toBe(false);
    setIface(s, "dev3", { ...STATIC, ip: "192.168.178.1" });
    expect(online(s)).toBe(false);
  });

  it("keeps what ip set until the next boot", () => {
    const s = readyGame(3);
    expect(setRuntimeIface(s, "dev3", { mode: "static", ip: "192.168.178.7", prefix: 24 }).ok).toBe(true);
    expect(addressOf(s, "dev3")).toBe("192.168.178.7");
    expect(online(s)).toBe(false);
    expect(reboot(s, "dev3").ok).toBe(true);
    expect(ifaceOf(dev(s, "dev3"))).toEqual({ mode: "dhcp" });
    s.hour = Math.ceil(dev(s, "dev3").bootUntil!) + 1;
    expect(addressOf(s, "dev3")).toBe("192.168.178.21");
  });

  it("loads an old save as DHCP and keeps a static setting through a save", () => {
    const s = readyGame(3);
    delete dev(s, "dev3").iface;
    expect(deserialize(serialize(s)).devices.find((d) => d.id === "dev3")!.iface).toEqual({ mode: "dhcp" });
    setIface(s, "dev3", STATIC);
    expect(deserialize(serialize(s)).devices.find((d) => d.id === "dev3")!.iface).toEqual(STATIC);
  });
});

describe("cluster members", () => {
  it("drop out when their address moves and are back when it returns", () => {
    const s = readyGame(3);
    const c = s.clusters.find((x) => x.nodes.some((n) => n.deviceId === "dev3"))!;
    pinMembers(s);
    const node = () => s.clusters.find((x) => x.id === c.id)!.nodes.find((n) => n.deviceId === "dev3")!;
    expect(node().ip).toBe("192.168.178.21");
    expect(memberUp(s, node())).toBe(true);
    setIface(s, "dev3", STATIC);
    expect(online(s)).toBe(true);
    expect(memberUp(s, node())).toBe(false);
    expect(clusterReachable(s, s.clusters.find((x) => x.id === c.id)!)).toBe(false);
    setIface(s, "dev3", { ...STATIC, ip: "192.168.178.21" });
    leaseTick(s);
    expect(memberUp(s, node())).toBe(true);
  });
});
