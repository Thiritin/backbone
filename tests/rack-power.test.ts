import { describe, expect, it } from "vitest";
import { extraStepPrice, datacenterById, spacePrice } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { rackPower } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addLocation, buyRack, setExtraPower, setFeed } from "../src/sim/90-actions/hardware";
import { withServer } from "./fixtures";

const DC = "hetzler-park";
const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 1_000_000 });
const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

function share(s: GameState) {
  const id = ok(addLocation(s, DC, "share", 8));
  s.locations.find((l) => l.id === id)!.readyAt = 0;
  return { id, rack: s.racks.find((r) => r.locationId === id)!.id };
}

describe("extra power on a share", () => {
  it("raises the limit after the lead time", () => {
    const s = rich();
    const { rack } = share(s);
    expect(rackPower(s, rack).limitWatts).toBe(500);
    ok(setExtraPower(s, rack, 0.5));
    run(s, 71);
    expect(rackPower(s, rack).limitWatts).toBe(500);
    expect(s.racks.find((r) => r.id === rack)!.extraKwAt?.kw).toBe(0.5);
    run(s, 1);
    expect(rackPower(s, rack).limitWatts).toBe(1000);
    expect(s.racks.find((r) => r.id === rack)).toMatchObject({ extraKw: 0.5, extraKwAt: null });
  });

  it("caps the extra at the share's base limit and keeps to quarter kW steps", () => {
    const s = rich();
    const { rack } = share(s);
    expect(err(setExtraPower(s, rack, 0.75))).toBe("error.extraPowerRange");
    expect(err(setExtraPower(s, rack, 0.1))).toBe("error.extraPowerRange");
    expect(err(setExtraPower(s, rack, -0.25))).toBe("error.extraPowerRange");
    expect(err(setExtraPower(s, rack, 0.5))).toBe("ok");
  });

  it("bills the steps with the space rent", () => {
    const s = rich();
    const { id, rack } = share(s);
    ok(setExtraPower(s, rack, 0.5));
    run(s, 72);
    const dc = datacenterById(DC), name = s.locations.find((l) => l.id === id)!.name;
    expect(extraStepPrice(dc)).toBe(30);
    while (!s.ledger.some((e) => e.key === "ledger.space" && e.params.location === name && e.hour > 72)) tick(s);
    const bill = s.ledger.filter((e) => e.key === "ledger.space" && e.params.location === name).at(-1)!;
    expect(bill.amount).toBe(-(spacePrice(dc, "share", 8) + 2 * 30));
  });

  it("drops back to the base limit after a reduction", () => {
    const s = rich();
    const { rack } = share(s);
    ok(setExtraPower(s, rack, 0.25));
    run(s, 72);
    ok(setExtraPower(s, rack, 0));
    run(s, 72);
    expect(rackPower(s, rack).limitWatts).toBe(500);
  });
});

describe("own racks", () => {
  it("refuse extra power and keep the feed rule", () => {
    const s = rich();
    const id = ok(addLocation(s, DC, "positions", 1));
    s.locations.find((l) => l.id === id)!.readyAt = 0;
    const own = ok(buyRack(s, id, "rack-42", 1));
    expect(err(setExtraPower(s, own, 0.25))).toBe("error.ownRack");
    ok(setFeed(s, own, "highDensity", true));
    expect(rackPower(s, own).limitWatts).toBe(8000);
    const { rack } = share(s);
    expect(err(setFeed(s, rack, "highDensity", true))).toBe("error.providedRack");
  });
});

describe("old saves", () => {
  it("load racks without the extra power fields", () => {
    const s = rich();
    share(s);
    const raw = JSON.parse(serialize(s));
    for (const r of raw.racks) { delete r.extraKw; delete r.extraKwAt; }
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.racks.every((r) => r.extraKw === 0 && r.extraKwAt === null)).toBe(true);
  });
});
