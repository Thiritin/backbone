import { describe, expect, it } from "vitest";
import { footprint, officePlan, rackTiles, siteAreas } from "../src/sim/20-world/layout";
import { HALL, hallKw } from "../src/sim/20-world/properties";
import { panelOf } from "../src/sim/60-infra/panels";
import { freePositions, spotOf } from "../src/sim/60-infra/status";
import { buyDevice, buyRack, mountDevice } from "../src/sim/90-actions/hardware";
import { cityCarriers, buildCarrier, editHall, editHallError, hallLayoutError, hallPath } from "../src/sim/90-actions/hall";
import { orderTransit } from "../src/sim/90-actions/network";
import { at, customer, edit, item, ok, ownHall, place, rack, snapshot, zone } from "./own-dc-hall";

const err = (e: ReturnType<typeof ownHall>, ed: Parameters<typeof editHall>[2]) => editHallError(e.s, e.hallId, ed)?.key;
const put = (e: ReturnType<typeof ownHall>, x: number, y: number, facing: "n" | "e" | "s" | "w" = "s", kind: "rack" = "rack") => err(e, { place: [{ kind, model: "rack-42", x, y, facing }] });

describe("own datacenter: free placement", () => {
  it("a rack stands on any free tile in all four facings, with its back to a wall or to another rack", () => {
    const e = ownHall();
    place(e, { kind: "rack", model: "rack-42", x: 3, y: 3, facing: "n" }, { kind: "rack", model: "rack-42", x: 6, y: 3, facing: "e" },
      { kind: "rack", model: "rack-42", x: 9, y: 3, facing: "s" }, { kind: "rack", model: "rack-42", x: 12, y: 3, facing: "w" });
    const loc = e.s.locations.find((l) => l.id === e.hallId)!;
    expect(Object.values(rackTiles(loc, e.s.racks, officePlan(e.s, loc))).map((t) => t.facing).sort()).toEqual(["e", "n", "s", "w"]);
    expect(put(e, 3, 1, "s")).toBeUndefined();
    place(e, { kind: "rack", model: "rack-42", x: 5, y: 4, facing: "n" });
    expect(put(e, 5, 5, "s")).toBeUndefined();
  });

  it("overlap, a fixture tile and the tile inside a door or doorway are occupied", () => {
    const e = ownHall();
    rack(e, 5, 2);
    expect(put(e, 5, 2)).toBe("error.occupied");
    expect(put(e, 1, 0)).toBe("error.occupied");
    expect(put(e, 1, 5)).toBe("error.occupied");
    expect(put(e, 15, 1)).toBe("error.occupied");
  });

  it("a body on a front tile is blocked, and so is a rack turned onto a body", () => {
    const e = ownHall();
    rack(e, 5, 2);
    expect(put(e, 5, 3)).toBe("error.blocked");
    rack(e, 9, 3);
    expect(put(e, 9, 2, "s")).toBe("error.blocked");
    expect(put(e, 8, 3, "e")).toBe("error.blocked");
  });

  it("two racks facing each other share one clearance tile", () => {
    const e = ownHall();
    place(e, { kind: "rack", model: "rack-42", x: 5, y: 2, facing: "s" }, { kind: "rack", model: "rack-42", x: 5, y: 4, facing: "n" });
    expect(hallLayoutError(e.s, e.hallId)).toBeNull();
  });

  it("a rack walled in has no way through, and the path finds a reachable front", () => {
    const e = ownHall();
    const r = (x: number, y: number, facing: "n" | "s") => ({ kind: "rack" as const, model: "rack-42" as const, x, y, facing });
    expect(edit(e, { place: [r(4, 2, "s"), r(3, 3, "n"), r(5, 3, "n"), r(4, 4, "s")] })).toEqual({ ok: false, error: "error.noPath" });
    rack(e, 5, 2);
    const path = hallPath(e.s, e.hallId, { x: 1, y: 5 }, { x: 5, y: 3 })!;
    expect(path[0]).toEqual({ x: 1, y: 5 });
    expect(path.at(-1)).toEqual({ x: 5, y: 3 });
    expect(hallPath(e.s, e.hallId, { x: 1, y: 5 }, { x: 5, y: 2 })).toBeNull();
    expect(hallPath(e.s, e.hallId, { x: 1, y: 5 }, siteAreas(e.s, e.s.locations.find((l) => l.id === e.hallId)!)[1].rect)).not.toBeNull();
  });

  it("vent and containment share a tile but never lie under a body; the wrong room refuses", () => {
    const e = ownHall();
    place(e, { kind: "vent", x: 4, y: 6, facing: "s", area: "hall" }, { kind: "containment", x: 4, y: 6, facing: "s", area: "hall" });
    rack(e, 8, 2);
    expect(err(e, { place: [{ kind: "vent", x: 8, y: 2, facing: "s", area: "hall" }] })).toBe("error.occupied");
    expect(err(e, { place: [{ kind: "transformer", x: 4, y: 6, facing: "s", area: "hall" }] })).toBe("error.wrongRoom");
    expect(err(e, { place: [{ kind: "ups", x: 3, y: 0, facing: "s", area: "xfmr" }] })).toBe("error.wrongRoom");
  });

  it("limits the transformers, switchgear and the last NOC desk, and refuses removing a transformer below the draw", () => {
    const e = ownHall();
    const second = item(e, "transformer", "xfmr");
    expect(err(e, { place: [{ kind: "transformer", x: 5, y: 0, facing: "s", area: "xfmr" }] })).toBe("error.limit");
    item(e, "switchgear", "xfmr");
    expect(err(e, { place: [{ kind: "switchgear", x: 5, y: 0, facing: "s", area: "xfmr" }] })).toBe("error.limit");
    e.hall().customers.push(customer(e, 1, null, null, 150));
    expect(err(e, { remove: [`item:${second}`] })).toBe("error.overload");
    const desk = e.hall().items.find((i) => i.kind === "nocdesk")!;
    expect(err(e, { remove: [`item:${desk.id}`] })).toBe("error.lastDesk");
  });
});

describe("own datacenter: racks in use", () => {
  it("a rack with devices cannot be removed; moving it keeps devices and cables and darkens it for 2 hours", () => {
    const e = ownHall();
    e.s.player = { ...e.s.player, at: e.hallId };
    const id = rack(e, 5, 2);
    const dev = ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId));
    ok(mountDevice(e.s, dev, id, 1));
    expect(err(e, { remove: [`rack:${id}`] })).toBe("error.notEmpty");
    const cables = JSON.stringify(e.s.cables);
    ok(edit(e, { move: [{ ref: `rack:${id}`, x: 8, y: 2, facing: "s" }] }));
    const r = e.s.racks.find((x) => x.id === id)!;
    expect(r.tile).toMatchObject({ x: 8, y: 2 });
    expect(r.arriveAt).toBe(e.s.hour + HALL.moveHours);
    expect(e.s.devices.find((d) => d.id === dev)!.rackId).toBe(id);
    expect(JSON.stringify(e.s.cables)).toBe(cables);
    expect(err(e, { move: [{ ref: `rack:${id}`, x: 10, y: 2, facing: "s" }] })).toBe("error.rackMoving");
  });

  it("a linked meet-me rack cannot leave the zone, and a customer's zone cannot move", () => {
    const e = ownHall();
    e.s.unlocks = ["network"];
    e.s.player = { ...e.s.player, at: e.hallId };
    const z = zone(e, "meetme", 2, 4, 2, "n");
    const id = ok(buyRack(e.s, e.hallId, "rack-42", freePositions(e.s, e.hallId)[0]));
    ok(edit(e, { move: [{ ref: `rack:${id}`, x: 2, y: 4, facing: "n" }] }));
    e.s.racks.find((r) => r.id === id)!.arriveAt = null;
    ok(mountDevice(e.s, ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId)), id, 1));
    const panel = ok(buyDevice(e.s, "patch-24f", "Pandoot", 1, e.hallId));
    ok(mountDevice(e.s, panel, id, 3));
    const carrier = cityCarriers("Frankfurt")[0].id;
    ok(buildCarrier(e.s, e.hallId, carrier));
    ok(orderTransit(e.s, e.hallId, carrier, 1, 0.2));
    expect(panelOf(e.s, id)?.id).toBe(panel);
    expect(err(e, { move: [{ ref: `rack:${id}`, x: 8, y: 6, facing: "s" }] })).toBe("error.rackLinked");
    expect(err(e, { move: [{ ref: `rack:${id}`, x: 3, y: 4, facing: "n" }] })).toBeUndefined();
    const c = zone(e, "colo", 6, 2, 2);
    e.hall().customers.push(customer(e, 1, { x: 6, y: 2, facing: "s" }, c));
    expect(err(e, { move: [{ ref: `zone:${c}`, x: 8, y: 2, facing: "s" }] })).toBe("error.locked");
    expect(err(e, { remove: [`zone:${z}`] })).toBe("error.locked");
  });
});

describe("own datacenter: edits and money", () => {
  it("a group move with rotation applies all or nothing", () => {
    const e = ownHall();
    const a = rack(e, 4, 2), b = rack(e, 8, 2);
    const before = snapshot(e.s);
    expect(edit(e, { move: [{ ref: `rack:${a}`, x: 4, y: 6, facing: "n" }, { ref: `rack:${b}`, x: 15, y: 1, facing: "n" }] })).toEqual({ ok: false, error: "error.occupied" });
    expect(snapshot(e.s)).toBe(before);
    ok(edit(e, { move: [{ ref: `rack:${a}`, x: 4, y: 6, facing: "n" }, { ref: `rack:${b}`, x: 8, y: 6, facing: "w" }] }));
    expect(e.s.racks.find((r) => r.id === a)!.tile).toMatchObject({ x: 4, y: 6, facing: "n" });
    expect(e.s.racks.find((r) => r.id === b)!.tile).toMatchObject({ x: 8, y: 6, facing: "w" });
  });

  it("refunds half the price paid and a refit transformer refunds nothing", () => {
    const e = ownHall();
    const crac = item(e, "crac"), cash = e.s.cash;
    ok(edit(e, { remove: [`item:${crac}`] }));
    expect(e.s.cash - cash).toBe(HALL.items.crac.price * HALL.refund);
    expect(e.s.ledger.at(-1)).toMatchObject({ key: "ledger.hallRefund" });
    const base = e.hall().items.find((i) => i.kind === "transformer")!, c2 = e.s.cash;
    item(e, "transformer", "xfmr");
    ok(edit(e, { remove: [`item:${base.id}`] }));
    expect(e.s.cash).toBe(c2 - HALL.items.transformer.price);
    expect(hallKw(e.s.properties.find((p) => p.id === e.propertyId)!)).toBe(100);
  });

  it("the NOC room is built for 30,000 and adds its area; containment before 2008 and a cage before 2015 are not yet available", () => {
    const e = ownHall();
    const loc = e.s.locations.find((l) => l.id === e.hallId)!, cash = e.s.cash;
    expect(siteAreas(e.s, loc).map((a) => a.id)).toEqual(["hall", "xfmr", "battery"]);
    place(e, { kind: "noc", x: 0, y: 0, facing: "n" });
    expect(cash - e.s.cash).toBe(HALL.noc.price);
    expect(siteAreas(e.s, loc).map((a) => a.id)).toContain("noc");
    expect(err(e, { place: [{ kind: "noc", x: 0, y: 0, facing: "n" }] })).toBe("error.limit");
    e.s.hour = at(2007);
    expect(err(e, { place: [{ kind: "containment", x: 4, y: 6, facing: "s", area: "hall" }] })).toBe("error.notYet");
    expect(err(e, { place: [{ kind: "zone", zone: "cage", length: 3, x: 2, y: 2, facing: "s" }] })).toBe("error.notYet");
    expect(footprint("generator", { x: 1, y: 1, facing: "e" }, false, { x: 10, y: 0 })).toHaveLength(4);
  });
});

describe("own datacenter: contracts", () => {
  it("a failing edit returns the key editHallError gives and leaves the state unchanged", () => {
    const e = ownHall();
    rack(e, 5, 2);
    const before = snapshot(e.s);
    for (const ed of [{ place: [{ kind: "rack" as const, model: "rack-42" as const, x: 5, y: 3, facing: "s" as const }] }, { place: [{ kind: "ups" as const, x: 3, y: 0, facing: "s" as const, area: "hall" as const }] }, { remove: ["rack:nope"] }]) {
      const key = editHallError(e.s, e.hallId, ed)!.key;
      expect(editHall(e.s, e.hallId, ed)).toEqual({ ok: false, error: key });
      expect(snapshot(e.s)).toBe(before);
    }
  });

  it("a delivered rack has no tile, counts as moving, draws no power and places for free", () => {
    const e = ownHall();
    const id = ok(buyRack(e.s, e.hallId, "rack-42", freePositions(e.s, e.hallId)[0]));
    const r = e.s.racks.find((x) => x.id === id)!;
    expect(r.tile).toBeUndefined();
    expect(spotOf(e.s, id)!.moving).toBe(true);
    const cash = e.s.cash;
    ok(edit(e, { place: [{ kind: "rack", rackId: id, x: 5, y: 2, facing: "s" }] }));
    expect(e.s.cash).toBe(cash);
    expect(r.tile).toMatchObject({ x: 5, y: 2 });
    expect(spotOf(e.s, id)!.moving).toBe(false);
  });
});
