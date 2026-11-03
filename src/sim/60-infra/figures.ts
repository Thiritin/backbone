// Who is drawn in a room and where (docs/design/gdd/the-world.md, What lives where): staff at their desks, a technician at the
// rack of the operation they took this hour, the datacenter's remote hands at the rack in the last hour before a job is due.
// The player is never drawn.
import { datacenterById, dcProvider } from "../20-world/datacenters";
import { officePlan, officeSeats, rackTiles, type Facing, type Tile } from "../20-world/layout";
import type { GameState } from "../50-state";
import { OP_TASK, type OpKind } from "../47-staff/technicians";
import type { Role } from "../47-staff/staff";
import { jobKind, type HandsAction, type JobKind } from "../90-actions/presence";
import { whoIsIn } from "./properties";

// what is a Task of the operation or a remote hands job kind; until is the hour the work ends.
export interface FigureJob { rackId: string; deviceId: string; what: string; until: number }
// colour is the provider id for a provider's technician, null for own staff, whose look comes from their id.
export interface Figure { id: string; name: string; role: Role | "provider"; tile: Tile; facing: Facing; colour: string | null; busy: boolean; seated: boolean; job?: FigureJob }

const OPPOSITE: Record<Facing, Facing> = { n: "s", s: "n", e: "w", w: "e" };
const STEP: Record<Facing, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// The floor tile in front of a rack, facing its front.
function atRack(tile: Tile): { tile: Tile; facing: Facing } {
  const [dx, dy] = STEP[tile.facing], facing = OPPOSITE[tile.facing];
  return { tile: { x: tile.x + dx, y: tile.y + dy, facing, ...(tile.floor !== undefined && { floor: tile.floor }) }, facing };
}

// The rack a remote hands job is worked at: the device's, or the rack a mount names.
function jobRack(s: GameState, deviceId: string, args: unknown[]): string | undefined {
  const d = s.devices.find((x) => x.id === deviceId);
  return d?.rackId ?? args.find((a): a is string => typeof a === "string" && s.racks.some((r) => r.id === a));
}

export function figuresIn(s: GameState, locationId: string, hour: number): Figure[] {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return [];
  const plan = officePlan(s, loc), tiles = rackTiles(loc, s.racks, plan), out: Figure[] = [];
  const stand = (rackId: string | undefined) => (rackId && tiles[rackId] ? atRack(tiles[rackId]) : undefined);
  const atWork = new Set<string>();
  for (const j of s.techJobs) {
    const e = s.staff.find((x) => x.id === j.employeeId), d = s.devices.find((x) => x.id === j.deviceId), at = stand(d?.rackId ?? undefined);
    if (j.hour !== hour || !e || e.location !== locationId || !d?.rackId || !at) continue;
    atWork.add(e.id);
    out.push({ id: e.id, name: e.name, role: e.role, ...at, colour: null, busy: true, seated: false, job: { rackId: d.rackId, deviceId: d.id, what: OP_TASK[j.kind as OpKind], until: hour + 1 } });
  }
  for (const j of s.handsJobs) {
    const rackId = jobRack(s, j.deviceId, j.args), at = stand(rackId);
    if (j.self || j.locationId !== locationId || !rackId || !at || hour < j.dueAt - 1 || hour >= j.dueAt || !loc.dc) continue;
    const provider = dcProvider(datacenterById(loc.dc).provider), what: JobKind = jobKind(j.action as HandsAction);
    out.push({ id: j.id, name: provider.name, role: "provider", ...at, colour: provider.id, busy: true, seated: false, job: { rackId, deviceId: j.deviceId, what, until: j.dueAt } });
  }
  const p = plan && s.properties.find((x) => x.locationId === locationId && x.kind !== "basement");
  if (p && plan) {
    const seats = new Map(officeSeats(plan).map((x) => [`${x.sectionId}/${x.index}`, x]));
    for (const e of whoIsIn(s, p.id, hour)) {
      const seat = e.desk && seats.get(`${e.desk.sectionId}/${e.desk.index}`);
      if (!seat || atWork.has(e.id)) continue;
      out.push({ id: e.id, name: e.name, role: e.role, tile: { x: seat.x, y: seat.y, facing: seat.facing, floor: seat.floor }, facing: seat.facing, colour: null, busy: true, seated: true });
    }
  }
  return out;
}
