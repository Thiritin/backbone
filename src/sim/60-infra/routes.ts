// Where a new or growing service can go: automatic placement, a cluster, or one node of it. The Support order and
// upgrade cards list these; a route is "auto", a cluster id or a node's device id.
import type { Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { working } from "./status";
import { bookable, clusterOf, controlPlaneUp, hasHosts, KEYS, noRoomError, nodeUsed, pickNode, supports, vmRoom, type Cluster } from "./cluster";

export interface RouteNode { id: string; name: string; free: Resources; fits: boolean }
export interface RouteCluster { id: string; name: string; az: string; free: Resources; fits: boolean; nodes: RouteNode[] }

const free = (s: GameState, deviceId: string): Resources => {
  const d = s.devices.find((x) => x.id === deviceId)!, cap = bookable(s, d), used = nodeUsed(s, deviceId);
  return { vcpu: Math.max(0, cap.vcpu - used.vcpu), ramGb: Math.max(0, cap.ramGb - used.ramGb), diskGb: Math.max(0, cap.diskGb - used.diskGb) };
};
const only = (c: Cluster, deviceId: string): Cluster => ({ ...c, nodes: c.nodes.filter((n) => n.deviceId === deviceId) });

// Panel hosts or hypervisor clusters in the city that sell the product, with what their active, working nodes can still
// book. A panel VM host lists no nodes; its room is the VM's.
export function routeOptions(s: GameState, product: Product, city: string, size: Resources): RouteCluster[] {
  const zones = s.locations.filter((l) => l.city === city).map((l) => l.az);
  return s.clusters.filter((c) => zones.includes(c.az) && supports(c, product) && hasHosts(c)).map((c) => {
    const up = controlPlaneUp(s, c);
    if (c.vm) {
      const room = vmRoom(s, c), free = Object.fromEntries(KEYS.map((k) => [k, Math.max(0, room.cap[k] - room.used[k])])) as unknown as Resources;
      return { id: c.id, name: c.name, az: c.az, free, fits: up && !!pickNode(s, c, size), nodes: [] };
    }
    const nodes = c.nodes.filter((n) => n.state === "active" && working(s, n.deviceId)).map((n): RouteNode => {
      const d = s.devices.find((x) => x.id === n.deviceId)!;
      return { id: d.id, name: d.label ?? d.name, free: free(s, d.id), fits: up && !!pickNode(s, only(c, d.id), size) };
    });
    const sum = Object.fromEntries(KEYS.map((k) => [k, nodes.reduce((a, n) => a + Math.max(0, n.free[k]), 0)])) as unknown as Resources;
    return { id: c.id, name: c.name, az: c.az, free: sum, fits: nodes.some((n) => n.fits), nodes };
  });
}

// The placement a route asks for: a cluster and optionally one node of it; null for automatic.
export function routeTarget(s: GameState, route: string): { clusterId: string; deviceId: string | null } | null {
  if (!route || route === "auto") return null;
  const c = s.clusters.find((x) => x.id === route);
  if (c) return { clusterId: c.id, deviceId: null };
  const owner = clusterOf(s, route);
  return owner ? { clusterId: owner.id, deviceId: route } : { clusterId: route, deviceId: null };
}

// Why a route cannot take the size now, or null: an unknown or foreign cluster, missing software, a control plane down, no disk.
export function routeError(s: GameState, product: Product, city: string, size: Resources, route: string): string | null {
  const target = routeTarget(s, route);
  if (!target) return null;
  const c = s.clusters.find((x) => x.id === target.clusterId);
  if (!c) return "error.unknownCluster";
  if (!s.locations.some((l) => l.city === city && l.az === c.az)) return "error.routeElsewhere";
  if (!supports(c, product)) return noRoomError(s, product, c.id);
  if (!controlPlaneUp(s, c)) return "error.controlPlaneDown";
  return pickNode(s, target.deviceId ? only(c, target.deviceId) : c, size) ? null : "error.noCapacity";
}
