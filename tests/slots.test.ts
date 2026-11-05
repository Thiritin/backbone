import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { FIXTURES, fixtures, officePlan, type Fixture } from "../src/sim/20-world/layout";
import { listingById } from "../src/sim/20-world/properties";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { DESK_SLOTS, DOOR_END, nearDoor, wallSlot, WALL_SLOTS } from "../src/ui/world/slots";
import { newGame } from "./fixtures";

type Span = readonly [number, number];
const meets = (a: Span, b: Span) => a[0] < b[1] && b[0] < a[1];
const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

// Wall items by the tile they draw in; the switch draws one tile past its door's.
function wallSpans(fx: Record<string, Fixture>) {
  const tiles = new Map<string, [string, Span][]>();
  for (const [name, f] of Object.entries(fx)) {
    const id = f.kind ?? name;
    if (!(id in WALL_SLOTS)) continue;
    const left = f.x === 0 && f.y > 0, at = id === "switch" ? (left ? { x: f.x, y: f.y - 1 } : { x: f.x + 1, y: f.y }) : f;
    tiles.set(key(at), [...(tiles.get(key(at)) ?? []), [id, WALL_SLOTS[id as keyof typeof WALL_SLOTS]]]);
  }
  return tiles;
}

describe("wall slots", () => {
  const rooms: [string, Record<string, Fixture>][] = [["basement", FIXTURES.basement]];
  const s = newGame(31);
  s.cash = 5_000_000;
  s.hour = hourOf(new Date(Date.UTC(2012, 2, 12, 10)));
  rentSection(s, "zeilwerk", freeSections(s, listingById("zeilwerk")!)[0]);
  const loc = s.locations.find((l) => l.space === "office")!;
  rooms.push(["office", fixtures(loc, officePlan(s, loc))]);

  for (const [name, fx] of rooms) {
    it(`keeps ${name} wall items apart in their tile`, () => {
      for (const items of wallSpans(fx).values()) for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) expect(meets(items[i][1], items[j][1])).toBe(false);
    });
  }
  it("keeps items beside the door clear of its frame and of the switch", () => {
    for (const [, fx] of rooms) {
      for (const [name, f] of Object.entries(fx)) {
        const id = f.kind ?? name;
        if (id !== "phone" && id !== "letterbox") continue;
        const near = nearDoor(f, fx.door), [a, b] = wallSlot(id, near);
        if (near) expect(b).toBeLessThanOrEqual(DOOR_END);
        if (f.y === fx.door.y - 1) expect(a).toBeGreaterThan(WALL_SLOTS.switch[1]);
      }
    }
  });
  it("covers the switch tile in both rooms", () => {
    for (const [, fx] of rooms) expect([...wallSpans(fx).values()].some((v) => v.length > 1)).toBe(true);
  });
});

describe("desk slots", () => {
  it("keeps items in a column disjoint", () => {
    for (const col of Object.values(DESK_SLOTS)) {
      const r = Object.values(col);
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        expect(meets([r[i].x0, r[i].x1], [r[j].x0, r[j].x1]) && meets([r[i].y0, r[i].y1], [r[j].y0, r[j].y1])).toBe(false);
      }
    }
  });
});
