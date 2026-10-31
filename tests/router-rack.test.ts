import { describe, expect, it } from "vitest";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { linkStatus } from "../src/sim/60-infra/status";
import { addLocation, connect, moveRack, unmountDevice } from "../src/sim/90-actions/hardware";
import { installRouter } from "../src/sim/90-actions/routers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, freeFloor, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

describe("the router in the rack", () => {
  it("passes traffic only while its DSL port reaches the line jack", () => {
    const s = withServer(newGame(1));
    expect(linkStatus(s, "dev3").online).toBe(true);
    s.cables = s.cables.filter((c) => c.id !== "cab-line");
    expect(linkStatus(s, "dev3").online).toBe(false);
    expect(linkStatus(s, "dev5").online).toBe(false);
    expect(err(connect(s, { device: "dev5", port: 3 }, { device: "dev6", port: 0 }))).toBe("error.mediaMismatch");
    expect(err(connect(s, { device: "dev4", port: 6 }, { device: "dev6", port: 0 }))).toBe("error.mediaMismatch");
    ok(connect(s, { device: "dev5", port: 4 }, { device: "dev6", port: 0 }));
    expect(linkStatus(s, "dev3").online).toBe(true);
    ok(unmountDevice(s, "dev5"));
    expect(dev(s, "dev5").store).toBe("loc1");
    expect(linkStatus(s, "dev3").online).toBe(false);
  });

  it("swaps a bought router only for a mounted one", () => {
    const s = { ...newGame(1), cash: 10_000 };
    skipTo(s, 2006);
    const fb = ok(buyDevice(s, "fb-7050", "AVN", 1, "loc1"));
    expect(err(installRouter(s, fb))).toBe("error.noRouter");
  });

  it("leaves the router in the basement's storage when its rack moves to a datacenter", () => {
    const s = { ...withServer(newGame(1)), cash: 10_000 };
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    ok(moveRack(s, "rack2", fr5, 1));
    expect(dev(s, "dev5")).toMatchObject({ rackId: null, store: "loc1" });
    expect(s.cables.some((c) => [c.a.device, c.b.device].includes("dev5"))).toBe(false);
  });
});

describe("old saves", () => {
  // A save from before routers stood in the rack: the router on the carrier panel and no line jack.
  const panelSave = (s: GameState): string => {
    const raw = JSON.parse(serialize(s));
    raw.devices = raw.devices.filter((d: { id: string }) => d.id !== "dev6").map((d: { id: string }) => (d.id === "dev5" ? { ...d, rackId: null, slot: 0, store: null, panel: "loc1", brand: "Sysko" } : d));
    raw.cables = raw.cables.filter((c: { id: string }) => c.id !== "cab-line");
    return JSON.stringify(raw);
  };

  it("moves the panel router onto the lowest free shelf with its DSL port on a new line jack", () => {
    const loaded = deserialize(panelSave(withServer(newGame(1))));
    expect(dev(loaded, "dev5")).toMatchObject({ rackId: "rack2", slot: 2, panel: null, store: null, brand: "AVN" });
    const jack = loaded.devices.find((d) => d.model === "line-jack")!;
    expect(jack).toMatchObject({ panel: "loc1", rackId: null });
    expect(loaded.cables).toContainEqual(expect.objectContaining({ a: { device: jack.id, port: 0 }, b: { device: "dev5", port: 4 } }));
    expect(linkStatus(loaded, "dev3").online).toBe(true);
    expect(deserialize(serialize(loaded)).devices.filter((d) => d.model === "line-jack")).toHaveLength(1);
  });

  it("puts the router into storage when the basement rack is full", () => {
    const s = withServer(newGame(1));
    for (let slot = 2; slot <= 23; slot++) s.devices.push(device(`fill${slot}`, "sw-8", "Sysko", "rack2", slot, null, `fill-${slot}`, 0));
    const loaded = deserialize(panelSave(s));
    expect(dev(loaded, "dev5")).toMatchObject({ rackId: null, panel: null, store: "loc1" });
  });
});
