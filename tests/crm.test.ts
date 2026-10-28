import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("customer happiness history", () => {
  it("records happiness at each month start and keeps the last 12", () => {
    const s = newGame(21);
    const id = addCustomer(s, "Gil", "office");
    const end = hourOf(new Date(Date.UTC(2006, 3, 1)));
    // Gil never leaves, so every month start records a value.
    while (s.hour < end) { tick(s); s.customers[0].churnedAt = null; }
    const c = s.customers.find((x) => x.id === id)!;
    expect(c.history).toHaveLength(12);
    expect(c.history.every((h) => h >= 0 && h <= 100)).toBe(true);
  });

  it("fills an empty history into customers of an old save", () => {
    const s = newGame(22);
    addCustomer(s, "Hal", "private");
    const old = JSON.parse(serialize(s));
    delete old.customers[0].history;
    expect(deserialize(JSON.stringify(old)).customers[0].history).toEqual([]);
  });
});
