import { describe, expect, it } from "vitest";
import { START_CASH } from "../src/sim/10-catalog/economy";
import { yearOf } from "../src/sim/00-core/time";
import { modelById } from "../src/sim/10-catalog/hardware";
import { presetPrice } from "../src/sim/10-catalog/parts";
import type { GameState } from "../src/sim/50-state";
import { linkStatus } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { createPanelVm, installPanel } from "../src/sim/90-actions/clusters";
import { installSoftware } from "../src/sim/90-actions/software";
import { connect, mountDevice, setPlugged } from "../src/sim/90-actions/hardware";
import { setPortShare } from "../src/sim/90-actions/lan";
import { buyDevice, bootedMachine, startGame } from "./fixtures";
import { checkDone } from "../src/sim/checklist";
import { skipTo } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

// The first server from the Shop to the home router: bought from the savings, put on the shelf, plugged in and cabled, online at
// once over Mom's DSL.
function firstServer(s: GameState): string {
  const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  expect(s.cash).toBe(START_CASH - presetPrice(modelById("g1-compute"), yearOf(s.hour), "Dwell"));
  ok(mountDevice(s, srv, "rack2", 1));
  expect(linkStatus(s, srv).online).toBe(false);
  for (const c of s.devices.find((d) => d.id === srv)!.components) if (c.kind === "psu") ok(setPlugged(s, srv, c.id, true));
  expect(checkDone(s, "mountRouter")).toBe(false);
  ok(connect(s, { device: srv, port: 0 }, { device: "dev5", port: 0 }));
  expect(linkStatus(s, srv).online).toBe(false);
  ok(connect(s, { device: "dev5", port: 4 }, { device: "dev6", port: 0 }));
  expect(checkDone(s, "mountRouter")).toBe(true);
  run(s, 1);
  expect(linkStatus(s, srv).online).toBe(true);
  ok(setPortShare(s, "dev5", srv, "web"));
  return srv;
}

describe("first server", () => {
  it("starts with the basement shelf, the line jack and the flat's router on the shelf", () => {
    const s = startGame(1);
    expect(s.cash).toBe(START_CASH);
    expect(s.devices.map((d) => [modelById(d.model).kind, d.store, d.panel])).toEqual([["gateway", null, null], ["jack", null, "loc1"]]);
    expect(s.racks.map((r) => r.locationId)).toEqual(["loc1"]);
    expect(s.cables).toEqual([]);
    expect(s.customers).toEqual([]);
  });

  it("brings a bought server online and opens a panel server with no friends moving in", () => {
    const s = startGame(2);
    const srv = firstServer(s);
    expect(checkDone(s, "firstServer")).toBe(true);
    run(s, 24);
    ok(installPanel(s, srv, "freepanel"));
    run(s, 24);
    expect(s.customers.filter((c) => c.habit === "friend")).toEqual([]);
    expect(s.webOpenedAt).not.toBeNull();
    expect(checkDone(s, "setup")).toBe(true);
  });

  it("opens the panel VM of a hypervisor with no friends moving in", () => {
    const s = startGame(3);
    skipTo(s, 2010);
    const srv = firstServer(s);
    const c = ok(installSoftware(s, bootedMachine(s, srv), "proxmocks"));
    ok(createPanelVm(s, c, "freepanel"));
    run(s, 24 * 7);
    expect(s.customers.filter((c) => c.habit === "friend")).toEqual([]);
    expect(s.clusters.find((x) => x.vm)!.panel).toBe("freepanel");
  });
});
