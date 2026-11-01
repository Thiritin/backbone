import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { HOME_LINES, homeLineById } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { orderHomeLine } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";

// A company on the DSL line in a year.
const atYear = (year: number): GameState => ({ ...newGame(1), hour: hourOf(new Date(Date.UTC(year, 0, 15))), homeLine: { id: "dsl-16", next: null } });
const err = (r: ReturnType<typeof orderHomeLine>) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};

describe("home line", () => {
  it("starts on Mom's free DSL, and every line on offer costs money", () => {
    const s = newGame(1);
    expect(s.homeLine).toEqual({ id: "moms-dsl", next: null });
    expect(homeLineById(s.homeLine.id)).toMatchObject({ name: "Mom's DSL", down: 6, up: 0.5, monthly: 0, staticIp: false });
    expect(homeLineById("")).toMatchObject({ name: "No line", up: 0 });
    expect(HOME_LINES.some((l) => l.id === "moms-dsl")).toBe(false);
    expect(homeLineById("dsl-16")).toMatchObject({ down: 16, up: 1, monthly: 45 });
    for (const l of HOME_LINES) expect(l.monthly).toBeGreaterThan(0);
  });

  it("orders the first line and bills it from the next month", () => {
    const s = newGame(1);
    expect(err(orderHomeLine(s, "dsl-16"))).toBe("ok");
    run(s, 24 * 7);
    expect(s.homeLine.id).toBe("dsl-16");
    run(s, 24 * 30);
    expect(s.ledger.filter((l) => l.key === "ledger.homeLine")).toEqual([expect.objectContaining({ amount: -45 })]);
  });

  it("rejects unknown, future, current and already ordered lines", () => {
    const s = atYear(2005);
    expect(err(orderHomeLine(s, "isdn"))).toBe("error.unknownLine");
    expect(err(orderHomeLine(s, "vdsl-50"))).toBe("error.lineNotYet");
    expect(err(orderHomeLine(s, "dsl-16"))).toBe("error.lineActive");
    expect(err(orderHomeLine(s, "sdsl-2"))).toBe("ok");
    expect(err(orderHomeLine(s, "sdsl-2"))).toBe("error.lineOrdered");
  });

  it("goes live after its install days and bills monthly", () => {
    const s = atYear(2014);
    const line = homeLineById("vdsl-100");
    orderHomeLine(s, line.id);
    expect(s.homeLine.next).toEqual({ id: line.id, at: s.hour + 24 * line.installDays });
    const before = run(s, 24 * line.installDays - 1);
    expect(s.homeLine.id).toBe("dsl-16");
    expect(before.some((e) => e.key === "event.lineReady")).toBe(false);
    expect(run(s, 1)).toContainEqual({ app: "Locations", key: "event.lineReady", params: { line: line.name, isp: line.isp } });
    expect(s.homeLine).toEqual({ id: line.id, next: null });
    run(s, 24 * 20);
    const bills = s.ledger.filter((l) => l.key === "ledger.homeLine");
    expect(bills).toEqual([expect.objectContaining({ category: "rent", amount: -line.monthly, params: { line: line.name, isp: line.isp } })]);
  });

  it("cancels a pending switch when the current line is ordered again", () => {
    const s = atYear(2005);
    orderHomeLine(s, "sdsl-2");
    expect(err(orderHomeLine(s, "dsl-16"))).toBe("ok");
    expect(s.homeLine).toEqual({ id: "dsl-16", next: null });
  });
  it("cancels an order and keeps Mom's DSL, which cannot be ordered back", () => {
    const s = newGame(1);
    orderHomeLine(s, "dsl-16");
    expect(err(orderHomeLine(s, "moms-dsl"))).toBe("ok");
    expect(s.homeLine).toEqual({ id: "moms-dsl", next: null });
    s.homeLine = { id: "dsl-16", next: null };
    expect(err(orderHomeLine(s, "moms-dsl"))).toBe("error.unknownLine");
  });

  it("bills nothing before the first line", () => {
    const s = newGame(1);
    run(s, 24 * 40);
    expect(s.ledger.some((l) => l.key === "ledger.homeLine")).toBe(false);
  });

  it("fills the default line for saves without one", () => {
    const raw = JSON.parse(serialize(atYear(2010)));
    delete raw.homeLine;
    expect(deserialize(JSON.stringify(raw)).homeLine).toEqual({ id: "dsl-16", next: null });
  });

  it("offers every line with a unique id and an upload no faster than its download", () => {
    expect(new Set(HOME_LINES.map((l) => l.id)).size).toBe(HOME_LINES.length);
    for (const l of HOME_LINES) expect(l.up).toBeLessThanOrEqual(l.down);
  });
});
