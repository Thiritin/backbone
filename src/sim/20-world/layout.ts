import type { GameState, Location, Rack, Section, SpaceKind } from "../50-state";
import { datacenterById } from "./datacenters";

export type Facing = "n" | "e" | "s" | "w";
// floor is set only in an office with more than one floor of server rooms; it counts from 1.
export interface Tile { x: number; y: number; facing: Facing; floor?: number }
export interface RoomSize { w: number; h: number }
// A fixed object on tile (x, y), w tiles wide; kind defaults to its id, so a room can hold two of a kind.
export interface Fixture { x: number; y: number; w?: number; kind?: string }
type Rented = Exclude<SpaceKind, "basement">;
// A rented room's hall: rack rows at y from x0 to x1, each with the way it faces in a hall with aisles; without aisles every row faces the near side. Without `mine` every rack tile is the player's (a suite); with it, the player's tiles are cut from the given rows and the rest hold neighbours' racks. The player's rows are the nearest, so no neighbour hides them.
interface Hall { size: RoomSize; fixtures: Record<string, Fixture>; rows: [number, Facing][]; x0: number; x1: number; mine?: (positions: number) => { x0: number; cols: number; rows: number[] } }
// The player's cage: the tiles inside the fence, and the column of the fence door on its near side.
export interface Cage { x0: number; y0: number; x1: number; y1: number; door: number }

const BASEMENT = {
  size: { w: 9, h: 7 },
  // The laundry corner and the desk take the far wall, under its two cellar windows; chair, mat, drain and lamp stand on the open floor.
  fixtures: {
    boiler: { x: 0, y: 0 }, washer: { x: 1, y: 0 }, window: { x: 1, y: 0 }, dryer: { x: 2, y: 0 },
    scanner: { x: 3, y: 0 }, hygrometer: { x: 3, y: 0 }, desk: { x: 4, y: 0 }, pc: { x: 4, y: 0 }, fan: { x: 4, y: 0 },
    fusebox: { x: 0, y: 1 }, jack: { x: 0, y: 1 }, shelf: { x: 0, y: 2 }, door: { x: 0, y: 4 }, letterbox: { x: 0, y: 5 },
    chair: { x: 4, y: 1 }, mat: { x: 1, y: 4 }, drain: { x: 3, y: 5 }, lamp: { x: 4, y: 4 },
    duct: { x: 0, y: 0 }, switch: { x: 0, y: 4 },
  } as Record<string, Fixture>,
  // The shelf's tile, and the tiles left for racks bought later.
  shelf: { x: 5, y: 0, facing: "s" } as Tile,
  racks: [{ x: 6, y: 0, facing: "s" }, { x: 7, y: 0, facing: "s" }] as Tile[],
};

// Fixed objects stand against or hang on a wall, row y = 0 along the far wall and column x = 0 along the left one, or at a row's end. The door is always on the left wall and opens onto a walkway; the suite's NOC desk stands in front of the rack rows so none hides it.
const HALLS: Record<Rented, Hall> = {
  share: {
    size: { w: 12, h: 8 },
    fixtures: {
      shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 7 },
      cooling: { x: 3, y: 0, w: 2 }, cooling2: { x: 7, y: 0, w: 2, kind: "cooling" }, pdu: { x: 11, y: 6 }, cart: { x: 11, y: 4 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"]], x0: 2, x1: 10,
    mine: (n) => ({ x0: 6, cols: n, rows: [6] }),
  },
  cage: {
    size: { w: 14, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 5 },
      cooling: { x: 4, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" }, pdu: { x: 13, y: 6 }, cart: { x: 13, y: 10 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"], [8, "n"]], x0: 2, x1: 12,
    // Four positions fill one row, eight two rows of four, sixteen two rows of eight.
    mine: (n) => ({ x0: 3, cols: n > 8 ? 8 : 4, rows: n > 4 ? [6, 8] : [6] }),
  },
  // Placeholder until the office room is drawn: a door and rows for four server-room sections.
  office: {
    size: { w: 12, h: 8 },
    fixtures: { door: { x: 0, y: 5 } },
    rows: [[2, "s"], [4, "n"]], x0: 2, x1: 9,
  },
  suite: {
    size: { w: 16, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, door: { x: 0, y: 7 }, extinguisher: { x: 0, y: 9 },
      cooling: { x: 6, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" }, dock: { x: 12, y: 0, w: 2 },
      pdu: { x: 15, y: 3 }, noc: { x: 6, y: 10, w: 2 }, cart: { x: 14, y: 10 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"], [8, "n"]], x0: 3, x1: 12,
  },
};

export const FIXTURES: Record<SpaceKind, Record<string, Fixture>> = {
  basement: BASEMENT.fixtures, share: HALLS.share.fixtures, cage: HALLS.cage.fixtures, suite: HALLS.suite.fixtures, office: HALLS.office.fixtures,
};

// An office's room comes from its sections, so office callers pass its plan; without one it is the placeholder hall.
const officeOf = (loc: Location, plan?: OfficePlan): OfficeRoom | null => (loc.space === "office" && plan ? officeRoom(plan) : null);

export const fixtures = (loc: Location, plan?: OfficePlan) => officeOf(loc, plan)?.fixtures ?? FIXTURES[loc.space];

export function roomSize(loc: Location, plan?: OfficePlan): RoomSize {
  const o = officeOf(loc, plan);
  if (o) return o.size;
  return loc.space === "basement" ? BASEMENT.size : HALLS[loc.space].size;
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

export const hasAisles = (loc: Location) => !!loc.dc && datacenterById(loc.dc).aisles;

// The fence around a cage, one tile clear of its racks.
export function cage(loc: Location): Cage | null {
  if (loc.space !== "cage") return null;
  const hall = HALLS.cage, m = hall.mine!(loc.positions);
  return { x0: m.x0 - 1, y0: m.rows[0] - 1, x1: m.x0 + m.cols, y1: m.rows[m.rows.length - 1] + 1, door: m.x0 };
}

// Every rack tile of a hall and whether it is the player's. Nothing stands inside a cage's fence but the player's racks.
function hallTiles(loc: Location): (Tile & { mine: boolean })[] {
  if (loc.space === "basement") return [];
  const hall = HALLS[loc.space], aisles = hasAisles(loc), m = hall.mine?.(loc.positions), c = cage(loc);
  return hall.rows.flatMap(([y, f]) => Array.from({ length: hall.x1 - hall.x0 + 1 }, (_, k) => {
    const x = hall.x0 + k, facing: Facing = aisles ? f : "s";
    return { x, y, facing, mine: !m || (m.rows.includes(y) && x >= m.x0 && x < m.x0 + m.cols) };
  })).filter((t) => t.mine || !c || t.x < c.x0 || t.x > c.x1 || t.y < c.y0 || t.y > c.y1);
}

// Other tenants' racks on the hall floor, drawn from the layout and never part of the game state.
export function neighbourRacks(loc: Location): Tile[] {
  return hallTiles(loc).filter((t) => !t.mine).map(({ x, y, facing }) => ({ x, y, facing }));
}

// Rows of floor in front of the rack fronts.
export function walkways(loc: Location, plan?: OfficePlan): { y: number; x0: number; x1: number }[] {
  const o = officeOf(loc, plan);
  if (o) return o.rows.map((r) => ({ y: r.y + 1, x0: r.x0, x1: r.x1 }));
  if (loc.space === "basement") return [];
  const hall = HALLS[loc.space], out = new Map<number, { y: number; x0: number; x1: number }>();
  for (const t of hallTiles(loc)) {
    const y = t.y + (t.facing === "s" ? 1 : -1);
    out.set(y, { y, x0: hall.x0, x1: hall.x1 });
  }
  return [...out.values()];
}

const key = (t: { x: number; y: number; floor?: number }) => `${t.floor ?? 1},${t.x},${t.y}`;

// Tiles that take a rack: the basement's listed tiles beside the shelf, or in a rented room the player's part of the rack rows.
// An office's are the server rooms' tiles on every floor.
export function wallTiles(loc: Location, plan?: OfficePlan): Tile[] {
  if (loc.space === "office" && plan) return officeFloors(plan.sections).flatMap((floor) => officeRoom({ ...plan, floor }).racks.map((t) => ({ ...t, floor })));
  if (loc.space === "basement") return BASEMENT.racks;
  return hallTiles(loc).filter((t) => t.mine).map(({ x, y, facing }) => ({ x, y, facing }));
}

export function rackTiles(loc: Location, racks: Rack[], plan?: OfficePlan): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {}, shelf = loc.space === "basement" ? BASEMENT.shelf : undefined;
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

// One office floor; rows are its server rooms' rack rows, fronts to the room.
interface OfficeRoom { size: RoomSize; fixtures: Record<string, Fixture>; rows: { y: number; x0: number; x1: number }[]; racks: Tile[] }

function officeRoom(plan: OfficePlan): OfficeRoom {
  const bs = blocks(plan), lobby = bs[0]?.ox ?? 0, floors = officeFloors(plan.sections);
  const w = Math.max(lobby + bs.length * SECTION_W, LOBBY_W), f: Record<string, Fixture> = {}, racks: Tile[] = [], rows: OfficeRoom["rows"] = [];
  f.door = { x: 0, y: lobby ? 4 : SECTION_H - 1 };
  f.switch = { ...f.door, kind: "switch" };
  f.mat = { x: 1, y: f.door.y, kind: "mat" };
  f.duct = { x: 0, y: 0, kind: "duct" };
  if (floors.length > 1) f.stairs = { x: 0, y: lobby ? 2 : 1, kind: "stairs" };
  if (lobby) {
    Object.assign(f, {
      kitchen: { x: 0, y: 0, w: 2 }, bossdesk: { x: 2, y: 0, w: 2 }, bosschair: { x: 3, y: 1, kind: "chair" }, printer: { x: 0, y: 1 },
      letterbox: { x: 0, y: 3 }, reception: { x: 2, y: 4, w: 2 }, plant: { x: 0, y: SECTION_H - 1 }, tube: { x: 1, y: 3, kind: "tube" },
    });
  }
  for (const { x, ox } of bs) {
    const id = x.id, refit = x.refitUntil > plan.hour;
    f[`tube${id}`] = { x: ox + 2, y: 3, w: 2, kind: "tube" };
    if (x.fit === "servers") {
      // The glass partition runs one piece per row so it sorts between the blocks; its door sits on the walk row.
      if (ox) for (let y = 0; y < SECTION_H; y++) f[`partition${id}-${y}`] = { x: ox, y, kind: y === SECTION_H - 1 ? "codedoor" : "partition" };
      f[`cooling${id}`] = { x: ox + 1, y: 0, w: 2, kind: "cooling" };
      f[`tray${id}`] = { x: ox + 3, y: 0, w: 3, kind: "tray" };
      f[`pdu${id}`] = { x: ox + 5, y: 2, kind: "pdu" };
      f[`extinguisher${id}`] = { x: ox + 5, y: 0, kind: "extinguisher" };
      const row = { y: 2, x0: ox + 1, x1: ox + 4 };
      rows.push(row);
      for (let i = row.x0; i <= row.x1; i++) racks.push({ x: i, y: row.y, facing: "s" });
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
