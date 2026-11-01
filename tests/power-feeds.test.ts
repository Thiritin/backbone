import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import { CONTINUOUS } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { rackAlarms } from "../src/sim/60-infra/alarms";
import { feedFailure } from "../src/sim/60-infra/incidents";
import { tripTick } from "../src/sim/60-infra/power";
import { psusOf, rackPower } from "../src/sim/60-infra/status";
import type { SimEvent } from "../src/sim/88-tick/tick";
import { withServer, newGame } from "./fixtures";

const rack = (s: GameState) => s.racks.find((r) => r.id === "rack2")!;
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
// Sets the rack's limit so that its whole draw is this share of one feed.
const loadAt = (s: GameState, share: number) => { rack(s).flatKw = rackPower(s, "rack2").watts / 1000 / share; };
const dualFeed = (s: GameState) => {
  rack(s).feedB = true;
  const d = dev(s, "dev3"), psu = psusOf(d)[0];
  d.components = [...d.components, { ...psu, id: `${psu.id}b` }];
};
// Runs the breaker check once an hour for this many hours and returns its events.
const hours = (s: GameState, n: number) => Array.from({ length: n }, () => { s.hour++; return tripTick(s); }).flat();

describe("power feeds", () => {
  it("carries a rack under 80% of its feed for good", () => {
    const s = withServer(newGame(1));
    loadAt(s, 0.7);
    expect(hours(s, 48)).toEqual([]);
    expect(dev(s, "dev3").on).toBe(true);
    expect(rackAlarms(s, "rack2")).toEqual([]);
  });

  it("trips a feed held above 80% for three hours", () => {
    const s = withServer(newGame(1));
    loadAt(s, 0.9);
    expect(rackAlarms(s, "rack2").map((a) => a.key)).toEqual(["alarm.feedHigh"]);
    expect(hours(s, CONTINUOUS.hours)).toEqual([]);
    expect(dev(s, "dev3").on).toBe(true);
    expect(hours(s, 1)).toContainEqual({ app: "Locations", key: "event.breakerTripped", params: { rack: rack(s).name } });
    expect(dev(s, "dev3").on).toBe(false);
    expect(rack(s).overSince).toEqual({ a: null, b: null });
  });

  it("trips only the servers on feed A when dual-fed servers fit on feed B", () => {
    const s = withServer(newGame(1));
    dualFeed(s);
    s.devices.push({ ...dev(s, "dev3"), id: "dev9", components: dev(s, "dev3").components.filter((c) => c.kind !== "psu" || !c.id.endsWith("b")) });
    loadAt(s, 0.85 * rackPower(s, "rack2").watts / rackPower(s, "rack2").a);
    const events = hours(s, CONTINUOUS.hours + 1);
    expect(events).toEqual([{ app: "Locations", key: "event.feedTripped", params: { rack: rack(s).name, feed: "A" } }]);
    expect(dev(s, "dev9").on).toBe(false);
    expect(dev(s, "dev3").on).toBe(true);
  });

  it("takes the rack dark when feed A fails and A and B together exceed one feed", () => {
    const s = withServer(newGame(1));
    dualFeed(s);
    loadAt(s, 1.2);
    expect(rackAlarms(s, "rack2").map((a) => a.key)).toEqual(["alarm.noFeedFailover"]);
    const events: SimEvent[] = [];
    const inc = feedFailure(s, rack(s), "A", 60, createRng(1), events);
    expect(events[0].key).toBe("event.feedCascade");
    expect(inc.dark).toBe(60);
    expect(inc.devices).toContain(dev(s, "dev3").name);
  });

  it("rides through feed A failing when A and B together fit one feed", () => {
    const s = withServer(newGame(1));
    dualFeed(s);
    loadAt(s, 0.9);
    const events: SimEvent[] = [];
    const inc = feedFailure(s, rack(s), "A", 60, createRng(1), events);
    expect(events[0].key).toBe("event.feedDark");
    // The switch and the router have one supply each, on feed A.
    expect(inc.devices).toEqual([dev(s, "dev4").name, dev(s, "dev5").name]);
  });
});
