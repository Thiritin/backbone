import { describe, expect, it } from "vitest";
import { FIXTURES, footprint, officePlan, roomSize, seatsAt, siteAreas } from "../src/sim/20-world/layout";
import { isHalle } from "../src/sim/20-world/properties";
import { at, edit, item, ownHall, place } from "./own-dc-hall";
import { seating } from "../src/sim/60-infra/figures";
import { seatOf } from "../src/sim/90-actions/work-orders";
import { entryTile } from "../src/sim/20-world/layout";
import { newGame } from "../src/sim/50-state";

const inside = (s: { x: number; y: number }, w: number, h: number) => s.x >= 0 && s.y >= 0 && s.x < w && s.y < h;

describe("seats are in scene coordinates", () => {
  it("places hall and NOC room seats beside their desk, in hall tiles", () => {
    const e = ownHall();
    expect(edit(e, { place: [{ kind: "noc", x: 0, y: 0, facing: "s" }] }).ok).toBe(true);
    item(e, "nocdesk", "noc");
    item(e, "nocdesk", "hall");
    const loc = e.s.locations.find((l) => l.id === e.hallId)!, p = e.s.properties.find((x) => x.id === e.propertyId)!;
    const areas = siteAreas(e.s, loc), seats = seatsAt(e.s, loc), desks = p.hall!.items.filter((i) => i.kind === "nocdesk");
    expect(new Set(desks.map((d) => d.area))).toEqual(new Set(["hall", "noc"]));
    const bodies = new Set<string>();
    for (const i of desks) { const r = areas.find((a) => a.id === i.area)!.rect; for (const q of footprint(i.kind, i, isHalle(p.buildingId), r)) bodies.add(`${q.x},${q.y}`); }
    for (const seat of seats) {
      const d = desks.find((i) => seat.sectionId === `noc:${i.id}`)!, r = areas.find((a) => a.id === d.area)!.rect;
      const next = footprint(d.kind, d, isHalle(p.buildingId), r).some((q) => Math.abs(q.x - seat.x) + Math.abs(q.y - seat.y) === 1);
      expect(seat.x >= r.x && seat.y >= r.y && seat.x < r.x + r.w && seat.y < r.y + r.h).toBe(true);
      expect(next).toBe(true);
      expect(bodies.has(`${seat.x},${seat.y}`)).toBe(false);
    }
  });

  it("seats a sitter in front of a desk in every rotation, looking at it", () => {
    const e = ownHall();
    const spots = [[3, 2, "n"], [7, 2, "e"], [11, 2, "s"], [3, 6, "w"]] as const;
    for (const [x, y, facing] of spots) place(e, { kind: "nocdesk", area: "hall", x, y, facing });
    const loc = e.s.locations.find((l) => l.id === e.hallId)!, p = e.s.properties.find((x) => x.id === e.propertyId)!;
    const look = { n: "s", e: "w", s: "n", w: "e" } as const, step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const;
    for (const [x, y, facing] of spots) {
      const d = p.hall!.items.find((i) => i.kind === "nocdesk" && i.x === x && i.y === y)!, seat = seatsAt(e.s, loc).find((q) => q.sectionId === `noc:${d.id}`)!;
      expect(seat.facing).toBe(look[facing]);
      const front = footprint(d.kind, d, isHalle(p.buildingId)).map((q) => ({ x: q.x + step[facing][0], y: q.y + step[facing][1] }));
      expect(front.some((q) => q.x === seat.x && q.y === seat.y)).toBe(true);
    }
  });

  it("keeps the other location types inside their room", () => {
    const e = ownHall();
    const hall = e.s.locations.find((l) => l.id === e.hallId)!;
    const locs = [e.s.locations[0], ...(["share", "cage", "suite"] as const).map((space) => ({ ...hall, space }))];
    for (const loc of locs) {
      const { w, h } = roomSize(loc, officePlan(e.s, loc));
      for (const seat of seatsAt(e.s, loc)) expect(inside(seat, w, h)).toBe(true);
    }
    for (const space of ["share", "cage"] as const) {
      const l = { ...hall, space }, [seat] = seatsAt(e.s, l), t = FIXTURES[space].terminal;
      expect([seat.x, seat.y, seat.facing]).toEqual([t.x + 1, t.y, "w"]);
    }
    expect(newGame(1).locations[0].space).toBe("basement");
  });
});

describe("the player's seat", () => {
  const room = (hires: number) => {
    const e = ownHall(), loc = e.s.locations.find((l) => l.id === e.hallId)!, sec = `noc:${e.hall().items.find((i) => i.kind === "nocdesk")!.id}`;
    e.s.hour = at(2013, 3, 4, 10);
    e.s.player.at = e.hallId;
    for (let i = 0; i < hires; i++) e.s.staff.push({ id: `t${i}`, name: `t${i}`, role: "technician", skill: 50, talent: 50, salary: 3000, hiredAt: i, assignment: "queue", location: e.hallId, trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 1e9, refusedAt: null, team: e.s.teams[0].id, worked: 0, desk: { propertyId: e.propertyId, sectionId: sec, index: i } } as never);
    return { e, loc, seats: seatsAt(e.s, loc) };
  };
  const pt = (q: { x: number; y: number }) => `${q.x},${q.y}`;

  it("takes the first seat without hires", () => {
    const { e, loc, seats } = room(0);
    expect(pt(seatOf(e.s, loc.id, "player")!)).toBe(pt(seats[0]));
    expect(seating(e.s, loc, e.s.hour).find((x) => x.id === "player")).toMatchObject({ seated: true, at: seats[0] });
  });

  it("takes the next seat when a hire sits at the first desk seat", () => {
    const { e, loc, seats } = room(1);
    const at1 = seating(e.s, loc, e.s.hour);
    expect(pt(seatOf(e.s, loc.id, "player")!)).toBe(pt(seats[1]));
    expect(pt(at1.find((x) => x.id === "player")!.at)).toBe(pt(seats[1]));
    expect(pt(at1.find((x) => x.id === "t0")!.at)).toBe(pt(seats[0]));
  });

  it("stands at the entry when hires fill every seat", () => {
    const { e, loc, seats } = room(3);
    const mine = seating(e.s, loc, e.s.hour).find((x) => x.id === "player")!, entry = entryTile(loc, officePlan(e.s, loc));
    expect(seats).toHaveLength(3);
    expect(mine.seated).toBe(false);
    expect(pt(seatOf(e.s, loc.id, "player")!)).toBe(pt(entry));
  });
});
