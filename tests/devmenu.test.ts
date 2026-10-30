import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { runLine } from "../src/sim/60-infra/terminal";
import type { GameState } from "../src/sim/50-state";
import { runAction } from "../src/sim/90-actions/index";
import type { Call } from "../src/sim/90-actions/index";
import { SKILLS } from "../src/sim/10-catalog/research";
import { setDate, setKnowHow, setMoney, unlockAllResearch } from "../src/sim/90-actions/dev";
import { readyGame } from "./fixtures";

const fresh = (): GameState => structuredClone(readyGame(3));
const at = (y: number, m: number, d: number, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

describe("sudo dev", () => {
  const line = (s: GameState, l: string) => runLine(() => s, ([fn, ...args]: Call) => fn(s, ...args), null, null, l);

  it("opens the dev menu from the desk", () => {
    expect(line(fresh(), "sudo dev").dev).toBe(true);
  });

  it("leaves other sudo commands alone", () => {
    const s = fresh();
    expect(line(s, "sudo dev now").dev).toBe(false);
    expect(line(s, "sudo").dev).toBe(false);
  });
});

describe("dev actions", () => {
  it("sets the date and the hour of the day", () => {
    const s = fresh();
    s.minute = 30;
    expect(setDate(s, "2008-03-01").ok).toBe(true);
    expect(s.hour).toBe(at(2008, 3, 1));
    expect(s.minute).toBe(0);
    expect(setDate(s, "2010-12-31", 14).ok).toBe(true);
    expect(s.hour).toBe(at(2010, 12, 31, 14));
  });

  it("refuses a bad date and keeps the clock", () => {
    const s = fresh(), before = s.hour;
    for (const [d, h] of [["soon", 0], ["2008-02-30", 0], ["2004-12-31", 0], ["2008-03-01", 24], ["2008-03-01", NaN]] as const) {
      expect(setDate(s, d, h).ok).toBe(false);
    }
    expect(s.hour).toBe(before);
  });

  it("sets the money, negative and with cents", () => {
    const s = fresh();
    setMoney(s, 50000);
    expect(s.cash).toBe(50000);
    setMoney(s, -120.456);
    expect(s.cash).toBe(-120.46);
    expect(setMoney(s, NaN).ok).toBe(false);
    expect(s.cash).toBe(-120.46);
  });

  it("sets the research points to a whole number of 0 or more", () => {
    const s = fresh();
    expect(setKnowHow(s, 120.4).ok).toBe(true);
    expect(s.knowHow).toBe(120);
    expect(setKnowHow(s, -1).ok).toBe(false);
    expect(setKnowHow(s, NaN).ok).toBe(false);
    expect(s.knowHow).toBe(120);
  });

  it("unlocks all research once and drops a training in progress", () => {
    const s = fresh();
    s.unlocks = ["monitoring"];
    s.training = { id: "people", doneAt: s.hour + 100 };
    expect(unlockAllResearch(s).ok).toBe(true);
    expect([...s.unlocks].sort()).toEqual(SKILLS.map((k) => k.id).sort());
    expect(s.training).toBeNull();
    unlockAllResearch(s);
    expect(s.unlocks.length).toBe(SKILLS.length);
  });

  it("can be replayed from the action log", () => {
    const s = fresh();
    expect(runAction(s, "setMoney", [777]).ok).toBe(true);
    expect(runAction(s, "setKnowHow", [9]).ok).toBe(true);
    expect(runAction(s, "setDate", ["2007-07-07", 3]).ok).toBe(true);
    expect([s.cash, s.knowHow, s.hour]).toEqual([777, 9, at(2007, 7, 7, 3)]);
  });
});
