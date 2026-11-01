import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";

const runTo = (s: ReturnType<typeof newGame>, hour: number) => { while (s.hour < hour) tick(s); };

describe("customer trend", () => {
  it("records nothing before the first customer", () => {
    const s = newGame(3);
    runTo(s, 72);
    expect(s.trend).toEqual([]);
  });
  it("adds one reading per day with the live count and mean happiness", () => {
    const s = newGame(3);
    const a = addCustomer(s, "A", "private"), b = addCustomer(s, "B", "private");
    s.customers[0].happiness = 60;
    s.customers[1].happiness = 81;
    runTo(s, 48);
    expect(s.trend.map((p) => p.hour)).toEqual([24, 48]);
    expect(s.trend[0]).toMatchObject({ customers: 2, happiness: 70.5 });
    s.customers.find((c) => c.id === b)!.churnedAt = s.hour;
    runTo(s, 72);
    expect(s.trend[2]).toMatchObject({ customers: 1 });
    expect(a).not.toBe(b);
  });
  it("loads from a save without a trend", () => {
    const s = newGame(3);
    const data = JSON.parse(serialize(s));
    delete data.trend;
    expect(deserialize(JSON.stringify(data)).trend).toEqual([]);
  });
});
