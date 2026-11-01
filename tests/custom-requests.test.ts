import { describe, expect, it } from "vitest";
import { tick } from "../src/sim/88-tick/tick";
import { setCustomRequests } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const requests = (on: boolean) => {
  let n = 0;
  for (const seed of [1, 2, 3, 4]) {
    const s = newGame(seed);
    setCustomRequests(s, on);
    for (let h = 0; h < 24 * 60; h++) tick(s);
    n += s.sales.requests.filter((r) => !s.marketing.lines.includes(r.product)).length;
  }
  return n;
};

describe("custom requests", () => {
  it("arrive for products you do not sell, and stop when switched off", () => {
    expect(requests(true)).toBeGreaterThan(0);
    expect(requests(false)).toBe(0);
  });

  it("are on for saves from before the switch", () => {
    const s = newGame(1), data = JSON.parse(serialize(s));
    delete data.marketing.customRequests;
    expect(deserialize(JSON.stringify(data)).marketing.customRequests).toBe(true);
  });
});
