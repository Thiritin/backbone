// game-servers plan 3.7: the Pterodaktyl node daemon and the port allocations of each node.
import { hashRng, rand } from "../00-core/rng";
import { idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import { workloadsOf, type Cluster } from "./cluster";

export interface Daemon { state: "online" | "offline"; version: number; since: number }

export const DAEMON_FAIL = 0.0003, DAEMON_RECOVER_HOURS = 6, POOL_START = 25565, POOL_SIZE = 100;

// The daemon runs on a node: a server of the cluster, or the panel's virtual machine.
export const nodeKeys = (c: Cluster): string[] => (c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId));
const pterodaktyl = (s: GameState): Cluster[] => s.clusters.filter((c) => c.panel === "pterodaktyl");

// Every node of a Pterodaktyl cluster has a daemon at the panel's release.
export function ensureDaemons(s: GameState): void {
  for (const c of pterodaktyl(s)) for (const k of nodeKeys(c)) if (!s.daemons[k]) s.daemons = { ...s.daemons, [k]: { state: "online", version: c.version, since: s.hour } };
}

export const fillDaemons = (s: GameState): GameState => {
  s.daemons = s.daemons ?? {};
  ensureDaemons(s);
  return s;
};

// The node a game service runs on; null when it is not placed.
export function nodeOf(s: GameState, serviceId: string): { key: string; cluster: Cluster } | null {
  const w = workloadsOf(s, serviceId)[0], c = w && s.clusters.find((x) => x.id === w.clusterId), key = w && (w.deviceId ?? c?.vm);
  return c && key ? { key, cluster: c } : null;
}

export const daemonOf = (s: GameState, key: string): Daemon | undefined => s.daemons[key];
export const daemonOffline = (s: GameState, serviceId: string): boolean => {
  const n = nodeOf(s, serviceId);
  return !!n && s.daemons[n.key]?.state === "offline";
};
// A daemon more than one release behind its panel.
export const daemonBehind = (s: GameState, serviceId: string): boolean => {
  const n = nodeOf(s, serviceId), d = n && s.daemons[n.key];
  return !!d && n.cluster.version - d.version > 1;
};

// Wings fails now and then and comes back by itself after a while.
export function daemonTick(s: GameState): void {
  ensureDaemons(s);
  for (const [k, d] of Object.entries(s.daemons)) {
    if (d.state === "offline" && s.hour - d.since >= DAEMON_RECOVER_HOURS) s.daemons[k] = { ...d, state: "online", since: s.hour };
    else if (d.state === "online" && rand(hashRng(s.seed, idNum(`wings-${k}`), s.hour)) < DAEMON_FAIL) s.daemons[k] = { ...d, state: "offline", since: s.hour };
  }
}

const live = (s: GameState, serviceId: string): boolean => s.services.some((v) => v.id === serviceId && v.endedAt === null);

// Ports of the node's pool that no game server holds.
export function freePorts(s: GameState, key: string): number[] {
  const used = new Set(s.gameServers.filter((g) => live(s, g.serviceId) && nodeOf(s, g.serviceId)?.key === key).flatMap((g) => g.ports));
  return Array.from({ length: POOL_SIZE }, (_, i) => POOL_START + i).filter((p) => !used.has(p));
}

// A Pterodaktyl cluster takes another game server while one of its nodes has a free allocation; other panels pick their own ports.
export const allocationFree = (s: GameState, c: Cluster): boolean => c.panel !== "pterodaktyl" || nodeKeys(c).some((k) => freePorts(s, k).length > 0);
