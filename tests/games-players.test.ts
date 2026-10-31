import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { FULL_BOOST, FULL_HOURS, fullBoost, gameOf, growSlots, playersOf } from "../src/sim/60-infra/games";
import { gamesTick } from "../src/sim/85-products/games-tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function game() {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, 2016);
  const cluster = panelServer(s, two, "tcadmen"), customer = addCustomer(s, "Ada Lang", "hobbyDev");
  const id = ok(provisionService(s, customer, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, 2016), clusterId: cluster, title: "blockcraft" }));
  s.hour += 24 * 40;
  return { s, id, customer };
}
const hours = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

describe("players online", () => {
  it("fill a server in the weekend evening and leave it emptier on a weekday morning", () => {
    const { s, id } = game(), span = hours(s.hour, 24 * 28);
    const at = (pick: (h: number) => boolean) => span.filter(pick).map((h) => playersOf(s, id, h)!.players);
    const peak = at((h) => h % 24 === 20), dawn = at((h) => h % 24 === 5);
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
    expect(mean(peak)).toBeGreaterThan(mean(dawn));
    expect(Math.max(...peak)).toBeGreaterThan(Math.max(...dawn));
    expect(playersOf(s, id)!.players).toBeLessThanOrEqual(gameOf(s, id)!.slots!);
  });

  it("mark the hour the server was full and boost the upgrade chance for a week", () => {
    const { s, id, customer } = game();
    expect(fullBoost(s, customer)).toBe(1);
    const full = hours(s.hour, 24 * 28).find((h) => { const p = playersOf(s, id, h)!; return p.players >= p.slots; });
    expect(full).toBeDefined();
    s.hour = full!;
    gamesTick(s);
    expect(gameOf(s, id)!.seenFull).toBe(full);
    expect(fullBoost(s, customer)).toBe(FULL_BOOST);
    s.hour = full! + FULL_HOURS;
    expect(fullBoost(s, customer)).toBe(FULL_BOOST);
    s.hour = full! + FULL_HOURS + 1;
    expect(fullBoost(s, customer)).toBe(1);
  });

  it("grow the slots of an accepted upgrade in steps of four", () => {
    const { s, id } = game(), before = gameOf(s, id)!.slots!;
    growSlots(s, id, 1.5);
    const after = gameOf(s, id)!.slots!;
    expect(after % 4).toBe(0);
    expect(after).toBeGreaterThanOrEqual(before * 1.5);
    expect(after).toBeLessThan(before * 1.5 + 4);
  });
});
