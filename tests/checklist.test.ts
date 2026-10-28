import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { CHECKS, checkDone } from "../src/sim/checklist";
import { takeLoan } from "../src/sim/90-actions/billing";
import { toggleCheck } from "../src/sim/90-actions/checklist";
import { addLocation, buyDevice, connect } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { deserialize, serialize } from "../src/sim/91-save/save";

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

  it("detects a loan, a second online server and datacenter space", () => {
    const s = { ...newGame(1), cash: 100_000 };
    ok(takeLoan(s, 10_000, 1));
    const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, srv, "rack2", 2));
    expect(done(s)).toEqual(["loan"]);
    ok(connect(s, { device: srv, port: 0 }, { device: "dev4", port: 1 }));
    expect(done(s)).toEqual(["loan", "secondServer"]);
    ok(addLocation(s, "interaction-fra", "positions", 1));
    expect(done(s)).toEqual(["loan", "secondServer", "datacenter"]);
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
