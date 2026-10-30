// Where a new or growing service can go: automatic placement, a cluster, or one node of it. The Support order and
// upgrade cards list these; a route is "auto", a cluster id or a node's device id.
import { genOf, modelById } from "../10-catalog/hardware";
import type { Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { working } from "./status";
import { bookable, clusterOf, clustersOf, controlPlaneUp, hasHosts, KEYS, noRoomError, nodeUsed, pickNode, supports, vmById, vmRoom, withDatastore, type Cluster } from "./cluster";

// cap and used are what the target can book and has booked; free is the room left.
export interface RouteNode { id: string; name: string; cap: Resources; used: Resources; free: Resources; fits: boolean }
export interface RouteCluster { id: string; name: string; az: string; cap: Resources; used: Resources; free: Resources; fits: boolean; nodes: RouteNode[] }

const room = (cap: Resources, used: Resources) => ({ cap, used, free: Object.fromEntries(KEYS.map((k) => [k, Math.max(0, cap[k] - used[k])])) as unknown as Resources });
export const sumOf = (xs: Resources[]): Resources => Object.fromEntries(KEYS.map((k) => [k, xs.reduce((a, x) => a + x[k], 0)])) as unknown as Resources;
const only = (c: Cluster, deviceId: string): Cluster => ({ ...c, nodes: c.nodes.filter((n) => n.deviceId === deviceId) });

// Panel hosts or hypervisor clusters in the city that sell the product, with what their active, working nodes can still
// book. A panel VM host lists no nodes; its room is the VM's.
export function routeOptions(s: GameState, product: Product, city: string, size: Resources): RouteCluster[] {
  const zones = s.locations.filter((l) => l.city === city).map((l) => l.az);
  return s.clusters.filter((c) => zones.includes(c.az) && supports(c, product) && hasHosts(c)).map((c) => {
    const up = controlPlaneUp(s, c);
    if (c.vm) {
      const vm = vmRoom(s, c);
      return { id: c.id, name: c.name, az: c.az, ...room(vm.cap, vm.used), fits: up && !!pickNode(s, c, size), nodes: [] };
    }
    const nodes = c.nodes.filter((n) => n.state === "active" && working(s, n.deviceId)).map((n): RouteNode => {
      const d = s.devices.find((x) => x.id === n.deviceId)!;
      return { id: d.id, name: d.label ?? d.name, ...room(bookable(s, d), nodeUsed(s, d.id)), fits: up && !!pickNode(s, only(c, d.id), withDatastore(s, c, size)) };
    });
    return { id: c.id, name: c.name, az: c.az, cap: sumOf(nodes.map((n) => n.cap)), used: sumOf(nodes.map((n) => n.used)), free: sumOf(nodes.map((n) => n.free)), fits: nodes.some((n) => n.fits), nodes };
  });
}

// How good a host is for a new service: the newest hardware generation of its working nodes, then the fewest hours down
// this month per service it carries. Every automatic placement and every preselection ranks hosts by this.
export function hostQuality(s: GameState, c: Cluster): { gen: number; year: number; down: number } {
  const machines = c.vm ? [vmById(s, c.vm)?.deviceId ?? ""] : c.nodes.filter((n) => n.state === "active").map((n) => n.deviceId);
  const models = machines.flatMap((id) => { const d = s.devices.find((x) => x.id === id); return d ? [modelById(d.model)] : []; });
  const gens = models.map(genOf);
  const carried = s.workloads.filter((w) => w.clusterId === c.id && w.serviceId);
  const down = carried.reduce((n, w) => n + (s.downHours[w.serviceId!] ?? 0), 0) / Math.max(1, carried.length);
  return { gen: gens.length ? Math.max(...gens) : 0, year: models.length ? Math.max(...models.map((m) => m.from)) : 0, down };
}
export const betterHost = (s: GameState) => (a: Cluster, b: Cluster): number => {
  const x = hostQuality(s, a), y = hostQuality(s, b);
  return y.gen - x.gen || x.down - y.down;
};

// The host a setup is preselected on: the best of the city's hosts that can take the size now, or null. It only suggests;
// the player confirms the setup.
export function preferredRoute(s: GameState, product: Product, city: string, size: Resources): string | null {
  const fit = routeOptions(s, product, city, size).filter((o) => o.fits);
  const roomy = fit.filter((o) => o.free.ramGb >= size.ramGb);
  const best = (roomy.length ? roomy : fit).map((o) => s.clusters.find((c) => c.id === o.id)!).sort(betterHost(s))[0];
  return best?.id ?? null;
}

// The placement a route asks for: a cluster and optionally one node of it; null for automatic.
// A server's route goes to its cluster that sells the product, or its hypervisor's without one.
export function routeTarget(s: GameState, route: string, product?: Product): { clusterId: string; deviceId: string | null } | null {
  if (!route || route === "auto") return null;
  const c = s.clusters.find((x) => x.id === route);
  if (c) return { clusterId: c.id, deviceId: null };
  const owner = clustersOf(s, route).find((x) => product && supports(x, product)) ?? clusterOf(s, route);
  return owner ? { clusterId: owner.id, deviceId: route } : { clusterId: route, deviceId: null };
}

// Why a route cannot take the size now, or null: an unknown or foreign cluster, missing software, a control plane down, no disk.
export function routeError(s: GameState, product: Product, city: string, size: Resources, route: string): string | null {
  const target = routeTarget(s, route, product);
  if (!target) return null;
  const c = s.clusters.find((x) => x.id === target.clusterId);
  if (!c) return "error.unknownCluster";
  if (!s.locations.some((l) => l.city === city && l.az === c.az)) return "error.routeElsewhere";
  if (!supports(c, product)) return noRoomError(s, product, c.id);
  if (!controlPlaneUp(s, c)) return "error.controlPlaneDown";
  return pickNode(s, target.deviceId ? only(c, target.deviceId) : c, withDatastore(s, c, size)) ? null : "error.noCapacity";
}
