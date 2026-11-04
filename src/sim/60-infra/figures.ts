// Who is drawn in a room and where (docs/design/gdd/the-world.md, Work orders and figures): every position is derived from the saved
// work orders, the seats and the shifts at a game minute and never saved. Workers sit at their seat, walk to the front of their target,
// work there with a progress bar and walk back; the provider's remote hands stand at the rack while they work.
import { datacenterById, dcProvider } from "../20-world/datacenters";
import { entryTile, fixtureTiles, officePlan, rackTiles, roomSize, seatsAt, type Facing, type Pt, type Tile } from "../20-world/layout";
import type { GameState, Location, WorkOrder } from "../50-state";
import type { Role } from "../47-staff/staff";
import { hallPath } from "../90-actions/hall";
import { arriveAt, doneAt, seatOf, targetFront } from "../90-actions/work-orders";
import { present } from "./handwork";
import { whoIsIn } from "./properties";

// what is a Task of the operation or a remote hands job kind; until is the hour the work ends.
export interface FigureJob { rackId: string; deviceId: string; what: string; until: number }
export type Pose = "sit" | "walk" | "work" | "stand";
// colour is the provider id for a provider's technician, null for own staff, whose look comes from their id. path is the way walked
// (one tile for sit, stand and work), progress 0 to 1 while working.
export interface Figure {
  id: string; name: string; role: Role | "provider" | "player"; tile: Tile; facing: Facing; colour: string | null; busy: boolean; seated: boolean;
  pose: Pose; path: Pt[]; progress: number; job?: FigureJob;
}

// Standing places for people who find no seat: the site plan's lobby once it exists.
export const lobbySeats = (_s: GameState, _loc: Location): Pt[] => [];

// The seats at a location: a hire sits at the desk assigned to them; the player takes the first seat no hire has claimed; staff without a desk
// fill the seats left, by hiring then id. Whoever finds no seat stands in the lobby or beside the entry.
export function seating(s: GameState, loc: Location, hour: number): { id: string; at: Pt; seated: boolean }[] {
  const seats = seatsAt(s, loc), p = s.properties.find((x) => (x.locationId === loc.id || x.hall?.locationId === loc.id) && x.kind !== "basement");
  const staff = (p ? whoIsIn(s, p.id, hour) : []).slice().sort((a, b) => a.hiredAt - b.hiredAt || a.id.localeCompare(b.id));
  const deskOf = (e: { desk?: { sectionId: string; index: number } | null }) => seats.findIndex((q) => e.desk && q.sectionId === e.desk.sectionId && q.index === e.desk.index);
  const claimed = new Set(s.staff.map(deskOf).filter((i) => i >= 0)), used = new Set<number>(), seat = new Map<string, number>();
  for (const e of staff) { const i = deskOf(e); if (i >= 0) { seat.set(e.id, i); used.add(i); } }
  const free = (): number => seats.findIndex((_, i) => !used.has(i));
  if (present(s, loc.id)) { const i = seats.findIndex((_, k) => !claimed.has(k)); if (i >= 0) { seat.set("player", i); used.add(i); } }
  for (const e of staff) if (!seat.has(e.id)) { const i = free(); if (i >= 0) { seat.set(e.id, i); used.add(i); } }
  const entry = entryTile(loc, officePlan(s, loc)), lobby = lobbySeats(s, loc), people = [...(present(s, loc.id) ? [{ id: "player" }] : []), ...staff];
  let out = 0;
  return people.map((e) => {
    const i = seat.get(e.id);
    if (i !== undefined) return { id: e.id, at: seats[i], seated: true };
    const k = out++;
    return { id: e.id, at: lobby[k] ?? { x: entry.x, y: entry.y + 1 + k }, seated: false };
  });
}

const key = (p: Pt): string => `${p.x},${p.y}`;
const face = (a: Pt, b: Pt): Facing => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? (b.x >= a.x ? "e" : "w") : b.y >= a.y ? "s" : "n");

// The way on foot: the hall's own path finder, else a grid search around racks and fixtures, else a straight L.
export function pathOf(s: GameState, loc: Location, from: Pt, to: Pt): Pt[] {
  if (key(from) === key(to)) return [from];
  if (loc.space === "hall") { const p = hallPath(s, loc.id, from, to); if (p) return p; }
  else {
    const plan = officePlan(s, loc), size = roomSize(loc, plan), blocked = new Set([...Object.values(rackTiles(loc, s.racks, plan)).map(key), ...fixtureTiles(loc, plan).map(key)]);
    blocked.delete(key(from)); blocked.delete(key(to));
    const prev = new Map<string, string | null>([[key(from), null]]), queue = [from];
    for (let i = 0; i < queue.length && !prev.has(key(to)); i++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (n.x < 0 || n.y < 0 || n.x >= size.w || n.y >= size.h || blocked.has(key(n)) || prev.has(key(n))) continue;
        prev.set(key(n), key(queue[i]));
        queue.push(n);
      }
    }
    if (prev.has(key(to))) {
      const path: Pt[] = [];
      for (let k: string | null = key(to); k; k = prev.get(k) ?? null) { const [x, y] = k.split(",").map(Number); path.unshift({ x, y }); }
      return path;
    }
  }
  const path: Pt[] = [];
  for (let x = from.x; x !== to.x; x += Math.sign(to.x - x)) path.push({ x, y: from.y });
  for (let y = from.y; y !== to.y; y += Math.sign(to.y - y)) path.push({ x: to.x, y });
  return [...path, to];
}

const along = (path: Pt[], f: number): Pt => path[Math.min(path.length - 1, Math.max(0, Math.round(f * (path.length - 1))))];

export function figuresIn(s: GameState, locationId: string, minute: number): Figure[] {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return [];
  const out: Figure[] = [], hour = Math.floor(minute / 60), mine = s.orders.filter((o) => o.locationId === locationId && o.startAt !== null);
  const seats = new Map(seating(s, loc, hour).map((x) => [x.id, x]));
  const worked = new Set<string>();
  for (const worker of new Set(mine.map((o) => o.worker))) {
    const list = mine.filter((o) => o.worker === worker).sort((a, b) => a.startAt! - b.startAt!);
    const e = s.staff.find((x) => x.id === worker);
    const provider = worker === "provider" && loc.dc ? dcProvider(datacenterById(loc.dc).provider) : null;
    if (!e && !provider && worker !== "player") continue;
    const home = provider ? null : seats.get(worker)?.at ?? seatOf(s, locationId, worker);
    const active = list.find((o) => o.startAt! <= minute && minute < doneAt(o));
    const back = (!active && list.find((o) => doneAt(o) <= minute && minute < doneAt(o) + o.walkMin)) || undefined;
    const o: WorkOrder | undefined = active ?? back;
    if (!o) continue;
    const front = targetFront(s, o), stand = front ?? home;
    if (!stand) continue;
    let pose: Pose = "work", at: Pt = stand, path: Pt[] = [stand], progress = 0;
    const route = home && front ? pathOf(s, loc, home, front) : [stand];
    if (back) { pose = "walk"; path = route.slice().reverse(); at = along(path, (minute - doneAt(o)) / o.walkMin); }
    else if (minute < arriveAt(o)) { pose = "walk"; path = route; at = along(path, (minute - o.startAt!) / o.walkMin); }
    else progress = (minute - arriveAt(o)) / o.workMin;
    const facing = pose === "walk" ? face(path[Math.max(0, path.indexOf(at) - 1)], path[Math.min(path.length - 1, path.indexOf(at) + 1)]) : front ? (front as Tile).facing : "s";
    const base = { tile: { ...at, facing } as Tile, facing, pose, path, progress, busy: true, seated: false };
    worked.add(worker);
    const job = pose === "work"
      ? { rackId: o.target.rackId ?? "", deviceId: o.deviceId ?? "", what: o.what ?? o.kind, until: Math.ceil(doneAt(o) / 60) } : undefined;
    if (provider) out.push({ id: o.id, name: provider.name, role: "provider", colour: provider.id, ...base, ...(job && { job }) });
    else if (e) out.push({ id: e.id, name: e.name, role: e.role, colour: null, ...base, ...(job && { job }) });
    else out.push({ id: "player", name: "", role: "player", colour: null, ...base, ...(job && { job }) });
  }
  for (const e of s.staff) {
    const st = seats.get(e.id);
    if (!st || worked.has(e.id)) continue;
    const pose: Pose = st.seated ? "sit" : "stand", facing = "n" as Facing;
    out.push({ id: e.id, name: e.name, role: e.role, tile: { x: st.at.x, y: st.at.y, facing: (st.at as Tile).facing ?? facing, ...(st.at as Tile).floor !== undefined && { floor: (st.at as Tile).floor } }, facing: (st.at as Tile).facing ?? facing, colour: null, busy: true, seated: st.seated, pose, path: [st.at], progress: 0 });
  }
  return out;
}
