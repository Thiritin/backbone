import { describe, expect, it } from "vitest";
import { businessPowerPrice } from "../src/sim/10-catalog/economy";
import { DATACENTERS, datacenterById, FLAT_CONTRACTS, flatMonthly } from "../src/sim/20-world/datacenters";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { locationRent, rackPower, working } from "../src/sim/60-infra/status";
import { powerPerHour, tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addLocation, buyRack, setFlatPower } from "../src/sim/90-actions/hardware";
import { freeFloor, runServers, withServer } from "./fixtures";

const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 1_000_000 });
const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
const MONTH = 730;

// Own racks need a cage, or a suite where the datacenter has no cages.
function position(s: GameState, dc = "hetzler-park") {
  const cages = datacenterById(dc).cages;
  const loc = ok(addLocation(freeFloor(s), dc, cages ? "cage" : "suite", cages ? 4 : 20));
  s.locations.find((l) => l.id === loc)!.readyAt = 0;
  return ok(buyRack(s, loc, "rack-42", 1));
}
// count G1 1U servers in the rack, 250 W each running and 100 W idle.
function fill(s: GameState, rack: string, count: number) {
  for (let i = 0; i < count; i++) s.devices.push(device(`fill${i}`, "g1-compute", "Dwell", rack, i + 1, null, `fill-${i}`, 2500));
}
const rackOf = (s: GameState, id: string) => s.racks.find((r) => r.id === id)!;

describe("datacenter power billing", () => {
  it("offers flat-rate power at Hetzler and keeps the premium sites metered", () => {
    expect(DATACENTERS.filter((d) => d.provider === "hetzler").every((d) => d.power !== "metered")).toBe(true);
    expect(datacenterById("equinox-fr5").power).toBe("metered");
    expect(datacenterById("hetzler-nbg").power).toBe("flat");
  });
});

describe("flat-rate power contract", () => {
  it("costs the metered price of running at 60% of its limit", () => {
    const dc = datacenterById("hetzler-park");
    expect(flatMonthly(dc, 4.4, 2005)).toBe(Math.round(4.4 * 0.6 * MONTH * businessPowerPrice(2005) * 1.1));
    expect(flatMonthly(dc, 7, 2005)).toBeGreaterThan(flatMonthly(dc, 4.4, 2005));
    expect(FLAT_CONTRACTS.map((c) => c.kw)).toEqual([4.4, 7]);
  });

  it("switches after the lead time, sets the limit and trips above it", () => {
    const s = rich(), rack = position(s);
    expect(rackPower(s, rack).limitWatts).toBe(4000);
    ok(setFlatPower(s, rack, 4.4));
    run(s, 71);
    expect(rackOf(s, rack).flatKw).toBe(0);
    run(s, 1);
    expect(rackOf(s, rack)).toMatchObject({ flatKw: 4.4, flatKwAt: null });
    expect(rackPower(s, rack).limitWatts).toBe(4400);
    fill(s, rack, 17);
    runServers(s);
    expect(rackPower(s, rack)).toMatchObject({ watts: 4250, tripped: false });
    s.devices.push(device("extra", "g1-compute", "Dwell", rack, 20, null, "extra", 2500));
    runServers(s);
    expect(rackPower(s, rack).tripped).toBe(true);
    expect(working(s, "fill0")).toBe(false);
  });

  it("replaces metered billing for the rack and bills the contract each month", () => {
    const s = rich(), rack = position(s);
    fill(s, rack, 4);
    const metered = powerPerHour(s);
    rackOf(s, rack).flatKw = 4.4;
    expect(powerPerHour(s)).toBeLessThan(metered);
    run(s, 24 * 31);
    const line = s.ledger.find((l) => l.key === "ledger.flatPower")!;
    expect(line.amount).toBe(-flatMonthly(datacenterById("hetzler-park"), 4.4, 2005));
    expect(line.params).toMatchObject({ kw: 4.4 });
  });

  it("costs more than metered when the rack idles and less when it runs full", () => {
    const dc = datacenterById("hetzler-park"), kwh = businessPowerPrice(2005) * dc.powerFactor;
    const metered = (servers: number, busy: boolean) => {
      const s = rich(), rack = position(s);
      fill(s, rack, servers);
      if (busy) runServers(s);
      return rackPower(s, rack).watts / 1000 * MONTH * kwh;
    };
    expect(metered(4, false)).toBeLessThan(flatMonthly(dc, 4.4, 2005));
    expect(metered(17, true)).toBeGreaterThan(flatMonthly(dc, 4.4, 2005));
  });

  it("is only offered on own racks where the datacenter sells it", () => {
    const s = rich();
    expect(err(setFlatPower(s, position(s, "equinox-fr5"), 4.4))).toBe("error.noFlatPower");
    const share = ok(addLocation(s, "hetzler-park", "share", 1));
    expect(err(setFlatPower(s, s.racks.find((r) => r.locationId === share)!.id, 4.4))).toBe("error.noFlatPower");
    const rack = position(s);
    expect(err(setFlatPower(s, rack, 5))).toBe("error.flatPowerRange");
    const flat = position(s, "hetzler-nbg");
    expect(rackOf(s, flat).flatKw).toBe(4.4);
    expect(err(setFlatPower(s, flat, 0))).toBe("error.flatPowerRange");
    ok(setFlatPower(s, flat, 7));
    ok(setFlatPower(s, flat, 4.4));
    expect(rackOf(s, flat).flatKwAt).toBeNull();
  });

  it("loads old saves on metered power", () => {
    const s = rich(), rack = position(s), data = JSON.parse(serialize(s));
    for (const r of data.racks) { delete r.flatKw; delete r.flatKwAt; }
    expect(deserialize(JSON.stringify(data)).racks.find((r) => r.id === rack)).toMatchObject({ flatKw: 0, flatKwAt: null });
  });
  it("turns rack positions in old saves into cages and drops their waitlist entries", () => {
    const s = rich(), rack = position(s, "equinox-fr5"), data = JSON.parse(serialize(s));
    const loc = rackOf(s, rack).locationId;
    data.locations = data.locations.map((l: { id: string }) => (l.id === loc ? { ...l, space: "positions", positions: 2 } : l));
    delete data.contracts;
    data.waitlist = [{ id: "w1", dc: "equinox-fr5", space: "positions", size: 2, since: 0, heldUntil: null }, { id: "w2", dc: "equinox-fr5", space: "share", size: 8, since: 0, heldUntil: null }];
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.locations.find((l) => l.id === loc)).toMatchObject({ space: "cage", positions: 2 });
    expect(loaded.waitlist.map((w) => w.id)).toEqual(["w2"]);
    expect(locationRent(loaded, loaded.locations.find((l) => l.id === loc)!)).toBe(1500);
  });
});
