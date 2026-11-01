import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { BURNIN_BONUS_HOURS, BURNIN_FACTOR, REFUND_HOURS } from "../src/sim/10-catalog/burnin";
import { COMPONENTS } from "../src/sim/10-catalog/hardware";
import type { Listing } from "../src/sim/10-catalog/used";
import { type Device, type GameState } from "../src/sim/50-state";
import { burninTick } from "../src/sim/60-infra/burnin";
import { busyDevices, drawWatts, HOURS_PER_YEAR } from "../src/sim/60-infra/status";
import { serverTaken } from "../src/sim/60-infra/cluster";
import { failComponents, failureChance, tick, type SimEvent } from "../src/sim/88-tick/tick";
import { usedTick } from "../src/sim/80-business/used";
import { startBurnin } from "../src/sim/90-actions/burnin";
import { deliverListing } from "../src/sim/90-actions/used";
import { setPower } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer, newGame } from "./fixtures";

const dev = (s: GameState): Device => s.devices.find((d) => d.id === "dev3")!;
const game = (seed = 1): GameState => ({ ...withServer(newGame(seed)), cash: 100_000 });
// Every part of dev3 hidden, at the given share of its life.
function aged(s: GameState, shares: (i: number) => number): void {
  s.devices = s.devices.map((d) => d.id !== "dev3" ? d : {
    ...d, used: true, components: d.components.map((c, i) => ({ ...c, wear: "hidden" as const, installedAt: Math.round(s.hour - shares(i) * COMPONENTS[c.kind].life * HOURS_PER_YEAR) })),
  });
}
const finish = (s: GameState, full: boolean): SimEvent[] => {
  expect(startBurnin(s, "dev3", full).ok).toBe(true);
  const events: SimEvent[] = [];
  s.hour = dev(s).burnin!.until;
  burninTick(s, events);
  return events;
};

describe("burn-in", () => {
  it("quick marks only the parts past 80% of their life as worn", () => {
    const s = game();
    aged(s, (i) => (i === 0 ? 0.9 : i === 1 ? 1.3 : 0.3));
    const start = s.hour;
    finish(s, false);
    expect(s.hour - start).toBe(6);
    const d = dev(s);
    expect(d.burnin).toBeNull();
    expect(d.components.map((c) => c.wear)).toEqual(d.components.map((_, i) => (i < 2 ? "worn" : "hidden")));
    expect(d.components.every((c) => c.failedAt === null)).toBe(true);
    expect(d.burnedInAt).toBeNull();
  });

  it("makes the server busy and draws full power meanwhile", () => {
    const s = game();
    const idle = drawWatts(dev(s), busyDevices(s));
    startBurnin(s, "dev3", true);
    expect(drawWatts(dev(s), busyDevices(s))).toBeGreaterThan(idle);
    expect(serverTaken(s, "dev3")).toBe(true);
    expect(startBurnin(s, "dev3", false)).toEqual({ ok: false, error: "error.burninRunning" });
    s.hour = dev(s).burnin!.until;
    burninTick(s, []);
    expect(serverTaken(s, "dev3")).toBe(false);
  });

  it("aborts when the server is switched off", () => {
    const s = game();
    startBurnin(s, "dev3", true);
    setPower(s, "dev3", false);
    const events: SimEvent[] = [];
    burninTick(s, events);
    expect(dev(s).burnin).toBeNull();
    expect(events.map((e) => e.key)).toEqual(["event.burninAborted"]);
  });

  it("full reveals every age and fails about half of the parts past their life, by seed", () => {
    const failed = (seed: number) => {
      const s = game(seed);
      aged(s, (i) => (i === 0 ? 0.5 : 1.5));
      finish(s, true);
      const d = dev(s);
      expect(d.components.every((c) => c.wear === undefined)).toBe(true);
      expect(d.components[0].failedAt).toBeNull();
      expect(d.burnedInAt).toBeNull();
      return d.components.filter((c) => c.failedAt !== null).length;
    };
    const past = game().devices.find((d) => d.id === "dev3")!.components.length - 1;
    const runs = Array.from({ length: 30 }, (_, i) => failed(i + 1));
    expect(runs.reduce((a, b) => a + b, 0) / (30 * past)).toBeGreaterThan(0.35);
    expect(runs.reduce((a, b) => a + b, 0) / (30 * past)).toBeLessThan(0.65);
    expect(failed(7)).toBe(failed(7));
  });

  it("a passed full burn-in cuts the failure chance by 10% for a year", () => {
    const s = game();
    const c = dev(s).components[0], before = failureChance(s, dev(s), c);
    finish(s, true);
    expect(dev(s).burnedInAt).toBe(s.hour);
    expect(failureChance(s, dev(s), c) / before).toBeCloseTo(BURNIN_FACTOR);
    s.hour += BURNIN_BONUS_HOURS - 1;
    expect(failureChance(s, dev(s), c) / before).toBeCloseTo(BURNIN_FACTOR);
    s.hour += 1;
    expect(failureChance(s, dev(s), c) / before).toBeCloseTo(1);
  });

  it("a quick burn-in gives no bonus and the fields survive a save", () => {
    const s = game();
    finish(s, false);
    expect(dev(s).burnedInAt).toBeNull();
    startBurnin(s, "dev3", true);
    const back = deserialize(serialize(s));
    expect(back.devices.find((d) => d.id === "dev3")!.burnin).toEqual(dev(s).burnin);
    const old = JSON.parse(serialize(s));
    for (const d of old.devices) { delete d.burnin; delete d.burnedInAt; }
    expect(deserialize(JSON.stringify(old)).devices.every((d) => d.burnin === null && d.burnedInAt === null)).toBe(true);
  });

  it("runs through the tick and completes", () => {
    const s = game();
    startBurnin(s, "dev3", false);
    const events: SimEvent[] = [];
    for (let h = 0; h < 7; h++) events.push(...tick(s));
    expect(events.some((e) => e.key === "event.burninQuick")).toBe(true);
    expect(dev(s).burnin).toBeNull();
  });
});

describe("buyer protection", () => {
  const MARCH_2008 = hourOf(new Date(Date.UTC(2008, 2, 1)));
  // A bought used unit of a market listing posted on the channel.
  function bought(channel: Listing["channel"]) {
    const s = { ...game(), hour: MARCH_2008 };
    usedTick(s);
    const l = s.used.find((x) => x.qty === 1) ?? s.used[0];
    s.hour = l.postedAt + 24;
    const id = deliverListing(s, { ...l, channel }, "loc1", l.price)[0];
    const d = () => s.devices.find((x) => x.id === id)!;
    s.hour = d().arriveAt ?? s.hour;
    return { s, d, l };
  }
  const breakPart = (s: GameState, d: Device) => { s.devices = s.devices.map((x) => (x.id === d.id ? failComponents(s, x, [x.components[0].id]) : x)); };

  it.each(["board", "ebuy"] as const)("refunds half of the %s price when a part fails within 14 days, once", (channel) => {
    const { s, d, l } = bought(channel);
    const cash = s.cash;
    breakPart(s, d());
    expect(s.cash).toBeCloseTo(cash + l.price / l.qty / 2, 1);
    expect(s.ledger.at(-1)!.key).toBe("ledger.usedRefund");
    const after = s.cash;
    s.devices = s.devices.map((x) => (x.id === d().id ? failComponents(s, x, [x.components[1].id]) : x));
    expect(s.cash).toBe(after);
  });

  it("refunds nothing from a Craigslost deal", () => {
    const { s, d } = bought("chat");
    const cash = s.cash;
    breakPart(s, d());
    expect(s.cash).toBe(cash);
  });

  it("refunds nothing after the window", () => {
    const { s, d } = bought("board");
    s.hour += REFUND_HOURS + 1;
    const cash = s.cash;
    breakPart(s, d());
    expect(s.cash).toBe(cash);
  });
});
