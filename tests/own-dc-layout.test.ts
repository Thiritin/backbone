import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { rackTiles, officePlan, fixtures, wallTiles } from "../src/sim/20-world/layout";
import { HALL, hallKw, REFIT } from "../src/sim/20-world/properties";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { coverage, hotSpot } from "../src/sim/60-infra/thermal";
import { buyDevice, buyRack, buyRackError, mountDevice } from "../src/sim/90-actions/hardware";
import {
  buyTransformer, buyTransformerError, layRow, layRowError, moveCooler, moveCoolerError, placeCooler, placeCoolerError, removeCooler, removeCoolerError, removeRow, removeRowError,
} from "../src/sim/90-actions/hall";
import { buyBuilding, refitSection } from "../src/sim/90-actions/properties";
import { placeRack, placeRackError } from "../src/sim/90-actions/layout";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// An owned Gallushof (office hall, 20 positions: rows A y=2 facing s and B y=4 facing n share the aisle y=3) or the Halle.
function setup(building = "gallushof") {
  const s = newGame(7);
  s.cash = 10_000_000;
  s.hour = hourOf(new Date(Date.UTC(2013, 2, 2, 10)));
  const propertyId = ok(buyBuilding(s, building));
  const p = s.properties.find((x) => x.id === propertyId)!;
  const hallId = ok(refitSection(s, propertyId, p.sections.find((x) => x.floor === 1)!.id, "hall"));
  s.hour += 24 * REFIT.hall.days;
  s.unlocks = ["network"];
  s.player = { ...s.player, at: hallId };
  const hall = () => s.properties.find((x) => x.id === propertyId)!.hall!, loc = () => s.locations.find((l) => l.id === hallId)!;
  return { s, propertyId, hallId, hall, loc };
}

// An action fails with exactly the key its check returns and leaves the state as it was.
function refuses(s: GameState, error: string | null, run: () => { ok: boolean; error?: string }) {
  const before = JSON.stringify(s);
  expect(error).not.toBeNull();
  expect(run()).toEqual({ ok: false, error });
  expect(JSON.stringify(s)).toBe(before);
}

describe("own datacenter layout: rows and aisles", () => {
  it("a row needs a free aisle line front and back and may share one", () => {
    const { s, hallId, hall } = setup();
    const [a, b] = hall().rows;
    ok(removeRow(s, hallId, a.id)); ok(removeRow(s, hallId, b.id));
    ok(layRow(s, hallId, { x: 3, y: 2, length: 5, facing: "s" }));
    refuses(s, layRowError(s, hallId, { x: 3, y: 3, length: 5, facing: "s" }), () => layRow(s, hallId, { x: 3, y: 3, length: 5, facing: "s" }));
    expect(layRowError(s, hallId, { x: 3, y: 3, length: 5, facing: "s" })).toBe("error.noAisle");
    ok(layRow(s, hallId, { x: 3, y: 4, length: 5, facing: "n" }));
    expect(layRowError(s, hallId, { x: 3, y: 5, length: 5, facing: "s" })).toBe("error.noAisle");
  });

  it("refuses a row on the door's tile", () => {
    const { s, hallId } = setup();
    expect(layRowError(s, hallId, { x: 0, y: 5, length: 3, facing: "s" })).toBe("error.rowOutside");
    expect(layRowError(s, hallId, { x: 1, y: 5, length: 3, facing: "s" })).toBe("error.rowOutside");
  });

  it("the hall has a plan board on a tile no other fixture uses", () => {
    const { s, loc } = setup();
    const f = fixtures(loc(), officePlan(s, loc())), plan = f.plan;
    expect(plan).toMatchObject({ kind: "planboard", x: 0 });
    expect(Object.entries(f).filter(([k, o]) => k !== "plan" && o.x === plan.x && o.y === plan.y)).toEqual([]);
    expect(wallTiles(loc(), officePlan(s, loc())).some((t) => t.x === plan.x && t.y === plan.y)).toBe(false);
  });

  it("moving a row moves its racks and darkens them for two hours, then they run", () => {
    const { s, hallId, hall, loc } = setup();
    const [a] = hall().rows;
    const rack = ok(buyRack(s, hallId, "rack-42", 1));
    const dev = ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), rack, 1));
    const empty = ok(buyRack(s, hallId, "rack-42", 2));
    ok(layRow(s, hallId, { ...a, x: 4 }));
    const r = s.racks.find((x) => x.id === rack)!;
    expect(r.position).toBe(1);
    expect(rackTiles(loc(), s.racks, officePlan(s, loc()))[rack]).toMatchObject({ x: 4, y: 2 });
    expect(r.arriveAt).toBe(s.hour + HALL.moveHours);
    expect(s.racks.find((x) => x.id === empty)!.arriveAt).toBeNull();
    expect(s.devices.find((d) => d.id === dev)!.rackId).toBe(rack);
    s.hour = r.arriveAt!;
    tick(s);
    expect(s.racks.find((x) => x.id === rack)!.arriveAt).toBeNull();
  });

  it("a mounted rack moved to another free position keeps its devices and is dark for two hours", () => {
    const { s, hallId, loc } = setup();
    const rack = ok(buyRack(s, hallId, "rack-42", 1));
    const dev = ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), rack, 1));
    const to = wallTiles(loc(), officePlan(s, loc()))[4];
    const cables = s.cables.length;
    ok(placeRack(s, rack, to));
    const r = s.racks.find((x) => x.id === rack)!;
    expect(r).toMatchObject({ position: 5, arriveAt: s.hour + HALL.moveHours });
    expect(s.devices.find((d) => d.id === dev)!.rackId).toBe(rack);
    expect(s.cables).toHaveLength(cables);
    refuses(s, placeRackError(s, rack, wallTiles(loc(), officePlan(s, loc()))[6]), () => placeRack(s, rack, wallTiles(loc(), officePlan(s, loc()))[6]));
    s.hour = r.arriveAt!;
    tick(s);
    expect(s.racks.find((x) => x.id === rack)!.arriveAt).toBeNull();
    refuses(s, placeRackError(s, rack, to), () => placeRack(s, rack, to));
  });

  it("a row with a customer cannot move, turn or shrink, and an empty row can go", () => {
    const { s, hallId, hall } = setup();
    const [a, b] = hall().rows;
    hall().customers.push({ id: "c1", name: "Mainbit", position: 3, monthly: 300, since: s.hour, kw: 3, zoneId: null });
    for (const next of [{ ...a, x: 4 }, { ...a, facing: "n" as const }, { ...a, length: 5 }]) {
      refuses(s, layRowError(s, hallId, next), () => layRow(s, hallId, next));
      expect(layRowError(s, hallId, next)).toBe("error.rowInUse");
    }
    refuses(s, removeRowError(s, hallId, a.id), () => removeRow(s, hallId, a.id));
    expect(removeRow(s, hallId, b.id).ok).toBe(true);
  });

  it("buying a rack on a taken position returns the check's key", () => {
    const { s, hallId } = setup();
    ok(buyRack(s, hallId, "rack-42", 1));
    refuses(s, buyRackError(s, hallId, "rack-42", 1), () => buyRack(s, hallId, "rack-42", 1));
  });
});

describe("own datacenter layout: cooling", () => {
  it("front-to-back rows make every position of the front row hot", () => {
    const { s, hallId, hall, loc } = setup();
    const [, b] = hall().rows;
    ok(removeRow(s, hallId, b.id));
    ok(layRow(s, hallId, { x: 3, y: 4, length: 10, facing: "s" }));
    for (const slot of [0, 1, 5]) ok(placeCooler(s, hallId, slot));
    const covered = coverage(s, loc());
    expect(covered.slice(0, 10).every((c) => !c)).toBe(true);
    expect(covered.slice(10).some((c) => c)).toBe(true);
  });

  it("two units cover the 16 nearest positions and a third covers the rest", () => {
    const { s, hallId, hall, loc } = setup();
    ok(placeCooler(s, hallId, 0)); ok(placeCooler(s, hallId, 5));
    const two = coverage(s, loc());
    expect(two.filter(Boolean)).toHaveLength(16);
    expect(two[0] && two[10]).toBe(true);
    expect(two.slice(13, 17).some(Boolean)).toBe(false);
    ok(placeCooler(s, hallId, 1));
    expect(coverage(s, loc()).every(Boolean)).toBe(true);
    expect(hall().coolers).toEqual([0, 1, 5]);
  });

  it("moves a unit free and removing one refunds half", () => {
    const { s, hallId, hall, loc } = setup();
    ok(placeCooler(s, hallId, 0));
    const cash = s.cash;
    ok(moveCooler(s, hallId, 0, 3));
    expect(s.cash).toBe(cash);
    expect(hall().coolers).toEqual([3]);
    ok(removeCooler(s, hallId, 3));
    expect(s.cash).toBe(cash + HALL.cooling.price / 2);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.coolerRefund", amount: HALL.cooling.price / 2 });
    expect(coverage(s, loc()).some(Boolean)).toBe(false);
  });

  it("the right wall holds units and every check matches its action", () => {
    const { s, hallId } = setup();
    ok(placeCooler(s, hallId, 6));
    refuses(s, placeCoolerError(s, hallId, 6), () => placeCooler(s, hallId, 6));
    refuses(s, placeCoolerError(s, hallId, 99), () => placeCooler(s, hallId, 99));
    refuses(s, moveCoolerError(s, hallId, 2, 3), () => moveCooler(s, hallId, 2, 3));
    refuses(s, removeCoolerError(s, hallId, 2), () => removeCooler(s, hallId, 2));
    s.cash = 0;
    refuses(s, placeCoolerError(s, hallId, 1), () => placeCooler(s, hallId, 1));
  });

  it("a device on an uncovered position wears hot, one under a unit does not", () => {
    const { s, hallId, loc } = setup();
    ok(placeCooler(s, hallId, 0));
    const near = ok(buyRack(s, hallId, "rack-42", 1)), far = ok(buyRack(s, hallId, "rack-42", 15));
    const d1 = ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), near, 1));
    const d2 = ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), far, 1));
    expect(coverage(s, loc())[14]).toBe(false);
    expect(hotSpot(s, s.devices.find((d) => d.id === d2)!)).toBe(true);
    expect(hotSpot(s, s.devices.find((d) => d.id === d1)!)).toBe(false);
  });
});

describe("own datacenter layout: transformer and saves", () => {
  it("one extra transformer per floor raises the limit and bills monthly", () => {
    const { s, propertyId, hallId } = setup();
    const p = () => s.properties.find((x) => x.id === propertyId)!;
    expect(hallKw(p())).toBe(HALL.transformerKw.office);
    ok(buyTransformer(s, hallId));
    expect(hallKw(p())).toBe(2 * HALL.transformerKw.office);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.transformer", amount: -HALL.transformer.price });
    refuses(s, buyTransformerError(s, hallId), () => buyTransformer(s, hallId));
    s.cash = 0;
    const big = setup("fechenhalle");
    big.s.cash = 0;
    refuses(big.s, buyTransformerError(big.s, big.hallId), () => buyTransformer(big.s, big.hallId));
  });

  it("an old save with a cooling count loads with coolers for the first slots", () => {
    const { s, propertyId } = setup();
    const raw = JSON.parse(serialize(s));
    const hall = raw.properties.find((x: { id: string }) => x.id === propertyId).hall;
    delete hall.coolers; delete hall.transformers;
    hall.cooling = 3;
    const back = deserialize(JSON.stringify(raw)).properties.find((x) => x.id === propertyId)!.hall!;
    expect(back.coolers).toEqual([0, 1, 2]);
    expect(back.transformers).toBe(0);
    expect("cooling" in back).toBe(false);
  });
});
