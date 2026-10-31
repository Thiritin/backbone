import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_LINE } from "../src/sim/20-world/datacenters";
import { device, type GameState } from "../src/sim/50-state";
import { hasPublicAddress } from "../src/sim/60-infra/addresses";
import { clusterReachable } from "../src/sim/60-infra/cluster";
import { shareOf } from "../src/sim/60-infra/lan";
import { dropPortShare, setPortShare, setRouterLan } from "../src/sim/90-actions/lan";
import { CHECKS } from "../src/sim/checklist";
import { readyGame } from "./fixtures";

// The ready game on the flat's dynamic line, without the business line's own block or the router's share.
const dynamic = (seed = 4): GameState => {
  const s = readyGame(seed);
  s.homeLine = { id: DEFAULT_HOME_LINE, next: null };
  s.ips = { ...s.ips, blocks: [], addresses: s.ips.addresses.filter((a) => a.source === "line") };
  dropPortShare(s, "dev5", "192.168.178.21");
  return s;
};
const vmOf = (s: GameState) => s.workloads.find((w) => w.deviceId === "dev3")!.id;

describe("port shares on the basement router", () => {
  it("make the web host reachable from the dynamic line", () => {
    const s = dynamic();
    expect(clusterReachable(s, s.clusters[0])).toBe(false);
    expect(CHECKS.shareWeb(s)).toBe(false);
    expect(setPortShare(s, "dev5", "dev3", "web").ok).toBe(true);
    expect(hasPublicAddress(s, "dev3")).toBe(true);
    expect(shareOf(s, vmOf(s))).toEqual({ ip: "192.168.178.21", kind: "web" });
    expect(clusterReachable(s, s.clusters[0])).toBe(true);
    expect(CHECKS.shareWeb(s)).toBe(true);
    expect(dropPortShare(s, "dev5", "192.168.178.21").ok).toBe(true);
    expect(hasPublicAddress(s, "dev3")).toBe(false);
  });

  it("go to one device per router", () => {
    const s = dynamic();
    s.devices.push(device("dev9", "g2-compute", "Dwell", "rack2", 4, null, "fra1-srv-02", 0));
    s.cables.push({ id: "cab-9", a: { device: "dev9", port: 0 }, b: { device: "dev4", port: 3 }, kind: "copper", color: null });
    expect(setPortShare(s, "dev5", "dev3", "web").ok).toBe(true);
    expect(setPortShare(s, "dev5", "dev9", "exposed").error).toBe("error.portShared");
    expect(setPortShare(s, "dev5", "dev3", "exposed").ok).toBe(true);
    expect(shareOf(s, "dev3")!.kind).toBe("exposed");
  });

  it("need an address on the router's network", () => {
    const s = dynamic();
    s.cables = s.cables.filter((c) => c.a.device !== "dev3");
    expect(setPortShare(s, "dev5", "dev3", "web").error).toBe("error.noAddress");
  });

  it("stop reaching the server when the network moves to another range", () => {
    const s = dynamic();
    setPortShare(s, "dev5", "dev3", "web");
    expect(setRouterLan(s, "dev5", "192.168.1.1", 20, 200).ok).toBe(true);
    expect(hasPublicAddress(s, "dev3")).toBe(false);
  });
});
