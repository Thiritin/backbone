// GDD, Network and DDoS (Routers). A router's throughput caps what passes through it; only a full-table router can run an own AS.
import { isOfficeRouter, modelById, wanPort } from "../10-catalog/hardware";
import type { Device, GameState, Location, RouterLan } from "../50-state";
import { locationOf, working } from "./status";

const routersAt = (s: GameState, locationId: string) =>
  s.devices.filter((d) => modelById(d.model).kind === "gateway" && locationOf(s, d)?.id === locationId);

// The small-office router mounted at a location, if there is one.
export const mountedRouter = (s: GameState, locationId: string): Device | undefined =>
  s.devices.find((x) => !!x.rackId && isOfficeRouter(modelById(x.model)) && locationOf(s, x)?.id === locationId);

// docs/design/lan.md, Phases 4: a router mounted in a rack that is no Fritz!Bocks is an own router. Its first port is its
// uplink, which takes an address from the router in front of it (the datacenter handoff); the others are its own network.
export const isOwnRouter = (d: Device): boolean => {
  const m = modelById(d.model);
  return m.kind === "gateway" && !!d.rackId && !isOfficeRouter(m);
};
export const OWN_UPLINK = 0;
// The port a router reaches the internet through: a Fritz!Bocks's DSL port, an own router's first port; -1 without one.
export const uplinkPort = (d: Device): number => (isOwnRouter(d) ? OWN_UPLINK : wanPort(modelById(d.model)));

// An own router's factory network: its maker's default address, a /24 with the pool above the first ten addresses.
const OWN_NET: Record<string, string> = { MicroTick: "192.168.88", Junipurr: "192.168.1", Sysko: "10.10.10" };
export function ownLan(d: Device): RouterLan {
  const net = OWN_NET[d.brand] ?? "192.168.0";
  return { cidr: `${net}.0/24`, gateway: `${net}.1`, pool: [`${net}.10`, `${net}.254`], leaseHours: 240, reservations: [], leases: [], shares: [] };
}

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
