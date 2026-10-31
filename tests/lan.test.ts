import { describe, expect, it } from "vitest";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { addressOf, gatewayOf, holderOf, lanOf, leaseTick, leasesOf, macOf } from "../src/sim/60-infra/lan";
import { linkStatus } from "../src/sim/60-infra/status";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { reserveAddress, setPortShare, setRouterLan, viewDevices } from "../src/sim/90-actions/lan";
import { installRouter } from "../src/sim/90-actions/routers";
import { readyGame } from "./fixtures";

const router = (s: GameState) => s.devices.find((d) => d.id === "dev5")!;
const lan = (s: GameState) => lanOf(s, router(s))!;
const unplug = (s: GameState, id: string) => { s.cables = s.cables.filter((c) => c.a.device !== id && c.b.device !== id); };
const hours = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.hour++; leaseTick(s); } };
// A second Dwell server in the basement rack, cabled to the switch.
const second = (s: GameState) => {
  s.devices.push(device("dev9", "g2-compute", "Dwell", "rack2", 4, null, "fra1-srv-02", 0));
  s.cables.push({ id: "cab-9", a: { device: "dev9", port: 0 }, b: { device: "dev4", port: 3 }, kind: "copper", color: null });
};

describe("DHCP on the basement router", () => {
  it("hands the desk the first pool address and the servers the next ones", () => {
    const s = readyGame(3);
    expect(lan(s).gateway).toBe("192.168.178.1");
    expect(holderOf(s, "192.168.178.20")).toBeNull();
    expect(addressOf(s, "dev3")).toBe("192.168.178.21");
    expect(gatewayOf(s, "dev3")).toBe("dev5");
    expect(holderOf(s, "192.168.178.1")).toEqual({ deviceId: "dev5", iface: "router" });
  });

  it("stores leases and renews them at half the lease time", () => {
    const s = readyGame(3);
    leaseTick(s);
    const first = lan(s).leases.find((l) => l.mac === macOf(s, "dev3"))!;
    expect(first.until).toBe(s.hour + 240);
    hours(s, 119);
    expect(lan(s).leases.find((l) => l.mac === first.mac)!.until).toBe(first.until);
    hours(s, 2);
    expect(lan(s).leases.find((l) => l.mac === first.mac)!.until).toBe(s.hour + 240);
  });

  it("keeps an unplugged server's address until its lease runs out, then gives it away", () => {
    const s = readyGame(3);
    leaseTick(s);
    unplug(s, "dev3");
    expect(linkStatus(s, "dev3").online).toBe(false);
    second(s);
    expect(addressOf(s, "dev9")).toBe("192.168.178.22");
    hours(s, 241);
    expect(leasesOf(s, "dev5").some((l) => l.mac === macOf(s, "dev3"))).toBe(false);
    s.cables.push({ id: "cab-back", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null });
    unplug(s, "dev9");
    second(s);
    leaseTick(s);
    expect(addressOf(s, "dev3")).toBe("192.168.178.21");
  });

  it("keeps a reserved address for its device after the lease runs out", () => {
    const s = readyGame(3);
    second(s);
    leaseTick(s);
    const ip = addressOf(s, "dev9");
    expect(reserveAddress(s, "dev5", macOf(s, "dev9"), true).ok).toBe(true);
    unplug(s, "dev9");
    unplug(s, "dev3");
    hours(s, 241);
    s.cables.push({ id: "cab-9", a: { device: "dev9", port: 0 }, b: { device: "dev4", port: 3 }, kind: "copper", color: null });
    expect(addressOf(s, "dev9")).toBe(ip);
  });

  it("gives no address when the pool is full", () => {
    const s = readyGame(3);
    expect(setRouterLan(s, "dev5", "192.168.178.1", 20, 21).ok).toBe(true);
    second(s);
    expect(addressOf(s, "dev3")).toBe("192.168.178.21");
    expect(addressOf(s, "dev9")).toBeNull();
    expect(linkStatus(s, "dev9").online).toBe(false);
  });

  it("moves the network to the new range and refuses public or broken settings", () => {
    const s = readyGame(3);
    expect(setRouterLan(s, "dev5", "8.8.8.1", 20, 200).error).toBe("error.badAddress");
    expect(setRouterLan(s, "dev5", "192.168.1.1", 1, 10).error).toBe("error.badPool");
    expect(setRouterLan(s, "dev5", "192.168.1.1", 50, 20).error).toBe("error.badPool");
    expect(setRouterLan(s, "dev5", "10.0.0.1", 100, 150).ok).toBe(true);
    expect(addressOf(s, "dev3")).toBe("10.0.0.101");
  });

  it("starts a swapped-in router with no leases or reservations and keeps the shares", () => {
    const s = readyGame(3);
    leaseTick(s);
    expect(setPortShare(s, "dev5", "dev3", "web").ok).toBe(true);
    s.devices.push({ ...device("dev8", "fb-7390", "AVN", null, 0, null, "fra1-gw-02", 0), store: "loc1" });
    expect(installRouter(s, "dev8").ok).toBe(true);
    const fresh = lanOf(s, s.devices.find((d) => d.id === "dev8")!)!;
    expect(fresh.leases).toEqual([]);
    expect(fresh.reservations).toEqual([]);
    expect(fresh.shares).toEqual([{ ip: "192.168.178.21", kind: "web" }]);
  });

  it("ticks findAddress once the first server shows in the device list", () => {
    const s = readyGame(3);
    expect(viewDevices(s, "dev5").ok).toBe(true);
    expect(s.checklist).toContain("findAddress");
    const bare = newGame(3);
    viewDevices(bare, "dev5");
    expect(bare.checklist).not.toContain("findAddress");
  });

  it("fills the router's network settings into a save from before them", () => {
    const s = readyGame(3);
    const raw = JSON.parse(serialize(s));
    for (const d of raw.devices) delete d.lan;
    expect(lanOf(deserialize(JSON.stringify(raw)), router(s))!.cidr).toBe("192.168.178.0/24");
    expect(deserialize(JSON.stringify(raw)).devices.find((d: { id: string }) => d.id === "dev5")!.lan!.leases).toEqual([]);
  });
});
