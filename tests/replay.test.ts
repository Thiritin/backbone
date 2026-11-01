import { newGame } from "./fixtures";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { challengeById, challengeFor, CHALLENGES, isoWeek, weeklyChallenge } from "../src/sim/10-catalog/challenges";
import { capacityAt, DATACENTERS } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { SCORE_END, scores } from "../src/sim/80-business/scores";
import { ACTIONS, actionName, LOG_CAP, runAction } from "../src/sim/90-actions/index";
import { installPanel } from "../src/sim/90-actions/clusters";
import { setCompany } from "../src/sim/90-actions/company";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { savingsOf } from "../src/sim/46-finance/bank";
import { buyDevice, connect, mountDevice, orderHomeLine, setPlugged } from "../src/sim/90-actions/hardware";
import { startChallenge } from "../src/sim/90-actions/start";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buildLeaderboard, mismatches, replay, runFile, runFileName, verify, type Verified } from "../src/sim/92-run/run";
import { POWER_ACTION } from "../src/ui/apps/locations/power";
import { useStore } from "../src/ui/store";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const store = useStore.getState;
const play = (hours: number) => {
  const until = store().game.hour + hours;
  while (store().game.hour < until && store().game.gameOver === null) store().advance(until - store().game.hour);
};

// The first server through the store, as the player does it: bought, delivered, mounted, plugged, cabled, online, a panel.
function shortGame(): GameState {
  useStore.setState({ game: startChallenge("2026-W43") });
  ok(store().act(openBankAccount, "sparklasse"));
  ok(store().act(setCompany, { name: "Kellerkind Hosting", color: "oklch(0.65 0.17 50)" }));
  const srv = ok(store().act(buyDevice, "g1-compute", "Dwell", 1, "loc1"));
  play(24 * 6);
  ok(store().act(mountDevice, srv, "rack2", 1));
  for (const c of store().game.devices.find((d) => d.id === srv)!.components) if (c.kind === "psu") ok(store().act(setPlugged, srv, c.id, true));
  ok(store().act(mountDevice, "dev5", "rack2", 24));
  ok(store().act(connect, { device: "dev5", port: 4 }, { device: "dev6", port: 0 }));
  ok(store().act(connect, { device: srv, port: 0 }, { device: "dev5", port: 0 }));
  ok(store().act(orderHomeLine, "dsl-16"));
  play(24 * 9);
  ok(store().act(installPanel, srv, "freepanel"));
  play(24 * 20);
  return store().game;
}

describe("action log", () => {
  it("logs every successful action from the store and skips failed ones", () => {
    const s = shortGame();
    const psus = s.log.filter((e) => e.name === "setPlugged").length;
    expect(psus).toBeGreaterThan(0);
    expect(s.log.map((e) => e.name)).toEqual(["openBankAccount", "setCompany", "buyDevice", "mountDevice", ...Array(psus).fill("setPlugged"), "mountDevice", "connect", "connect", "orderHomeLine", "installPanel"]);
    expect(s.log[2]).toEqual({ hour: 0, minute: 0, name: "buyDevice", args: ["g1-compute", "Dwell", 1, "loc1"] });
    expect(store().act(mountDevice, "nope", "rack2", 1).ok).toBe(false);
    expect(store().game.log).toHaveLength(s.log.length);
  });

  it("stops logging at the cap", () => {
    const s = newGame(1);
    s.log = Array.from({ length: LOG_CAP }, () => ({ hour: 0, name: "toggleCheck", args: ["x"] }));
    ok(runAction(s, "setCompany", [{ tagline: "Hi" }]));
    expect(s.log).toHaveLength(LOG_CAP);
  });

  it("has every action the UI hands the store in ACTIONS", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
    const bad: string[] = [];
    for (const f of files("src/ui").filter((x) => /\.tsx?$/.test(x))) {
      const src = readFileSync(f, "utf8");
      const alias = new Map([...src.matchAll(/(\w+) as (\w+)/g)].map((m) => [m[2], m[1]]));
      for (const m of src.matchAll(/\bact\(([^,)]*)/g)) {
        const arg = m[1].trim();
        if (/^\(|^async|=>/.test(arg)) bad.push(`${f}: ${m[0]}`);
        else if (/^\w+$/.test(arg) && !((alias.get(arg) ?? arg) in ACTIONS) && arg !== "fn") bad.push(`${f}: ${arg}`);
      }
    }
    expect(bad).toEqual([]);
    for (const fn of Object.values(POWER_ACTION)) expect(actionName(fn)).toBeDefined();
  });

  it("loads an old save with an empty log, no challenge and no scores", () => {
    const old = JSON.parse(serialize(newGame(5)));
    for (const k of ["log", "challenge", "score"]) delete old[k];
    const s = deserialize(JSON.stringify(old));
    expect(s.log).toEqual([]);
    expect(s.challenge).toBeNull();
    expect(s.score).toEqual(newGame(5).score);
  });
});

describe("replay", () => {
  it("replays a short game from its log to the same state", () => {
    const s = shortGame();
    expect(s.customers.length).toBeGreaterThan(0);
    const again = replay(runFile(s, "test"), undefined, s.hour);
    expect(serialize(again)).toEqual(serialize({ ...s, log: s.log.filter((e) => e.hour < SCORE_END) }));
    // A reload in between changes nothing either.
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it("verifies honest scores at the end of 2007 and fails an edited claim", () => {
    const short = runFile(shortGame(), "test");
    const end = replay(short);
    expect(end.hour).toBe(SCORE_END);
    expect(scores(end).netWorth).not.toBeNull();
    const run = runFile(end, "test");
    expect(run.claimed).toEqual(scores(end));
    // The claim only feeds the comparison, so one replay of an edited claim also shows the honest one passes.
    const { verified, errors } = verify({ ...run, claimed: { ...run.claimed, netWorth: run.claimed.netWorth! + 500 } });
    expect(errors).toHaveLength(1);
    expect(mismatches(run.claimed, verified.scores)).toEqual([]);
    expect(verified.company.name).toBe("Kellerkind Hosting");
    expect(verified.ghost.length).toBeGreaterThan(100);
    expect(() => replay({ ...run, seed: run.seed + 1 })).toThrow();
    expect(() => replay({ ...run, actions: [{ ...run.actions[0], name: "noSuchAction" }] })).toThrow();
    expect(runFileName(end)).toBe(`kellerkind-hosting-${end.seed}.run.json`);
  }, 120_000);

  it("ranks runs per build and challenge and keeps the net worth leader's ghost", () => {
    const run = (name: string, netWorth: number | null, level3: number | null): Verified => ({
      version: "abc", challenge: "2026-W44", company: { name, color: "red", logo: "server" }, seed: 1, scores: { netWorth, level3, happiness: 80 }, ghost: [[0, 0, netWorth ?? 0]],
    });
    const board = buildLeaderboard([run("A", 100, 900), run("B", 300, null), run("C", 200, 500)]).abc["2026-W44"];
    expect(board.netWorth.map((e) => e.company)).toEqual(["B", "C", "A"]);
    expect(board.level3.map((e) => e.company)).toEqual(["C", "A"]);
    expect(board.ghost).toEqual([[0, 0, 300]]);
  });
});

describe("weekly challenges", () => {
  it("derives a stable seed and twist from the ISO week", () => {
    const thu = weeklyChallenge(new Date("2026-10-29T12:00:00Z"));
    expect(thu.id).toBe("2026-W44");
    expect(weeklyChallenge(new Date("2026-10-26T00:00:00Z"))).toEqual(thu);
    expect(weeklyChallenge(new Date("2026-11-01T23:59:00Z"))).toEqual(thu);
    expect(weeklyChallenge(new Date("2026-11-02T00:00:00Z")).id).toBe("2026-W45");
    expect(thu.seed).toBe(challengeFor(2026, 44).seed);
    expect(thu.seed).toBe(3_719_624_282);
    expect(thu.twist).toBe(CHALLENGES[44 % 3]);
    expect(isoWeek(new Date("2021-01-01T00:00:00Z"))).toEqual({ year: 2020, week: 53 });
    expect(challengeById("2026-W44")).toEqual(thu);
    expect(challengeById("2026-W99")).toBeNull();
  });

  it("starts each twist", () => {
    const line = startChallenge("2026-W42"), dc = startChallenge("2026-W43"), cash = startChallenge("2026-W44");
    expect(line.homeLine).toEqual({ id: "sdsl-2", next: null });
    expect(cash.cash).toBe(0);
    expect(savingsOf(cash)).toBe(2000);
    expect(cash.challenge).toBe("2026-W44");
    for (const d of DATACENTERS) if (d.id !== "hetzler-park") expect(dc.dcs[d.id].others).toBe(capacityAt(d, 2005));
    expect(dc.dcs["hetzler-park"].others).toBeLessThan(capacityAt(DATACENTERS.find((d) => d.id === "hetzler-park")!, 2005));
  });
});
