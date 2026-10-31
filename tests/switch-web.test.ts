import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { isManaged, modelById, shopModels } from "../src/sim/10-catalog/hardware";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { losePower } from "../src/sim/60-infra/power";
import { linkStatus } from "../src/sim/60-infra/status";
import { switchIp } from "../src/sim/60-infra/switches";
import { resolve } from "../src/sim/80-business/browser";
import { setPortGroup } from "../src/sim/90-actions/hardware";
import { recoverGear, updateFirmware } from "../src/sim/90-actions/remote";
import { saveSwitchConfig, setPortVlan } from "../src/sim/90-actions/switches";
import { withServer } from "./fixtures";

// The basement fixture: server dev3 on port 1 of the Sysko switch dev4, whose port 8 goes to the home router.
const game = (): GameState => withServer(newGame(7));
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const must = (r: { ok: boolean; error?: string }) => { if (!r.ok) throw new Error(r.error); };
const online = (s: GameState) => linkStatus(s, "dev3").online;

describe("unmanaged switches", () => {
  it("sells the four unmanaged models without management ports, desktop ones on a shelf", () => {
    const ids = ["dl-des1008d", "ng-gs108", "dl-dgs1024d", "ng-gs116"];
    for (const id of ids) {
      const m = modelById(id);
      expect(isManaged(m)).toBe(false);
      expect(m.oob).toEqual([]);
      expect(m.height).toBe(1);
    }
    expect(ids.filter((id) => modelById(id).shelf)).toEqual(["dl-des1008d", "ng-gs108", "ng-gs116"]);
    expect(isManaged(modelById("sw-8"))).toBe(true);
    expect(isManaged(modelById("ng-gs108t"))).toBe(true);
  });

  it("keeps the first switch affordable: the cheapest one in 2005 costs 25 euro", () => {
    const cheapest = Math.min(...shopModels(2005).filter((m) => m.kind === "switch").map((m) => m.price));
    expect(cheapest).toBe(25);
  });

  it("forwards between all ports and refuses port groups and settings", () => {
    const s = game();
    s.devices.push(device("dev90", "dl-des1008d", "D-Lunk", "rack2", 23, null, "desk-sw", 25));
    s.cables = s.cables.map((c) => (c.id === "cab6" ? { ...c, b: { device: "dev90", port: 0 } } : c));
    s.cables.push({ id: "cab90", a: { device: "dev90", port: 7 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null });
    expect(online(s)).toBe(true);
    expect(err(setPortGroup(s, "dev90", [0, 1]))).toBe("error.unmanaged");
    expect(err(setPortVlan(s, "dev90", 0, { untagged: 10, tagged: [] }))).toBe("error.unmanaged");
    expect(err(saveSwitchConfig(s, "dev90"))).toBe("error.unmanaged");
    expect(switchIp(dev(s, "dev90"))).toBeNull();
    expect(switchIp(dev(s, "dev4"))).toBe("192.168.1.254");
  });
});

describe("VLANs on a managed switch", () => {
  it("forwards only between ports that share a VLAN", () => {
    const s = game();
    expect(online(s)).toBe(true);
    must(setPortVlan(s, "dev4", 0, { untagged: 10, tagged: [] }));
    expect(online(s)).toBe(false);
    expect(dev(s, "dev4").locked).toBe(false);
    must(setPortVlan(s, "dev4", 0, { untagged: 1, tagged: [] }));
    expect(online(s)).toBe(true);
    expect(err(setPortVlan(s, "dev4", 0, { untagged: 4095, tagged: [] }))).toBe("error.vlanRange");
    expect(err(setPortVlan(s, "dev4", 9, { untagged: 1, tagged: [] }))).toBe("error.unknownPort");
  });

  it("carries a VLAN tagged over a trunk between two switches", () => {
    const s = game();
    // dev3 -> dev91 port 1 -> dev91 port 8 -> dev4 port 1 -> dev4 port 8 -> router.
    s.devices.push(device("dev91", "sw-8", "Sysko", "rack2", 22, null, "edge-sw", 60));
    s.cables = s.cables.map((c) => (c.id === "cab6" ? { ...c, b: { device: "dev91", port: 0 } } : c));
    s.cables.push({ id: "cab91", a: { device: "dev91", port: 7 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null });
    expect(online(s)).toBe(true);
    must(setPortVlan(s, "dev4", 0, { untagged: 10, tagged: [1] }));
    expect(online(s)).toBe(false);
    must(setPortVlan(s, "dev91", 7, { untagged: 10, tagged: [1] }));
    expect(online(s)).toBe(true);
    // A tagged frame on a port that takes only untagged ones is dropped, and the router takes untagged frames only.
    must(setPortVlan(s, "dev4", 0, { untagged: 1, tagged: [] }));
    expect(online(s)).toBe(false);
    expect([dev(s, "dev4").locked, dev(s, "dev91").locked]).toEqual([false, false]);
  });

  it("locks the player out at once when the desk's port leaves the management VLAN, until the console recovers it", () => {
    const s = game();
    must(setPortVlan(s, "dev4", 7, { untagged: 20, tagged: [] }));
    expect(dev(s, "dev4").locked).toBe(true);
    expect(dev(s, "dev4").log.at(-1)?.key).toBe("ipmi.log.lockedOut");
    expect(online(s)).toBe(false);
    expect(err(setPortVlan(s, "dev4", 7, { untagged: 1, tagged: [] }))).toBe("error.lockedOut");
    expect(err(saveSwitchConfig(s, "dev4"))).toBe("error.lockedOut");
    // The switch keeps its management VLAN on a tagged trunk: no lockout.
    const t = game();
    must(setPortVlan(t, "dev4", 7, { untagged: 1, tagged: [20] }));
    expect(dev(t, "dev4").locked).toBe(false);
    // Recovery by hand reloads the saved configuration.
    s.cash = 10_000;
    must(recoverGear(s, "dev4", true));
    while (dev(s, "dev4").hands) tick(s);
    expect(dev(s, "dev4").locked).toBe(false);
    expect(dev(s, "dev4").vlans).toEqual({});
  });
});

describe("the switch web interface", () => {
  it("answers on the maker's factory address while the switch works", () => {
    const s = game();
    s.devices.push(device("dev92", "hp-1800-8g", "Hewlett-Packet", "rack2", 21, null, "hp-sw", 150));
    expect(resolve(s, "192.168.1.254").page).toEqual({ kind: "switch", deviceId: "dev4" });
    expect(resolve(s, "192.168.2.10").page).toEqual({ kind: "switch", deviceId: "dev92" });
    must(setPortVlan(s, "dev4", 7, { untagged: 20, tagged: [] }));
    expect(resolve(s, "192.168.1.254").load).toBe("down");
  });
});

describe("running and saved configuration", () => {
  it("loses unsaved VLANs and groups on a power cut and keeps saved ones", () => {
    const s = game();
    must(setPortVlan(s, "dev4", 2, { untagged: 30, tagged: [] }));
    must(setPortGroup(s, "dev4", [4, 5]));
    losePower(s, dev(s, "dev4"));
    expect(dev(s, "dev4").vlans).toEqual({});
    expect(dev(s, "dev4").groups).toEqual([]);
    must(setPortVlan(s, "dev4", 2, { untagged: 30, tagged: [31, 30, 31] }));
    must(saveSwitchConfig(s, "dev4"));
    must(setPortVlan(s, "dev4", 3, { untagged: 40, tagged: [] }));
    s.hour = hourOf(new Date(Date.UTC(2009, 0, 1)));
    dev(s, "dev4").fw = { version: 2005, updatedAt: 0 };
    must(updateFirmware(s, "dev4"));
    expect(dev(s, "dev4").vlans).toEqual({ 2: { untagged: 30, tagged: [31] } });
  });

  it("gives a managed switch from an old save its running configuration as the saved one", () => {
    const s = game();
    const d = dev(s, "dev4");
    d.groups = [[2, 3]];
    delete d.vlans;
    delete d.saved;
    const back = dev(deserialize(serialize(s)), "dev4");
    expect(back.vlans).toEqual({});
    expect(back.saved).toEqual({ groups: [[2, 3]], vlans: {} });
    expect(newGame(1).devices.filter((x) => isManaged(modelById(x.model))).every((x) => x.saved)).toBe(true);
  });
});
