import { describe, expect, it } from "vitest";
import { fadeDrain, resourcesOf, titleById, weightAt } from "../src/sim/10-catalog/games";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { gameOf, titleCounts } from "../src/sim/60-infra/games";
import { gamesTick } from "../src/sim/85-products/games-tick";
import { changeTitle, installMod } from "../src/sim/90-actions/games";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function game(title: string, year: number) {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, year);
  const cluster = panelServer(s, two, "tcadmen"), customer = addCustomer(s, "Ada Lang", "hobbyDev");
  const id = ok(provisionService(s, customer, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, year), clusterId: cluster, title }));
  s.hour += 24 * 40;
  return { s, id, c: s.customers.find((x) => x.id === customer)! };
}

describe("faded titles", () => {
  it("lose order weight and drain happiness from the year after the fade, doubling up to a cap", () => {
    const t = titleById("quackiii")!;
    expect(weightAt(t, t.fade)).toBe(t.weight);
    expect(weightAt(t, t.fade + 3)).toBeLessThan(weightAt(t, t.fade + 1));
    expect(fadeDrain(t, t.fade)).toBe(0);
    expect(fadeDrain(t, t.fade + 1)).toBeCloseTo(0.05);
    expect(fadeDrain(t, t.fade + 2)).toBeCloseTo(0.1);
    expect(fadeDrain(t, t.fade + 9)).toBe(0.4);
  });

  it("cost the customer happiness every hour of a day once faded", () => {
    const current = game("counterstrife", 2011), faded = game("counterstrife", 2013);
    for (const x of [current, faded]) { x.c.happiness = 70; for (let i = 0; i < 24; i++) { x.s.hour++; gamesTick(x.s); } }
    expect(current.c.happiness).toBeCloseTo(70, 5);
    expect(faded.c.happiness).toBeCloseTo(70 - 0.05, 3);
  });

  it("are moved with slots kept in resources, mods cleared and the customer pleased", () => {
    const { s, id, c } = game("counterstrife", 2013);
    ok(installMod(s, id, "metamix"));
    const before = gameOf(s, id)!, from = titleById("counterstrife")!;
    c.happiness = 60;
    ok(changeTitle(s, id, "teamfortune"));
    const g = gameOf(s, id)!, to = titleById("teamfortune")!;
    expect(g.title).toBe("teamfortune");
    expect(g.mods).toEqual([]);
    expect(c.happiness).toBeCloseTo(63, 5);
    expect(g.version).toBe(to.releases.filter((y) => y <= 2013).length - 1);
    expect(resourcesOf(to, g.slots!).ramGb).toBeLessThanOrEqual(resourcesOf(from, before.slots!).ramGb + 1e-9);
    expect(resourcesOf(to, g.slots! + 1).ramGb).toBeGreaterThan(resourcesOf(from, before.slots!).ramGb - 1e-9);
  });

  it("refuse a title that is not current, the same title or a unit that is not a game", () => {
    const { s, id } = game("counterstrife", 2013);
    expect(changeTitle(s, id, "quackiii").ok).toBe(false);
    expect(changeTitle(s, id, "pallworld").ok).toBe(false);
    expect(changeTitle(s, id, "counterstrife").ok).toBe(false);
    expect(changeTitle(s, id, "nope").ok).toBe(false);
    expect(changeTitle(s, "svc-none", "blockcraft").ok).toBe(false);
  });

  it("show in the Titles summary with the faded flag", () => {
    const { s } = game("counterstrife", 2013);
    expect(titleCounts(s)).toEqual([{ title: "counterstrife", count: 1, faded: true }]);
  });
});
