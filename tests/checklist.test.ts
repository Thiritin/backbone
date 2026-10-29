import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { CHECKS, checkDone } from "../src/sim/checklist";
import { takeLoan } from "../src/sim/90-actions/billing";
import { toggleCheck } from "../src/sim/90-actions/checklist";
import { addLocation, buyDevice, connect } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addNode, createCluster, setSoftware } from "../src/sim/90-actions/clusters";
import { tick } from "../src/sim/88-tick/tick";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const done = (s: GameState) => Object.keys(CHECKS).filter((id) => checkDone(s, id));

describe("checklist", () => {
  it("starts with nothing done", () => {
    const s = newGame(1);
    expect(s.checklist).toEqual([]);
    expect(done(s)).toEqual([]);
  });

  it("detects a loan, the first and second online server and datacenter space", () => {
    const s = { ...newGame(1), cash: 100_000 };
    ok(takeLoan(s, 10_000, 1));
    const [a, b] = [1, 2].map((slot) => {
      const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
      ok(mountDevice(s, srv, "rack2", slot));
      return srv;
    });
    expect(done(s)).toEqual(["loan"]);
    ok(connect(s, { device: a, port: 0 }, { device: "dev5", port: 0 }));
    expect(done(s)).toEqual(["loan", "firstServer"]);
    ok(connect(s, { device: b, port: 0 }, { device: "dev5", port: 1 }));
    expect(done(s)).toEqual(["loan", "firstServer", "secondServer"]);
    ok(addLocation(s, "interaction-fra", "positions", 1));
    expect(done(s)).toEqual(["loan", "firstServer", "secondServer", "datacenter"]);
  });

  it("detects a datacenter cluster that sells", () => {
    const s = { ...newGame(1), cash: 100_000 };
    const loc = ok(addLocation(s, "hetzler-park", "share", 4));
    const srv = ok(buyDevice(s, "g1-memory", "Dwell", 1, loc));
    ok(mountDevice(s, srv, s.racks.find((r) => r.locationId === loc)!.id, 1));
    ok(connect(s, { device: srv, port: 0 }, { device: s.devices.find((d) => d.panel === loc)!.id, port: 0 }));
    const c = ok(createCluster(s, loc, "Rack 1"));
    ok(addNode(s, c, srv));
    for (let h = 0; h < 72; h++) tick(s);
    expect(checkDone(s, "dcCluster")).toBe(false);
    ok(setSoftware(s, c, "proxmocks"));
    for (let h = 0; h < 6; h++) tick(s);
    expect(checkDone(s, "dcCluster")).toBe(true);
  });

  it("ticks and unticks goals by hand", () => {
    const s = newGame(1);
    toggleCheck(s, "hire");
    expect(checkDone(s, "hire")).toBe(true);
    toggleCheck(s, "hire");
    expect(checkDone(s, "hire")).toBe(false);
  });

  it("keeps ticks in saves and loads old saves without them", () => {
    const s = newGame(1);
    toggleCheck(s, "exchange");
    expect(deserialize(serialize(s)).checklist).toEqual(["exchange"]);
    const { checklist: _, ...old } = newGame(1);
    expect(deserialize(JSON.stringify(old)).checklist).toEqual([]);
  });
});
