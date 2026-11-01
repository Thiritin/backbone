import { describe, expect, it } from "vitest";
import { MODS, releaseHour, titleById } from "../src/sim/10-catalog/games";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { dateOf } from "../src/sim/00-core/time";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { gameOf, NO_RESTART } from "../src/sim/60-infra/games";
import { crashChance, gamesTick } from "../src/sim/85-products/games-tick";
import { workloadUse } from "../src/sim/60-infra/usage";
import { tick } from "../src/sim/88-tick/tick";
import { installMod, removeMod, restartGame, setAutoRestart, setGameVersion, setRestartSchedule, updateGameVersion } from "../src/sim/90-actions/games";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function game(title: string, year = 2018, panel: "tcadmen" | "multikraft" = "tcadmen") {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, year);
  const cluster = panelServer(s, two, panel), customer = addCustomer(s, "Ada Lang", "hobbyDev");
  const id = ok(provisionService(s, customer, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, year), clusterId: cluster, title }));
  s.hour += 24 * 40;
  const c = s.customers.find((x) => x.id === customer)!;
  return { s, id, c };
}
const run = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.hour++; gamesTick(s); } };
const at = (s: GameState, hourOfDay: number, day?: number): void => {
  while (dateOf(s.hour).getUTCHours() !== hourOfDay || (day !== undefined && dateOf(s.hour).getUTCDay() !== day)) s.hour++;
};

describe("crashes", () => {
  it("happen a few times a year on a plain server", () => {
    const { s, id } = game("teamfortune", 2016);
    run(s, 24 * 365);
    expect(gameOf(s, id)!.crashes).toBeGreaterThan(2);
    expect(gameOf(s, id)!.crashes).toBeLessThan(18);
  });

  it("restart at once with auto-restart on", () => {
    const { s, id } = game("counterstrife", 2018);
    expect(gameOf(s, id)!.auto).toBe(true);
    let seen = 0;
    for (let i = 0; i < 24 * 365 && !seen; i++) { run(s, 1); seen = gameOf(s, id)!.crashes; }
    expect(seen).toBe(1);
    expect(gameOf(s, id)!.crashedAt).toBeNull();
    expect(serviceOnline(s, id)).toBe(true);
  });

  it("take the server down and upset the customer with auto-restart off until the player restarts it", () => {
    const { s, id, c } = game("counterstrife", 2018);
    ok(setAutoRestart(s, id, false));
    c.happiness = 80;
    for (let i = 0; i < 24 * 365 && gameOf(s, id)!.crashedAt === null; i++) { gamesTick(s); if (gameOf(s, id)!.crashedAt === null) { s.hour++; } }
    expect(gameOf(s, id)!.crashedAt).not.toBeNull();
    expect(serviceOnline(s, id)).toBe(false);
    for (let i = 0; i < 24 * 10; i++) tick(s);
    expect(s.customers.find((x) => x.id === c.id)!.happiness).toBeLessThan(80);
    expect(s.tickets.some((t) => t.kind === "outage" && t.serviceId === id)).toBe(true);
    ok(restartGame(s, id));
    expect(serviceOnline(s, id)).toBe(true);
  });

  it("grow with mods, broken mods and memory leaks", () => {
    const { s, id } = game("blockcraft", 2020);
    const g = () => gameOf(s, id)!, base = crashChance(s, g());
    ok(installMod(s, id, "essentiel"));
    expect(crashChance(s, g())).toBeCloseTo(base * 1.25, 10);
    ok(setGameVersion(s, id, 2));
    ok(installMod(s, id, "bukkaboo"));
    const two = crashChance(s, g());
    ok(setGameVersion(s, id, 3));
    expect(crashChance(s, g())).toBeCloseTo(two * 3, 10);
    s.gameServers = s.gameServers.map((x) => ({ ...x, leak: 0.5 }));
    expect(crashChance(s, g())).toBeCloseTo(two * 3 * 2, 10);
  });
});

describe("scheduled restarts", () => {
  const leaky = (s: GameState, id: string) => { s.gameServers = s.gameServers.map((x) => ({ ...x, leak: 0.6 })); return gameOf(s, id)!; };

  it("at 04:00 reset the leak and cost nothing", () => {
    const { s, id, c } = game("counterstrife");
    ok(setRestartSchedule(s, id, "daily", 4, 0));
    at(s, 3); leaky(s, id); c.happiness = 80;
    run(s, 1);
    expect(gameOf(s, id)!.leak).toBe(0);
    expect(c.happiness).toBeGreaterThan(79.7);
  });

  it("at 20:00 cost the customer happiness", () => {
    const { s, id, c } = game("counterstrife");
    ok(setRestartSchedule(s, id, "daily", 20, 0));
    at(s, 19); leaky(s, id); c.happiness = 80;
    run(s, 1);
    expect(gameOf(s, id)!.leak).toBe(0);
    expect(c.happiness).toBeLessThan(79.6);
  });

  it("weekly run only on their day and are validated", () => {
    const { s, id } = game("counterstrife");
    ok(setRestartSchedule(s, id, "weekly", 4, 2));
    at(s, 3, 3); leaky(s, id);
    run(s, 1);
    expect(gameOf(s, id)!.leak).toBeGreaterThan(0.5);
    at(s, 3, 2); run(s, 1);
    expect(gameOf(s, id)!.leak).toBe(0);
    expect(setRestartSchedule(s, id, "daily", 24, 0).ok).toBe(false);
  });

  it("default to off and old saves load without the field", () => {
    const { s, id } = game("counterstrife");
    expect(gameOf(s, id)!.restart).toEqual(NO_RESTART);
    const old = JSON.parse(serialize(s));
    for (const g of old.gameServers) for (const k of ["restart", "mods", "leak", "crashedAt", "crashes"]) delete g[k];
    const back = deserialize(JSON.stringify(old)).gameServers[0];
    expect(back.restart).toEqual(NO_RESTART);
    expect(back.mods).toEqual([]);
    expect(back.crashedAt).toBeNull();
  });
});

describe("versions", () => {
  const release = (s: GameState, id: string) => {
    const t = titleById(gameOf(s, id)!.title)!, rh = releaseHour(t, t.releases.length - 1);
    return rh;
  };

  it("send a wave of questions in the two weeks after a release", () => {
    const { s, id } = game("blockcraft", 2021);
    const rh = release(s, id);
    let found: number | null = null;
    for (let seed = 1; seed < 60 && found === null; seed++) {
      s.seed = seed; s.tickets = []; s.hour = rh - 1;
      s.gameServers = s.gameServers.map((x) => ({ ...x, version: 3 }));
      run(s, 24 * 20);
      found = s.tickets.find((t) => t.topic === "gameVersion")?.createdAt ?? null;
    }
    expect(found).not.toBeNull();
    expect(found! - rh).toBeLessThanOrEqual(14 * 24);
    expect(found!).toBeGreaterThanOrEqual(rh);
  });

  it("drain happiness after a month up to twelve points, then update", () => {
    const { s, id, c } = game("blockcraft", 2021);
    const rh = release(s, id);
    s.hour = rh - 1; c.happiness = 100;
    s.gameServers = s.gameServers.map((x) => ({ ...x, version: 3, auto: true }));
    const lost = () => 100 - c.happiness - 0.2 * gameOf(s, id)!.crashes;
    run(s, 24 * 30);
    expect(lost()).toBeLessThan(0.5);
    run(s, 24 * 10);
    expect(lost()).toBeGreaterThan(1.2);
    expect(lost()).toBeLessThan(1.8);
    run(s, 24 * 200);
    expect(lost()).toBeLessThan(12.5);
    expect(lost()).toBeGreaterThan(11.5);
    ok(updateGameVersion(s, id));
    expect(gameOf(s, id)!.version).toBe(4);

  });

  it("updating drops the mods the new version breaks", () => {
    const { s, id } = game("blockcraft", 2020);
    ok(setGameVersion(s, id, 2));
    ok(installMod(s, id, "bukkaboo"));
    ok(installMod(s, id, "essentiel"));
    ok(updateGameVersion(s, id));
    expect(gameOf(s, id)!.mods).toEqual(["essentiel"]);
  });
});

describe("mods", () => {
  it("multiply resource use, add happiness once and reject what does not fit", () => {
    const { s, id, c } = game("blockcraft", 2020);
    const w = workloadsOf(s, id)[0], before = workloadUse(s, w).vcpu;
    c.happiness = 50;
    ok(setGameVersion(s, id, 2));
    ok(installMod(s, id, "bukkaboo"));
    expect(workloadUse(s, w).vcpu).toBeCloseTo(before * 1.1, 8);
    expect(c.happiness).toBe(52);
    expect(installMod(s, id, "bukkaboo").ok).toBe(false);
    expect(installMod(s, id, "oxidize").ok).toBe(false);
    expect(installMod(s, id, "nope").ok).toBe(false);
    ok(removeMod(s, id, "bukkaboo"));
    expect(workloadUse(s, w).vcpu).toBeCloseTo(before, 8);
    expect(removeMod(s, id, "bukkaboo").ok).toBe(false);
  });

  it("only exist for titles in the catalog", () => {
    for (const m of MODS) for (const t of m.titles) expect(titleById(t)).toBeDefined();
  });
});
