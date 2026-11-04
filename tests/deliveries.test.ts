import { describe, expect, it } from "vitest";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, mountDevice } from "../src/sim/90-actions/hardware";
import { newGame } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r).toMatchObject({ ok: true }); return r.id!; };

describe("deliveries", () => {
  it("lands the first order in storage at once and ships the next one into storage", () => {
    const s = { ...newGame(7), cash: 100_000 };
    const first = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(s.devices.find((d) => d.id === first)).toMatchObject({ store: "loc1", arrivedAt: s.hour });
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    const due = s.devices.find((d) => d.id === id)!.arriveAt!;
    const events = [];
    while (s.devices.find((d) => d.id === id)!.arriveAt !== null) events.push(...tick(s));
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ store: "loc1", transitTo: null, arrivedAt: due });
    expect(events).toContainEqual(expect.objectContaining({ key: "event.stockArrived", params: { count: 1, location: "Basement" } }));
    expect(mountDevice(s, id, "rack2", 5).ok).toBe(true);
  });

  it("moves units at the door or in the hands of an old save into storage", () => {
    const s = { ...newGame(7), cash: 100_000 };
    const a = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1")), b = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    while (s.devices.some((d) => d.arriveAt !== null)) tick(s);
    const data = JSON.parse(serialize(s));
    for (const d of data.devices) {
      if (d.id === a) Object.assign(d, { store: null, door: { at: "loc1", since: 5 } });
      if (d.id === b) d.store = null;
      delete d.arrivedAt;
    }
    data.player.carrying = b;
    const g = deserialize(JSON.stringify(data));
    expect(g.devices.find((d) => d.id === a)).toMatchObject({ store: "loc1", arrivedAt: 5 });
    expect(g.devices.find((d) => d.id === a)).not.toHaveProperty("door");
    expect(g.devices.find((d) => d.id === b)).toMatchObject({ store: "loc1", arrivedAt: null });
    expect(g.player).not.toHaveProperty("carrying");
  });
});
