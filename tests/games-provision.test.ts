import { describe, expect, it } from "vitest";
import { titleById } from "../src/sim/10-catalog/games";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { type GameState } from "../src/sim/50-state";
import { gameOf } from "../src/sim/60-infra/games";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice, hypervisor, panelServer, skipTo, withServer, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function start(y: number) {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, y);
  return { s, two };
}
const order = (s: GameState, clusterId: string, title?: string) => {
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  return ok(provisionService(s, cus, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, 2016), clusterId, title }));
};

describe("game server provisioning", () => {
  it("gives a TCAdmen server a title and slots that fit the booked RAM", () => {
    const { s, two } = start(2016), tc = panelServer(s, two, "tcadmen"), id = order(s, tc, "counterstrife");
    const g = gameOf(s, id)!, t = titleById("counterstrife")!, w = workloadsOf(s, id)[0];
    expect(g.title).toBe("counterstrife");
    expect(g.slots).toBeGreaterThan(0);
    expect(g.slots! * t.perSlot.ramGb).toBeLessThanOrEqual(w.ramGb + 1e-9);
    expect(g.slots).toBeLessThanOrEqual(t.slots[1]);
    expect(g.auto).toBe(true);
  });

  it("sells RAM on MultiKraft and Pterodaktyl: a title, no slots, crash restart on Pterodaktyl", () => {
    const { s, two } = start(2016), mk = panelServer(s, two, "multikraft"), pt = panelServer(s, "dev3", "pterodaktyl");
    const a = gameOf(s, order(s, mk))!, b = gameOf(s, order(s, pt))!;
    expect([a.slots, b.slots]).toEqual([null, null]);
    expect(titleById(a.title)).toBeDefined();
    expect(b.auto).toBe(true);
  });

  it("draws a title of the year when none is named, the same on a rerun", () => {
    const run = () => { const { s, two } = start(2016); return gameOf(s, order(s, panelServer(s, two, "tcadmen")))!.title; };
    expect(run()).toBe(run());
    expect(titleById(run())!.from).toBeLessThanOrEqual(2016);
  });

  it("leaves a hypervisor cluster with no title", () => {
    const { s } = start(2016), cloud = hypervisor(s, ["dev3"], "Cloud 1"), id = order(s, cloud);
    expect(gameOf(s, id)).toBeNull();
    expect(s.gameServers).toEqual([]);
  });

  it("starts without auto-restart before MultiKraft exists", () => {
    const { s, two } = start(2005), id = order(s, panelServer(s, two, "tcadmen"));
    expect(gameOf(s, id)!.auto).toBe(false);
  });
});
