import type { AreaId, GameState, Hall as OwnHall, HallItem, HallItemKind, Location, Rack, Section, SpaceKind } from "../50-state";
import { datacenterById } from "./datacenters";
import { exchangeById } from "../10-catalog/network";
import { customerSpots, HALL, hallCapacity, holdsDesks, isHalle, stepTile, zoneSpots } from "./properties";

export type Facing = "n" | "e" | "s" | "w";
// floor is set only in an office with more than one floor of server rooms; it counts from 1.
export interface Tile { x: number; y: number; facing: Facing; floor?: number }
export interface RoomSize { w: number; h: number }
// A fixed object on tile (x, y), w tiles wide; kind defaults to its id, so a room can hold two of a kind.
export interface Fixture { x: number; y: number; w?: number; h?: number; kind?: string }
type Rented = Exclude<SpaceKind, "basement" | "hall">;
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
    fusebox: { x: 0, y: 1 }, jack: { x: 0, y: 1 }, shelf: { x: 0, y: 2 }, door: { x: 0, y: 4 }, letterbox: { x: 0, y: 5 }, phone: { x: 0, y: 3 },
    chair: { x: 4, y: 1 }, mat: { x: 1, y: 4 }, drain: { x: 3, y: 5 }, lamp: { x: 4, y: 4 },
    duct: { x: 0, y: 0 }, switch: { x: 0, y: 4 }, corkboard: { x: 0, y: 6 },
  } as Record<string, Fixture>,
  // The shelf's tile, and the tiles left for racks bought later.
  shelf: { x: 6, y: 0, facing: "s" } as Tile,
  racks: [{ x: 7, y: 0, facing: "s" }, { x: 8, y: 0, facing: "s" }] as Tile[],
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
  hall: HALLS.office.fixtures,
};

// An office's room comes from its sections and an own hall's from its rows, so their callers pass the plan; without one it is the placeholder hall.
const officeOf = (loc: Location, plan?: OfficePlan): OfficeRoom | null =>
  loc.space === "office" && plan ? officeRoom(plan) : loc.space === "hall" && plan?.hall ? hallRoom(plan.hall, plan.capacity ?? 0, !!plan.dock) : null;

export const fixtures = (loc: Location, plan?: OfficePlan) => officeOf(loc, plan)?.fixtures ?? FIXTURES[loc.space];

export function roomSize(loc: Location, plan?: OfficePlan): RoomSize {
  const o = officeOf(loc, plan);
  if (o) return o.size;
  return loc.space === "basement" || loc.space === "hall" ? BASEMENT.size : HALLS[loc.space].size;
}

// Every tile a fixture covers.
export function fixtureTiles(loc: Location, plan?: OfficePlan): { x: number; y: number }[] {
  return Object.values(fixtures(loc, plan)).flatMap((f) => Array.from({ length: (f.w ?? 1) * (f.h ?? 1) }, (_, i) => ({ x: f.x + (i % (f.w ?? 1)), y: f.y + Math.floor(i / (f.w ?? 1)) })));
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
  if (loc.space === "basement" || loc.space === "hall") return [];
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
  if (loc.space === "basement" || loc.space === "hall") return [];
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
  if (loc.space === "hall") return hallFloor(loc, plan);
  if (loc.space === "office" && plan) return officeFloors(plan.sections).flatMap((floor) => officeRoom({ ...plan, floor }).racks.map((t) => ({ ...t, floor })));
  if (loc.space === "basement") return BASEMENT.racks;
  return hallTiles(loc).filter((t) => t.mine).map(({ x, y, facing }) => ({ x, y, facing }));
}

export function rackTiles(loc: Location, racks: Rack[], plan?: OfficePlan): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {}, shelf = loc.space === "basement" ? BASEMENT.shelf : undefined;
  for (const r of here) if (r.model === "shelf" && shelf) out[r.id] = shelf;
  // An own hall's rack stands on its own tile; a delivered one has none.
  if (loc.space === "hall") {
    for (const r of here) if (r.tile) out[r.id] = r.tile;
    return out;
  }
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

// A share holds one rack; the player's other shares in the same datacenter stand nearest it in its row, in place of tenants' racks.
export function shareMates(loc: Location, locations: Location[], racks: Rack[], own: Record<string, Tile>): Record<string, Tile> {
  const mine = Object.values(own)[0];
  if (loc.space !== "share" || !mine) return {};
  const mates = racks.filter((r) => r.locationId !== loc.id && locations.some((l) => l.id === r.locationId && l.space === "share" && l.dc === loc.dc));
  const spots = neighbourRacks(loc).filter((t) => t.y === mine.y).sort((a, b) => Math.abs(a.x - mine.x) - Math.abs(b.x - mine.x) || b.x - a.x);
  return Object.fromEntries(mates.slice(0, spots.length).map((r, i) => [r.id, { ...spots[i], facing: mine.facing }]));
}

// Every tile of a hall's floor area that no fixture covers.
function hallFloor(loc: Location, plan?: OfficePlan): Tile[] {
  const o = officeOf(loc, plan);
  if (!o || !plan?.hall) return [];
  const { w, h } = hallSize(plan.capacity ?? 0, !!plan.dock), fixed = new Set(fixtureTiles(loc, plan).map(key));
  return Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w), facing: "s" as Facing })).filter((t) => !fixed.has(key(t)));
}

export function freeRackTiles(loc: Location, racks: Rack[], plan?: OfficePlan): Tile[] {
  if (loc.space === "hall" && plan?.hall) {
    const h = plan.hall, bodies = new Set<string>();
    for (const t of [...Object.values(rackTiles(loc, racks, plan)), ...customerTiles(loc, plan).map((c) => c.tile), ...h.zones.flatMap(zoneSpots)]) bodies.add(key(t));
    for (const i of h.items) if (HALL.items[i.kind].layer === "body" && i.area === "hall") for (const p of footprint(i.kind, i, !!plan.dock)) bodies.add(key(p));
    return hallFloor(loc, plan).filter((t) => !bodies.has(key(t)));
  }
  const taken = new Set([...Object.values(rackTiles(loc, racks, plan)), ...customerTiles(loc, plan).map((c) => c.tile)].map(key));
  return wallTiles(loc, plan).filter((t) => !taken.has(key(t)));
}

// GDD, Properties, The office room: one room per floor, the floor's sections side by side, each a block of SECTION_W by SECTION_H tiles.
// The floor of the first section starts with the reception strip: the hallway door, letterbox, kitchenette, printer and the player's desk.
// A desk block holds two islands of two desks facing each other; a server block a glass partition with a code-lock door, four rack tiles
// and the cooling; a block under refit is bare. A floor with neighbours up or down has the stairwell door in the left wall.
// An own hall's plan carries the hall, its capacity in positions and whether it has a loading dock.
export interface OfficePlan { sections: Section[]; hour: number; floor: number; hall?: OwnHall; capacity?: number; dock?: boolean }
export interface Seat { sectionId: string; index: number; floor: number; x: number; y: number; facing: Facing }
export const SECTION_W = 6, SECTION_H = 7, LOBBY_W = 4;

export const officePlan = (s: GameState, loc: Location, floor = 1): OfficePlan | undefined => {
  const h = s.properties.find((x) => x.hall?.locationId === loc.id);
  if (h) return { sections: [], hour: s.hour, floor: 1, hall: h.hall, capacity: hallCapacity(h), dock: isHalle(h.buildingId) };
  const p = s.properties.find((x) => x.locationId === loc.id && x.kind !== "basement");
  return p && { sections: p.sections.filter((x) => x.fit !== "hall"), hour: s.hour, floor };
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
    .filter(({ x }) => holdsDesks(x.fit) && x.refitUntil <= plan.hour)
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
export interface OfficeRoom { size: RoomSize; fixtures: Record<string, Fixture>; rows: { y: number; x0: number; x1: number }[]; racks: Tile[] }

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
      letterbox: { x: 0, y: 3 }, reception: { x: 2, y: 4, w: 2 }, phone: { x: 0, y: 5 }, plant: { x: 0, y: SECTION_H - 1 }, tube: { x: 1, y: 3, kind: "tube" },
      corkboard: { x: 0, y: 1 },
    });
  }
  for (const { x, ox } of bs) {
    const id = x.id, refit = x.refitUntil > plan.hour;
    // The office line's wall socket sits in the floor's first server room or closet.
    if (!f.jack && (x.fit === "servers" || x.fit === "closet")) f.jack = { x: ox + 4, y: 0, kind: "jack" };
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
      // A closet stands in the far right corner over its one rack tile.
      if (x.fit === "closet") {
        f[`closet${id}`] = { x: ox + 5, y: 0, kind: "closet" };
        racks.push({ x: ox + 5, y: 0, facing: "s" });
      } else f[`plant${id}`] = { x: ox + 5, y: 0, kind: "plant" };
    }
    if (refit) {
      f[`buckets${id}`] = { x: ox + 2, y: 4, kind: "buckets" };
      f[`ladder${id}`] = { x: ox + 4, y: 1, kind: "ladder" };
      f[`tools${id}`] = { x: ox + 1, y: 5, kind: "toolbox" };
    } else if (holdsDesks(x.fit)) {
      SEATS.forEach((d, i) => {
        f[`desk${id}-${i}`] = { x: ox + d.dx, y: d.facing === "s" ? 3 : 4, w: 2, kind: d.facing === "s" ? "odesk-s" : "odesk-n" };
        f[`chair${id}-${i}`] = { x: ox + d.dx, y: d.y, w: 2, kind: d.facing === "s" ? "ochair-s" : "ochair-n" };
      });
      f[`bin${id}`] = { x: ox + 5, y: 1, kind: "bin" };
    }
  }
  return { size: { w, h: SECTION_H }, fixtures: f, rows, racks };
}

// GDD, Own datacenter, In the room. The hall area is wide enough for the dock in a Halle and grows two rows deep per ten
// positions; the transformer and battery rooms stand on its right side and the NOC room, once built, below its near side.
// Everything stands on a tile with a facing inside an area.
export const hallSize = (capacity: number, dock = false): RoomSize => ({
  w: Math.max(16, 4 + 2 * Math.ceil(capacity / 8) + (dock ? 3 : 0)), h: 4 + 2 * Math.max(2, Math.ceil(capacity / 10)),
});

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
// A rectangle of the location's scene: what it accepts and where its passages lead. A passage tile lies in this area and joins
// the facing tile of the area `to`.
export interface Area { id: AreaId; rect: Rect; floor: "raised" | "concrete" | "epoxy" | "office" | "outdoor"; accepts: string[]; passages: { tile: Pt; to: AreaId }[] }

const accepting = (id: AreaId): string[] => [...(id === "hall" ? ["rack", "zone"] : []), ...(Object.keys(HALL.items) as HallItemKind[]).filter((k) => HALL.items[k].areas.includes(id))];

// The areas of a hall from its size; the NOC room exists once built.
export function areasOf(size: RoomSize, noc: boolean): Area[] {
  const { w: W, h: H } = size, S = Math.ceil(H / 2), A = HALL.annex.w;
  const out: Area[] = [
    { id: "hall", rect: { x: 0, y: 0, w: W, h: H }, floor: "raised", accepts: accepting("hall"), passages: [{ tile: { x: W - 1, y: 1 }, to: "xfmr" }, { tile: { x: W - 1, y: S + 1 }, to: "battery" }] },
    { id: "xfmr", rect: { x: W, y: 0, w: A, h: S }, floor: "concrete", accepts: accepting("xfmr"), passages: [{ tile: { x: W, y: 1 }, to: "hall" }] },
    { id: "battery", rect: { x: W, y: S, w: A, h: H - S }, floor: "epoxy", accepts: accepting("battery"), passages: [{ tile: { x: W, y: S + 1 }, to: "hall" }] },
  ];
  if (noc) {
    out.push({ id: "noc", rect: { x: 0, y: H, w: HALL.noc.w, h: HALL.noc.d }, floor: "office", accepts: accepting("noc"), passages: [{ tile: { x: 3, y: H }, to: "hall" }] });
    out[0].passages.push({ tile: { x: 3, y: H - 1 }, to: "noc" });
  }
  return out;
}

// The areas of a hall location in scene tiles; plan-site adds the yard here.
export function siteAreas(s: GameState, loc: Location): Area[] {
  const p = s.properties.find((x) => x.hall?.locationId === loc.id);
  return p?.hall ? areasOf(hallSize(hallCapacity(p), isHalle(p.buildingId)), p.hall.noc) : [];
}

export const areaAt = (areas: Area[], p: Pt): Area | undefined => areas.find((a) => p.x >= a.rect.x && p.y >= a.rect.y && p.x < a.rect.x + a.rect.w && p.y < a.rect.y + a.rect.h);

// Scene tiles an object covers. w runs along its front, d deep; facing e or w swaps the axes. x and y are area-local, so origin is the area's corner.
export function footprint(kind: HallItemKind, item: Pick<HallItem, "x" | "y" | "facing">, isHalleBuilding: boolean, origin: Pt = { x: 0, y: 0 }): Pt[] {
  const spec = HALL.items[kind], w = typeof spec.w === "object" ? spec.w[isHalleBuilding ? "halle" : "office"] : spec.w;
  const alongX = item.facing === "n" || item.facing === "s", fw = alongX ? w : spec.d, fh = alongX ? spec.d : w;
  return Array.from({ length: fw * fh }, (_, i) => ({ x: origin.x + item.x + (i % fw), y: origin.y + item.y + Math.floor(i / fw) }));
}
// The tile in front of a tile and the one behind it.
export const intake = (t: Pt & { facing: Facing }): Pt => stepTile(t, t.facing, 1);
export const exhaust = (t: Pt & { facing: Facing }): Pt => stepTile(t, t.facing, -1);

export function hallRoom(hall: OwnHall, capacity: number, dock: boolean): OfficeRoom {
  const hs = hallSize(capacity, dock), f: Record<string, Fixture> = {}, areas = areasOf(hs, hall.noc), { w: W, h: H } = hs;
  f.door = { x: 0, y: H - 3 };
  f.switch = { ...f.door, kind: "switch" };
  f.meetme = { x: 0, y: 3, kind: "meetmedoor" };
  f.extinguisher = { x: 0, y: 5, kind: "extinguisher" };
  f.camera = { x: 1, y: 0, kind: "camera" };
  f.plan = { x: 0, y: H - 2, kind: "planboard" };
  f.mainboard = { x: W + 1, y: 0, kind: "mainboard" };
  // The first desk of the hall stands where the NOC counter used to be drawn.
  const desk = hall.items.find((i) => i.kind === "nocdesk" && i.area === "hall");
  if (desk) f.noc = { x: desk.x, y: desk.y, w: 3, kind: "noc" };
  if (dock) f.dock = { x: W - 4, y: 0, w: 3, kind: "dock" };
  // The room draws a cooling unit as a fixture on the tiles of each CRAC item.
  for (const i of hall.items) if (i.kind === "crac") { const along = i.facing === "n" || i.facing === "s"; f[`cooling${i.id}`] = { x: i.x, y: i.y, ...(along ? { w: 2 } : { h: 2 }), kind: "cooling" }; }
  const size = { w: Math.max(...areas.map((a) => a.rect.x + a.rect.w)), h: Math.max(...areas.map((a) => a.rect.y + a.rect.h)) };
  return { size, fixtures: f, rows: [], racks: [] };
}

// Spots with a body in a hall's candidate or current layout: customers' tiles, the exchange and zone tiles.
export function customerTiles(loc: Location, plan?: OfficePlan): { id: string; name: string; tile: Tile }[] {
  if (loc.space !== "hall" || !plan?.hall) return [];
  const h = plan.hall;
  const held = h.customers.flatMap((c) => customerSpots(h, c).map((tile) => ({ id: c.id, name: c.name, tile })));
  if (h.exchange?.tile) held.push({ id: h.exchange.id, name: exchangeById(h.exchange.id)?.name ?? h.exchange.id, tile: h.exchange.tile });
  return held;
}

// The tiles a zone covers, with the zone's id and kind.
export function zoneTiles(loc: Location, plan?: OfficePlan): { id: string; kind: "colo" | "cage" | "meetme"; tiles: Tile[] }[] {
  if (loc.space !== "hall" || !plan?.hall) return [];
  return plan.hall.zones.map((z) => ({ id: z.id, kind: z.kind, tiles: zoneSpots(z) }));
}
