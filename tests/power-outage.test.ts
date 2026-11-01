import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import { isAlert } from "../src/sim/alerts";
import type { SimEvent } from "../src/sim/88-tick/tick";
import { feedFailure, gridOutage } from "../src/sim/60-infra/incidents";
import { psusOf, working } from "../src/sim/60-infra/status";
import { BASEMENT_SERVER, readyGame } from "./fixtures";

const server = (s: ReturnType<typeof readyGame>) => s.devices.find((d) => d.id === BASEMENT_SERVER)!;

describe("power outages", () => {
  it("a dark outage cuts the servers and they boot after the power returns", () => {
    const s = readyGame(1);
    const events: SimEvent[] = [];
    gridOutage(s, s.locations[0], 120, createRng(1), events);
    expect(isAlert(events[0].key)).toBe(true);
    expect(server(s).log.at(-1)?.key).toBe("ipmi.log.pulled");
    s.hour += 2;
    expect(working(s, BASEMENT_SERVER)).toBe(false);
    s.hour += 1;
    expect(working(s, BASEMENT_SERVER)).toBe(true);
  });

  it("a feed failure without a second feed takes the rack dark as an alert", () => {
    const s = readyGame(1);
    // The router's power brick takes one feed, so it waits in storage.
    Object.assign(s.devices.find((d) => d.id === "dev5")!, { rackId: null, store: "loc1" });
    const events: SimEvent[] = [];
    const inc = feedFailure(s, s.racks[0], "A", 60, createRng(1), events);
    expect(events[0].key).toBe("event.feedDark");
    expect(isAlert("event.feedDark")).toBe(true);
    expect(inc.devices).toContain(server(s).name);
    expect(working(s, BASEMENT_SERVER)).toBe(false);
  });

  it("dual supplies on a dual-fed rack ride through a feed failure as a notification", () => {
    const s = readyGame(1);
    s.racks[0].feedB = true;
    for (const d of s.devices.filter((x) => x.rackId === s.racks[0].id && psusOf(x).length === 1)) {
      const psu = psusOf(d)[0];
      d.components = [...d.components, { ...psu, id: `${psu.id}b` }];
    }
    // The router's power brick takes one feed, so it waits in storage.
    Object.assign(s.devices.find((d) => d.id === "dev5")!, { rackId: null, store: "loc1" });
    const events: SimEvent[] = [];
    const inc = feedFailure(s, s.racks[0], "A", 60, createRng(1), events);
    expect(events[0].key).toBe("event.feedCarried");
    expect(isAlert("event.feedCarried")).toBe(false);
    expect(inc.dark).toBe(0);
    expect(working(s, BASEMENT_SERVER)).toBe(true);
  });

  it("feed B failing leaves single-supply servers on feed A running", () => {
    const s = readyGame(1);
    s.racks[0].feedB = true;
    const events: SimEvent[] = [];
    feedFailure(s, s.racks[0], "B", 60, createRng(1), events);
    expect(events[0].key).toBe("event.feedCarried");
    expect(working(s, BASEMENT_SERVER)).toBe(true);
  });
});
