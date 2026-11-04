import { describe, expect, it } from "vitest";
import { hallBackup, hallKw, HALL } from "../src/sim/20-world/properties";
import { buyRack } from "../src/sim/90-actions/hardware";
import { hallLayoutError } from "../src/sim/90-actions/hall";
import { freePositions } from "../src/sim/60-infra/status";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ok, ownHall } from "./own-dc-hall";

// A Halle hall as saved before free placement: rows of ten, three cooling units on the far wall, one extra transformer and every upgrade.
function oldSave() {
  const e = ownHall("fechenhalle");
  const r1 = ok(buyRack(e.s, e.hallId, "rack-42", freePositions(e.s, e.hallId)[0])), r2 = ok(buyRack(e.s, e.hallId, "rack-42", freePositions(e.s, e.hallId)[1]));
  e.s.racks.find((r) => r.id === r1)!.position = 1;
  e.s.racks.find((r) => r.id === r2)!.position = 12;
  const raw = JSON.parse(serialize(e.s));
  const h = raw.properties.find((p: { hall?: unknown }) => p.hall).hall;
  const rows = [0, 1, 2, 3, 4, 5].map((k) => ({ id: `row${k}`, x: 3, y: 2 + 2 * k, length: 10, facing: k % 2 ? "n" : "s" }));
  const zoneRows = { colo: { rowId: "row0", from: 4, length: 3 }, cage: { rowId: "row2", from: 0, length: 3 }, meetme: { rowId: "row1", from: 0, length: 2 } };
  for (const r of raw.racks) delete r.tile;
  Object.assign(h, {
    rows, coolers: [0, 1, 2], transformers: 1, feedB: true, ups: true, generator: true,
    zones: [{ id: "zc", kind: "colo", ...zoneRows.colo, builtAt: 0 }, { id: "zg", kind: "cage", ...zoneRows.cage, builtAt: 0 }, { id: "zm", kind: "meetme", ...zoneRows.meetme, builtAt: 0 }],
    customers: [{ id: "c1", name: "K1", position: 5, monthly: 100, since: 0, kw: 3, zoneId: "zc" }, { id: "c2", name: "K2", position: 21, monthly: 300, since: 0, kw: 3, zoneId: "zg" }],
    exchange: { id: "decix-fra", position: 11 }, carriers: [],
  });
  delete h.items; delete h.noc;
  raw.racks = raw.racks.map((r: { id: string }) => r);
  return { raw, hallId: e.hallId, r1, r2 };
}

describe("own datacenter: old saves", () => {
  it("rows become tiles, upgrades become items, and the layout passes the validator", () => {
    const { raw, hallId, r1, r2 } = oldSave();
    const s = deserialize(JSON.stringify(raw)), hall = s.properties.find((p) => p.hall)!.hall!, p = s.properties.find((x) => x.hall)!;
    expect(s.racks.find((r) => r.id === r1)!.tile).toEqual({ x: 3, y: 2, facing: "s" });
    expect(s.racks.find((r) => r.id === r2)!.tile).toEqual({ x: 4, y: 4, facing: "n" });
    expect(hall.customers[0]).toMatchObject({ id: "c1", tile: { x: 7, y: 2, facing: "s" } });
    expect(hall.customers[1]).toMatchObject({ id: "c2", tile: null, zoneId: "zg" });
    expect(hall.zones.map((z) => [z.id, z.x, z.y, z.facing])).toEqual([["zc", 7, 2, "s"], ["zg", 3, 6, "s"], ["zm", 3, 4, "n"]]);
    expect(hall.exchange).toEqual({ id: "decix-fra", tile: { x: 3, y: 4, facing: "n" } });
    const count = (k: string) => hall.items.filter((i) => i.kind === k).length;
    expect([count("crac"), count("transformer"), count("switchgear"), count("ups"), count("battery"), count("generator"), count("nocdesk")]).toEqual([3, 2, 1, 4, 3, 2, 1]);
    expect(hall.items.filter((i) => i.kind === "crac").every((i) => i.price === HALL.items.crac.price)).toBe(true);
    expect(hall.items.filter((i) => i.kind === "vent").length).toBeGreaterThan(0);
    expect(hallKw(p)).toBe(600);
    expect(hallBackup(hall)).toBe("ups+generator");
    expect(hall).not.toHaveProperty("rows");
    expect(hallLayoutError(s, hallId)).toBeNull();
    expect(deserialize(serialize(s)).properties.find((x) => x.hall)!.hall).toEqual(hall);
  });
});
