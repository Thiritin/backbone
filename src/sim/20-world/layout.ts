import type { GameState, Location, Rack, Section, SpaceKind } from "../50-state";

export type Facing = "n" | "e" | "s" | "w";
// floor is set only in an office with more than one floor of server rooms; it counts from 1.
export interface Tile { x: number; y: number; facing: Facing; floor?: number }
export interface RoomSize { w: number; h: number }
// A fixed object on tile (x, y), w tiles wide; kind defaults to its id, so a room can hold two of a kind.
export interface Fixture { x: number; y: number; w?: number; kind?: string }
// A row of rack tiles from x0 to x1, fronts facing the cold aisle.
interface Row { y: number; x0: number; x1: number; facing: Facing }
// A room without rows lists its rack tiles, and a basement the shelf's tile.
interface Room { size: RoomSize; fixtures: Record<string, Fixture>; rows: Row[]; racks?: Tile[]; shelf?: Tile }

// Fixed objects stand against or hang on a wall, row y = 0 along the far wall and column x = 0 along the left one, except the basement's floor clutter. The door is always on the left wall; the suite's NOC desk stands in front of the rack rows so none hides it.
const ROOMS: Record<SpaceKind, Room> = {
  basement: {
    size: { w: 9, h: 7 },
    // The laundry corner and the desk take the far wall, under its two cellar windows; chair, mat, drain and lamp stand on the open floor.
    fixtures: {
      boiler: { x: 0, y: 0 }, washer: { x: 1, y: 0 }, window: { x: 1, y: 0 }, dryer: { x: 2, y: 0 },
      scanner: { x: 3, y: 0 }, hygrometer: { x: 3, y: 0 }, desk: { x: 4, y: 0 }, pc: { x: 4, y: 0 }, fan: { x: 4, y: 0 },
      fusebox: { x: 0, y: 1 }, jack: { x: 0, y: 1 }, shelf: { x: 0, y: 2 }, door: { x: 0, y: 4 }, letterbox: { x: 0, y: 5 },
      chair: { x: 4, y: 1 }, mat: { x: 1, y: 4 }, drain: { x: 3, y: 5 }, lamp: { x: 4, y: 4 },
      duct: { x: 0, y: 0 }, switch: { x: 0, y: 4 },
    },
    rows: [],
    shelf: { x: 5, y: 0, facing: "s" },
    racks: [{ x: 6, y: 0, facing: "s" }, { x: 7, y: 0, facing: "s" }],
  },
  share: {
    size: { w: 8, h: 6 },
    fixtures: { shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 4 }, xconnect: { x: 2, y: 0, w: 2 }, cooling: { x: 5, y: 0, w: 2 } },
    rows: [{ y: 2, x0: 2, x1: 5, facing: "s" }],
  },
  cage: {
    size: { w: 12, h: 8 },
    fixtures: {
      shelf: { x: 0, y: 1 }, pdu: { x: 11, y: 3 }, extinguisher: { x: 0, y: 4 }, door: { x: 0, y: 5 },
      xconnect: { x: 2, y: 0, w: 2 }, cooling: { x: 7, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" },
    },
    rows: [{ y: 2, x0: 2, x1: 9, facing: "s" }, { y: 4, x0: 2, x1: 9, facing: "n" }],
  },
  // Placeholder until the office room is drawn: a door and rows for four server-room sections.
  office: {
    size: { w: 12, h: 8 },
    fixtures: { door: { x: 0, y: 5 } },
    rows: [{ y: 2, x0: 2, x1: 9, facing: "s" }, { y: 4, x0: 2, x1: 9, facing: "n" }],
  },
  suite: {
    size: { w: 16, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, pdu: { x: 15, y: 3 }, extinguisher: { x: 0, y: 7 }, door: { x: 0, y: 8 },
      xconnect: { x: 2, y: 0, w: 2 }, noc: { x: 6, y: 10, w: 2 }, cooling: { x: 7, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" },
      dock: { x: 12, y: 0, w: 2 },
    },
    rows: [
      { y: 2, x0: 3, x1: 12, facing: "s" }, { y: 4, x0: 3, x1: 12, facing: "n" },
      { y: 6, x0: 3, x1: 12, facing: "s" }, { y: 8, x0: 3, x1: 12, facing: "n" },
    ],
  },
};

export const FIXTURES: Record<SpaceKind, Record<string, Fixture>> = Object.fromEntries(
  Object.entries(ROOMS).map(([k, r]) => [k, r.fixtures]),
) as Record<SpaceKind, Record<string, Fixture>>;

// An office's room comes from its sections, so office callers pass its plan; without one it is the placeholder.
const roomOf = (loc: Location, plan?: OfficePlan): Room => (loc.space === "office" && plan ? officeRoom(plan) : ROOMS[loc.space]);

export const fixtures = (loc: Location, plan?: OfficePlan) => roomOf(loc, plan).fixtures;

export function roomSize(loc: Location, plan?: OfficePlan): RoomSize {
  return roomOf(loc, plan).size;
}

// Every tile a fixture covers.
export function fixtureTiles(loc: Location, plan?: OfficePlan): { x: number; y: number }[] {
  return Object.values(fixtures(loc, plan)).flatMap((f) => Array.from({ length: f.w ?? 1 }, (_, i) => ({ x: f.x + i, y: f.y })));
}

// The tile inside the door, where the player stands on arriving.
export function entryTile(loc: Location, plan?: OfficePlan): { x: number; y: number } {
  const d = fixtures(loc, plan).door;
  return { x: d.x + 1, y: d.y };
}

// Rows of floor in front of the rack fronts.
export function coldAisles(loc: Location, plan?: OfficePlan): { y: number; x0: number; x1: number }[] {
  const out = new Map<number, { y: number; x0: number; x1: number }>();
  for (const r of roomOf(loc, plan).rows) {
    const y = r.y + (r.facing === "s" ? 1 : -1);
    out.set(y, { y, x0: r.x0, x1: r.x1 });
  }
  return [...out.values()];
}

const key = (t: { x: number; y: number; floor?: number }) => `${t.floor ?? 1},${t.x},${t.y}`;

// Tiles that take a rack: the rack rows, or the room's listed tiles. The basement's shelf has its own tile.
// An office's are the server rooms' tiles on every floor.
export function wallTiles(loc: Location, plan?: OfficePlan): Tile[] {
  if (loc.space === "office" && plan) return officeFloors(plan.sections).flatMap((floor) => officeRoom({ ...plan, floor }).racks!.map((t) => ({ ...t, floor })));
  const room = ROOMS[loc.space];
  return room.racks ?? room.rows.flatMap((r) => Array.from({ length: r.x1 - r.x0 + 1 }, (_, i) => ({ x: r.x0 + i, y: r.y, facing: r.facing })));
}

export function rackTiles(loc: Location, racks: Rack[], plan?: OfficePlan): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {}, shelf = ROOMS[loc.space].shelf;
  for (const r of here) if (r.model === "shelf" && shelf) out[r.id] = shelf;
  const spots = wallTiles(loc, plan), taken = new Set<string>(), valid = new Map(spots.map((t) => [key(t), t]));
  // A stored tile that is no longer a rack tile, as in saves from older layouts, gets a new one; facing follows the current layout.
  for (const r of here) {
    if (out[r.id]) continue;
    const t = r.tile && valid.get(key(r.tile));
    if (t && !taken.has(key(t))) { out[r.id] = t; taken.add(key(t)); }
  }
  const free = spots.filter((t) => !taken.has(key(t)));
  for (const r of here) if (!out[r.id] && free.length) out[r.id] = free.shift()!;
  return out;
}

export function freeRackTiles(loc: Location, racks: Rack[], plan?: OfficePlan): Tile[] {
  const taken = new Set(Object.values(rackTiles(loc, racks, plan)).map(key));
  return wallTiles(loc, plan).filter((t) => !taken.has(key(t)));
}

// GDD, Properties, The office room: one room per floor, the floor's sections side by side, each a block of SECTION_W by SECTION_H tiles.
// The floor of the first section starts with the reception strip: the hallway door, letterbox, kitchenette, printer and the player's desk.
// A desk block holds two islands of two desks facing each other; a server block a glass partition with a code-lock door, four rack tiles
// and the cooling; a block under refit is bare. A floor with neighbours up or down has the stairwell door in the left wall.
export interface OfficePlan { sections: Section[]; hour: number; floor: number }
export interface Seat { sectionId: string; index: number; floor: number; x: number; y: number; facing: Facing }
export const SECTION_W = 6, SECTION_H = 7, LOBBY_W = 4;

export const officePlan = (s: GameState, loc: Location, floor = 1): OfficePlan | undefined => {
  const p = s.properties.find((x) => x.locationId === loc.id && x.kind !== "basement");
  return p && { sections: p.sections, hour: s.hour, floor };
};

export const officeFloors = (sections: Section[]): number[] => [...new Set(sections.map((x) => x.floor))].sort((a, b) => a - b);

// Blocks of the plan's floor in building order, with the column each starts at.
function blocks(plan: OfficePlan): { x: Section; ox: number }[] {
  const lobby = plan.sections[0]?.floor === plan.floor ? LOBBY_W : 0;
  return plan.sections.filter((x) => x.floor === plan.floor).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map((x, i) => ({ x, ox: lobby + i * SECTION_W }));
}

// The four desks of a block: index 0 and 1 face the room's front from row 2, 2 and 3 face the wall from row 5, each centred on a two-tile desk.
const SEATS = [{ dx: 1, y: 2, facing: "s" }, { dx: 3, y: 2, facing: "s" }, { dx: 1, y: 5, facing: "n" }, { dx: 3, y: 5, facing: "n" }] as const;

export function officeSeats(plan: OfficePlan): Seat[] {
  return officeFloors(plan.sections).flatMap((floor) => blocks({ ...plan, floor })
    .filter(({ x }) => x.fit === "desks" && x.refitUntil <= plan.hour)
    .flatMap(({ x, ox }) => SEATS.map((d, index) => ({ sectionId: x.id, index, floor, x: ox + d.dx, y: d.y, facing: d.facing }))));
}

// The path a person walks from the door to a seat, as tile centres: down to the back row, along it, up the free last column of the block and across.
// The back row stays free in every block, so the walk passes server rooms through their code-lock door.
export function officeWalk(plan: OfficePlan, seat: Seat): { x: number; y: number }[] {
  const e = entryTile({ space: "office" } as Location, { ...plan, floor: seat.floor }), back = SECTION_H - 1, c = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });
  const lane = seat.facing === "n" ? seat.x : seat.x - SEATS[seat.index].dx + SECTION_W - 1;
  return [c(e.x, e.y), c(e.x, back), c(lane, back), c(lane, seat.y), c(seat.x, seat.y)].map((p, i, a) => (i && p.x === a[i - 1].x && p.y === a[i - 1].y ? null : p)).filter((p) => p !== null);
}

function officeRoom(plan: OfficePlan): Room {
  const bs = blocks(plan), lobby = bs[0]?.ox ?? 0, floors = officeFloors(plan.sections);
  const w = Math.max(lobby + bs.length * SECTION_W, LOBBY_W), f: Record<string, Fixture> = {}, racks: Tile[] = [], rows: Row[] = [];
  f.door = { x: 0, y: lobby ? 4 : SECTION_H - 1 };
  f.switch = { ...f.door, kind: "switch" };
  f.mat = { x: 1, y: f.door.y, kind: "mat" };
  f.duct = { x: 0, y: 0, kind: "duct" };
  if (floors.length > 1) f.stairs = { x: 0, y: lobby ? 2 : 1, kind: "stairs" };
  if (lobby) {
    Object.assign(f, {
      kitchen: { x: 0, y: 0, w: 2 }, bossdesk: { x: 2, y: 0, w: 2 }, bosschair: { x: 2, y: 1, w: 2, kind: "chair" }, printer: { x: 0, y: 1 },
      letterbox: { x: 0, y: 3 }, reception: { x: 2, y: 4, w: 2 }, plant: { x: 0, y: SECTION_H - 1 }, tube: { x: 1, y: 3, kind: "tube" },
    });
  }
  for (const { x, ox } of bs) {
    const id = x.id, refit = x.refitUntil > plan.hour;
    f[`tube${id}`] = { x: ox + 2, y: 3, w: 2, kind: "tube" };
    if (x.fit === "servers") {
      f[`partition${id}`] = { x: ox, y: 0, kind: "partition" };
      f[`cooling${id}`] = { x: ox + 1, y: 0, w: 2, kind: "cooling" };
      f[`tray${id}`] = { x: ox + 3, y: 0, w: 3, kind: "tray" };
      f[`pdu${id}`] = { x: ox + 5, y: 2, kind: "pdu" };
      f[`extinguisher${id}`] = { x: ox + 5, y: 5, kind: "extinguisher" };
      const row: Row = { y: 2, x0: ox + 1, x1: ox + 4, facing: "s" };
      rows.push(row);
      for (let i = row.x0; i <= row.x1; i++) racks.push({ x: i, y: row.y, facing: row.facing });
    } else {
      f[`window${id}`] = { x: ox + 1, y: 0, w: 2, kind: "owindow" };
      f[`board${id}`] = { x: ox + 3, y: 0, w: 2, kind: "whiteboard" };
      f[`plant${id}`] = { x: ox + 5, y: 0, kind: "plant" };
    }
    if (refit) {
      f[`buckets${id}`] = { x: ox + 2, y: 4, kind: "buckets" };
      f[`ladder${id}`] = { x: ox + 4, y: 1, kind: "ladder" };
      f[`tools${id}`] = { x: ox + 1, y: 5, kind: "toolbox" };
    } else if (x.fit === "desks") {
      SEATS.forEach((d, i) => {
        f[`desk${id}-${i}`] = { x: ox + d.dx, y: d.facing === "s" ? 3 : 4, w: 2, kind: d.facing === "s" ? "odesk-s" : "odesk-n" };
        f[`chair${id}-${i}`] = { x: ox + d.dx, y: d.y, w: 2, kind: d.facing === "s" ? "ochair-s" : "ochair-n" };
      });
      f[`bin${id}`] = { x: ox + 5, y: 1, kind: "bin" };
    }
  }
  return { size: { w, h: SECTION_H }, fixtures: f, rows, racks };
}
