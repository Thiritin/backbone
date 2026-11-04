// GDD, Own datacenter, Cooling; economy/properties.md, Airflow. Cooling never refuses a layout: room cooling, floor vents and
// containment trade efficiency, power price and heat risk, and every rack spot gets an inlet delta from where its air comes from.
import { footprint, exhaust, intake, siteAreas, type Pt } from "../20-world/layout";
import { customerSpots, HALL, hallOf, isHalle, zoneSpots } from "../20-world/properties";
import type { GameState, Location } from "../50-state";
import { readOnlySweep, rackPower } from "./status";

export interface AirSpot { x: number; y: number; facing: "n" | "e" | "s" | "w"; kw: number; fed: boolean; contained: boolean; recirc: boolean; blocked: boolean; delta: number }
export type AirTone = "fed" | "room" | "exhaust" | "recirc" | "ventIdle";
export interface Airflow {
  spots: AirSpot[];
  // Nominal cooling of the units, kW; coolingKw applies an outage.
  crac: number;
  effective: number;
  efficiency: number;
  pue: number;
  hot: number;
  load: number;
  tones: Record<string, AirTone>;
}

const key = (p: Pt) => `${p.x},${p.y}`;
const A = HALL.air;
const memo = new WeakMap<GameState, Map<string, { sig: string; devices: unknown; hour: number; air: Airflow }>>();

// The cooling a hall's units give at a game minute: zero during a cooling outage.
export function coolingKw(s: GameState, loc: Location, at: number): number {
  const air = airflow(s, loc);
  return (s.ops.cooling[loc.id] ?? 0) > at / 60 ? 0 : air.effective;
}

export function airflow(s: GameState, loc: Location): Airflow {
  const hall = hallOf(s, loc.id);
  const racks = s.racks.filter((r) => r.locationId === loc.id && r.tile);
  const sig = hall
    ? JSON.stringify([hall.items, hall.zones, hall.customers, hall.exchange, racks.map((r) => [r.id, r.tile])])
    : "";
  let byLoc = memo.get(s);
  if (!byLoc) memo.set(s, (byLoc = new Map()));
  const hit = byLoc.get(loc.id);
  if (hit && hit.sig === sig && hit.hour === s.hour && hit.devices === s.devices) return hit.air;
  const air = compute(s, loc);
  byLoc.set(loc.id, { sig, hour: s.hour, devices: s.devices, air });
  return air;
}

function compute(s: GameState, loc: Location): Airflow {
  const empty: Airflow = { spots: [], crac: 0, effective: 0, efficiency: A.base, pue: A.pueBase + A.pueSlope * (1 - A.base), hot: 0, load: 0, tones: {} };
  const hall = hallOf(s, loc.id), prop = s.properties.find((p) => p.hall?.locationId === loc.id);
  if (!hall || !prop) return empty;
  const halle = isHalle(prop.buildingId), inHall = hall.items.filter((i) => i.area === "hall");
  const cracs = inHall.filter((i) => i.kind === "crac"), cracTiles = cracs.flatMap((i) => footprint("crac", i, halle));
  const vents = new Map(inHall.filter((i) => i.kind === "vent").map((i) => [key(i), i]));
  const contain = new Set(inHall.filter((i) => i.kind === "containment").map(key));

  // Every occupied rack spot with its draw; delivered racks and waiting customers have none.
  const raw: { x: number; y: number; facing: AirSpot["facing"]; kw: number }[] = [];
  readOnlySweep(s, () => {
    for (const r of s.racks) if (r.locationId === loc.id && r.tile) raw.push({ ...r.tile, kw: rackPower(s, r.id).watts / 1000 });
  });
  for (const c of hall.customers) for (const t of customerSpots(hall, c)) raw.push({ x: t.x, y: t.y, facing: t.facing, kw: c.kw });
  if (hall.exchange?.tile) raw.push({ ...hall.exchange.tile, kw: 2 });

  // Tiles that block exhaust: bodies of racks, zone tiles, units and desks.
  const bodies = new Set<string>(raw.map(key));
  for (const z of hall.zones) for (const t of zoneSpots(z)) bodies.add(key(t));
  for (const i of inHall) if (i.kind === "crac" || i.kind === "nocdesk") for (const t of footprint(i.kind, i, halle)) bodies.add(key(t));
  const size = siteAreas(s, loc).find((a) => a.id === "hall")!.rect;
  const exhausts = new Set(raw.map((r) => key(exhaust(r))));

  const reach = (p: Pt) => cracTiles.some((c) => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= A.reach);
  const fedAt = (p: Pt) => vents.has(key(p)) && reach(p);
  // A vent's air is split by kW among the racks that front it.
  const fronting = new Map<string, number>();
  for (const r of raw) if (fedAt(intake(r))) fronting.set(key(intake(r)), (fronting.get(key(intake(r))) ?? 0) + r.kw);

  const spots: AirSpot[] = raw.map((r) => {
    const inT = intake(r), exT = exhaust(r);
    const fed = fedAt(inT), contained = fed && contain.has(key(inT));
    const recirc = exhausts.has(key(inT)) && raw.some((o) => o !== r && key(exhaust(o)) === key(inT));
    const blocked = exT.x < 0 || exT.y < 0 || exT.x >= size.w || exT.y >= size.h || bodies.has(key(exT));
    const total = fronting.get(key(inT)) ?? 0;
    const cap = (contained ? HALL.items.vent.containedKw : HALL.items.vent.kw) as number;
    const share = fed && total > 0 ? (cap * r.kw) / total : 0;
    const base = fed ? Math.max(0, r.kw - share) * A.perKwC : A.roomC + A.perKwC * Math.max(0, r.kw - 4);
    const delta = Math.max(-A.containedC, base + (recirc ? A.recircC : 0) + (blocked ? A.blockedC : 0) - (contained ? A.containedC : 0));
    return { ...r, fed, contained, recirc, blocked, delta };
  });

  const load = spots.reduce((n, p) => n + p.kw, 0);
  const share = (f: (p: AirSpot) => boolean) => (load > 0 ? spots.reduce((n, p) => n + (f(p) ? p.kw : 0), 0) / load : 0);
  const efficiency = Math.min(1, Math.max(A.min, A.base + A.fedGain * share((p) => p.fed) + A.containedGain * share((p) => p.contained) - A.recircLoss * share((p) => p.recirc)));
  const crac = cracs.length * (HALL.items.crac.kw as number);

  const tones: Record<string, AirTone> = {};
  for (const i of vents.values()) if (!fedAt(i)) tones[key(i)] = "ventIdle";
  for (const p of spots) {
    tones[key(exhaust(p))] ??= "exhaust";
    tones[key(intake(p))] = p.recirc ? "recirc" : p.fed ? "fed" : "room";
  }
  return { spots, crac, effective: crac * efficiency, efficiency, pue: A.pueBase + A.pueSlope * (1 - efficiency), hot: spots.filter((p) => p.delta >= A.hotDelta).length, load, tones };
}

// Degrees the rack's inlet runs above the room's: 0 outside a hall or for a rack without a tile.
export function rackDelta(s: GameState, rack: { locationId: string; tile?: { x: number; y: number } }): number {
  if (!rack.tile) return 0;
  const loc = s.locations.find((l) => l.id === rack.locationId);
  if (!loc || loc.space !== "hall") return 0;
  const p = airflow(s, loc).spots.find((x) => x.x === rack.tile!.x && x.y === rack.tile!.y);
  return p?.delta ?? 0;
}

export const airTones = (s: GameState, loc: Location): Record<string, AirTone> => airflow(s, loc).tones;
