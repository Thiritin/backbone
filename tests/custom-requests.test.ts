import { describe, expect, it } from "vitest";
import { tick } from "../src/sim/88-tick/tick";
import { setCustom, setCustomRequests, setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, readyGame } from "./fixtures";

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

  it("per line: a line without custom requests sells its plans only", () => {
    const leads = (on: boolean) => {
      let custom = 0, orders = 0;
      for (const seed of [1, 2]) {
        const s = readyGame(seed);
        s.marketing = { ...s.marketing, lines: [], customRequests: false, awareness: { ...s.marketing.awareness, smallBiz: 0.3 } };
        setLine(s, "webHosting", true);
        setCustom(s, "webHosting", on);
        for (let h = 0; h < 24 * 30; h++) tick(s);
        for (const r of s.sales.requests.filter((r) => r.customerId === null)) r.sla === "basic" ? orders++ : custom++;
      }
      return { custom, orders };
    };
    expect(leads(true).custom).toBeGreaterThan(0);
    expect(leads(false)).toMatchObject({ custom: 0 });
    expect(leads(false).orders).toBeGreaterThan(0);
  }, 90_000);

  it("per line: saves from before the switch take custom requests on every line", () => {
    const s = newGame(1), data = JSON.parse(serialize(s));
    delete data.marketing.custom;
    expect(deserialize(JSON.stringify(data)).marketing.custom).toContain("webHosting");
    expect(setCustom(s, "domain", false)).toEqual({ ok: false, error: "error.unknownSiteLine" });
  });
});
