import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { capacityAt, DATACENTERS, datacenterById } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { dcAvailability, fits } from "../src/sim/60-infra/status";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addLocation, buyDevice, joinWaitlist, leaveWaitlist } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";

const ok = (r: ReturnType<typeof addLocation>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof addLocation>) => (r.ok ? "ok" : r.error);
const FR5 = "equinox-fr5";
// A game whose Equinox FR5 has exactly `free` positions left.
const withFree = (free: number): GameState => {
  const s = { ...newGame(1), cash: 1_000_000 };
  s.dcs = { ...s.dcs, [FR5]: { others: 300 - free } };
  return s;
};
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};

describe("capacity", () => {
  it("grows in phases from the opening size to the final size", () => {
    const at = (id: string, years: number[]) => years.map((y) => capacityAt(datacenterById(id), y));
    expect(at(FR5, [2005, 2007, 2008, 2011, 2022, 2023, 2040])).toEqual([300, 300, 450, 600, 1050, 1200, 1200]);
    expect(at("hetzler-park", [2005, 2009, 2013, 2021, 2025, 2030])).toEqual([120, 180, 240, 360, 400, 400]);
    expect(at("mainqubes-fra", [2005, 2010, 2015, 2025, 2040])).toEqual([40, 60, 80, 120, 120]);
    expect(DATACENTERS.filter((d) => d.size === "small").map((d) => d.provider)).toEqual(["mainqubes", "docklands", "spree", "greenchz"]);
    expect(DATACENTERS.filter((d) => d.size === "medium")).toHaveLength(5);
  });
  it("seeds competitors at 85% to 97% of capacity without touching the game rng", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed);
      expect(s.rng).toEqual({ s: seed });
      for (const dc of DATACENTERS) {
        const share = s.dcs[dc.id].others / capacityAt(dc, 2005);
        expect(share).toBeGreaterThanOrEqual(0.84);
        expect(share).toBeLessThanOrEqual(0.98);
      }
    }
  });
  it("keeps free space between 0% and 6% most months over 20 years, and opens space at each expansion", () => {
    const s = newGame(5);
    let months = 0, inBand = 0;
    const fr5: number[] = [];
    for (let y = 2005; y < 2025; y++) {
      for (let m = 0; m < 12; m++) {
        if (y === 2005 && m === 0) continue;
        s.hour = hourOf(new Date(Date.UTC(y, m, 1))) - 1;
        tick(s);
        for (const dc of DATACENTERS) {
          const a = dcAvailability(s, dc.id);
          expect(a.others).toBeGreaterThanOrEqual(0);
          expect(a.others).toBeLessThanOrEqual(a.capacity);
          months++;
          if (a.free / a.capacity <= 0.06) inBand++;
        }
        fr5.push(dcAvailability(s, FR5).free);
      }
    }
    expect(inBand / months).toBeGreaterThan(0.85);
    // January 2008 opens 150 positions at Equinox FR5; competitors take a sixth of them each month for three months.
    const jan2008 = 3 * 12 - 1;
    expect(fr5[jan2008]).toBeGreaterThan(100);
    expect(fr5[jan2008 + 2]).toBeLessThan(fr5[jan2008]);
    expect(fr5[jan2008 + 3]).toBeLessThanOrEqual(Math.ceil(0.04 * 450));
  });
});

describe("renting limited space", () => {
  it("rejects space that is not free and leaves the basement unlimited", () => {
    const s = withFree(0);
    expect(err(addLocation(s, FR5, "positions", 1))).toBe("error.noSpace");
    expect(err(addLocation(s, FR5, "share", 8))).toBe("error.noSpace");
    expect(dcAvailability(s, FR5)).toEqual({ capacity: 300, others: 300, mine: 0, held: 0, free: 0, freeEighths: 0 });
    expect(buyDevice(s, "g1-compute", "Dwell", 50, "loc1").ok).toBe(true);
  });
  it("needs as many free positions as the cage has", () => {
    const s = withFree(7);
    expect(fits(s, FR5, "cage", 8)).toBe(false);
    expect(err(addLocation(s, FR5, "cage", 8))).toBe("error.noSpace");
    ok(addLocation(s, FR5, "cage", 4));
    expect(dcAvailability(s, FR5)).toMatchObject({ mine: 4, free: 3 });
    expect(err(addLocation(s, FR5, "cage", 4))).toBe("error.noSpace");
    ok(addLocation(s, FR5, "positions", 3));
  });
  it("packs eight 1/8 shares into one position", () => {
    const s = withFree(1);
    for (let i = 0; i < 8; i++) ok(addLocation(s, FR5, "share", 8));
    expect(dcAvailability(s, FR5)).toMatchObject({ mine: 1, free: 0, freeEighths: 0 });
    expect(err(addLocation(s, FR5, "share", 8))).toBe("error.noSpace");
    const t = withFree(1);
    ok(addLocation(t, FR5, "share", 2));
    expect(dcAvailability(t, FR5)).toMatchObject({ mine: 0.5, free: 0, freeEighths: 4 });
    expect(err(addLocation(t, FR5, "positions", 1))).toBe("error.noSpace");
    ok(addLocation(t, FR5, "share", 4));
    ok(addLocation(t, FR5, "share", 4));
  });
});

describe("waitlist", () => {
  it("holds freed space for 7 days, keeps competitors off it, and rents it on the hold", () => {
    const s = withFree(0);
    s.hour = 700;
    const id = ok(joinWaitlist(s, FR5, "positions", 2));
    expect(s.waitlist).toEqual([{ id, dc: FR5, space: "positions", size: 2, since: 700, heldUntil: null }]);
    expect(run(s, 1).some((e) => e.key === "event.spaceHeld")).toBe(false);
    s.dcs = { ...s.dcs, [FR5]: { others: 297 } };
    expect(run(s, 1)).toContainEqual({ app: "Locations", key: "event.spaceHeld", params: { datacenter: "Equinox FR5", days: 7 } });
    expect(s.waitlist[0].heldUntil).toBe(702 + 168);
    expect(dcAvailability(s, FR5)).toMatchObject({ held: 2, free: 1 });
    expect(fits(s, FR5, "positions", 2)).toBe(false);
    // The month starts at hour 744: competitors take the free position but never the held ones.
    run(s, 744 - s.hour);
    expect(dcAvailability(s, FR5).held).toBe(2);
    expect(dcAvailability(s, FR5).others).toBeLessThanOrEqual(298);
    ok(addLocation(s, FR5, "positions", 2));
    expect(s.waitlist).toEqual([]);
    expect(dcAvailability(s, FR5)).toMatchObject({ mine: 2, held: 0 });
  });
  it("releases a hold that is not used within 7 days", () => {
    const s = withFree(0);
    ok(joinWaitlist(s, FR5, "share", 8));
    s.dcs = { ...s.dcs, [FR5]: { others: 299 } };
    run(s, 1);
    expect(s.waitlist[0].heldUntil).toBe(169);
    expect(run(s, 167).some((e) => e.key === "event.holdExpired")).toBe(false);
    expect(run(s, 1)).toContainEqual({ app: "Locations", key: "event.holdExpired", params: { datacenter: "Equinox FR5" } });
    expect(s.waitlist).toEqual([]);
    expect(dcAvailability(s, FR5).held).toBe(0);
  });
  it("rejects bad entries and space that is free, and leaves the list", () => {
    const s = withFree(1);
    expect(err(joinWaitlist(s, "nope", "positions", 1))).toBe("error.unknownDatacenter");
    expect(err(joinWaitlist(s, FR5, "positions", 5))).toBe("error.unknownSize");
    expect(err(joinWaitlist(s, "hetzler-park", "cage", 4))).toBe("error.noCages");
    expect(err(joinWaitlist(s, FR5, "positions", 1))).toBe("error.spaceAvailable");
    const id = ok(joinWaitlist(s, FR5, "suite", 20));
    ok(leaveWaitlist(s, id));
    expect(s.waitlist).toEqual([]);
    expect(err(leaveWaitlist(s, id))).toBe("error.unknownWaitlist");
  });
});

describe("saves", () => {
  it("seeds competitors for the save's year and an empty waitlist when a save has neither", () => {
    const s = newGame(3);
    s.hour = hourOf(new Date(Date.UTC(2011, 5, 1)));
    const raw = JSON.parse(serialize(s));
    delete raw.dcs;
    delete raw.waitlist;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.waitlist).toEqual([]);
    const share = loaded.dcs[FR5].others / 600;
    expect(share).toBeGreaterThanOrEqual(0.84);
    expect(share).toBeLessThanOrEqual(0.98);
    const in2018 = { ...newGame(4), hour: hourOf(new Date(Date.UTC(2018, 3, 1))) };
    const v2 = JSON.parse(serialize(in2018));
    delete v2.dcs;
    for (const old of [v2, JSON.parse(serialize(in2018))]) {
      const a = dcAvailability(deserialize(JSON.stringify(old)), FR5);
      expect(a.capacity).toBe(900);
      expect(a.others / 900).toBeGreaterThanOrEqual(0.84);
      expect(a.others / 900).toBeLessThanOrEqual(0.98);
    }
    const kept = withFree(5);
    expect(deserialize(serialize(kept)).dcs[FR5]).toEqual({ others: 295 });
  });
});
