import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("tick", () => {
  it("emits a month event on the first hour of each month", () => {
    const s = newGame(1);
    const events = [];
    for (let h = 0; h < 24 * 31; h++) events.push(...tick(s));
    expect(events.map((e) => e.key)).toEqual(["event.monthStart", "event.bills"]);
    expect(events[0]).toEqual({ app: "Finance", key: "event.monthStart", params: { month: 1, year: 2005 } });
  });
});

describe("save", () => {
  it("round-trips a game", () => {
    const s = newGame(9);
    for (let h = 0; h < 100; h++) tick(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("repairs a save that lacks newer fields", () => {
    const repaired = deserialize(JSON.stringify({ seed: 4, hour: 50 }));
    expect(repaired.hour).toBe(50);
    expect(repaired.cash).toBe(5000);
    expect(repaired.rng.s).toBe(4);
  });
  it("rejects garbage", () => {
    expect(() => deserialize("{}")).toThrow();
  });
});
