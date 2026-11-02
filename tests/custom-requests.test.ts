import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { salesTick } from "../src/sim/30-market/sales";
import { setCustom, setCustomRequests, setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, readyGame } from "./fixtures";

// Only the sales step runs, as tick runs it after advancing the hour.
const step = (s: GameState) => { s.hour++; salesTick(s); };

const requests = (on: boolean) => {
  let n = 0;
  for (const seed of [1, 2, 3, 4]) {
    const s = newGame(seed);
    setCustomRequests(s, on);
    for (let h = 0; h < 24 * 60; h++) step(s);
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

  it("per line: a line without custom requests sells its plans only", () => {
    const leads = (on: boolean) => {
      let custom = 0, orders = 0;
      for (const seed of [1, 2, 3]) {
        const s = readyGame(seed);
        s.marketing = { ...s.marketing, lines: [], customRequests: false, awareness: { ...s.marketing.awareness, smallBiz: 1 } };
        setLine(s, "webHosting", true);
        setCustom(s, "webHosting", on);
        for (let h = 0; h < 24 * 60; h++) step(s);
        for (const r of s.sales.requests.filter((r) => r.customerId === null)) r.sla === "basic" ? orders++ : custom++;
      }
      return { custom, orders };
    };
    expect(leads(true).custom).toBeGreaterThan(0);
    const off = leads(false);
    expect(off.custom).toBe(0);
    expect(off.orders).toBeGreaterThan(0);
  });

  it("per line: saves from before the switch take custom requests on every line", () => {
    const s = newGame(1), data = JSON.parse(serialize(s));
    delete data.marketing.custom;
    expect(deserialize(JSON.stringify(data)).marketing.custom).toContain("webHosting");
    expect(setCustom(s, "domain", false)).toEqual({ ok: false, error: "error.unknownSiteLine" });
  });
});
