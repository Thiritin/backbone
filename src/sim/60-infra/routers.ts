// GDD, Network and DDoS (Routers). A router's throughput caps what passes through it; only a full-table router can run an own AS.
import { modelById } from "../10-catalog/hardware";
import type { GameState, Location } from "../50-state";
import { locationOf, working } from "./status";

const routersAt = (s: GameState, locationId: string) =>
  s.devices.filter((d) => modelById(d.model).kind === "gateway" && locationOf(s, d)?.id === locationId);

// Whether a router that holds a full BGP table is up at this location.
export const fullTableAt = (s: GameState, locationId: string): boolean =>
  routersAt(s, locationId).some((d) => modelById(d.model).fullTable && working(s, d.id));

// What the routers of the basement pass on to the home line, in Mbit/s: the fastest one it has, or no limit.
export function routerMbps(s: GameState, loc: Location): number {
  const caps = routersAt(s, loc.id).map((d) => modelById(d.model).throughputGbit).filter((t): t is number => t !== undefined);
  return caps.length ? Math.max(...caps) * 1000 : Infinity;
}

// The share of a router's links that its throughput lets through: 1 while their total speed fits.
export function throughputShare(s: GameState, deviceId: string, linkGbit: number): number {
  const d = s.devices.find((x) => x.id === deviceId), cap = d ? modelById(d.model).throughputGbit : undefined;
  return cap === undefined || linkGbit <= cap ? 1 : cap / linkGbit;
}
