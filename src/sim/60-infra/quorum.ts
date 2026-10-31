// economy.md, Proxmocks cluster quorum: a cluster of two or more nodes is read-only unless a strict majority of its votes is up.
import type { GameState } from "../50-state";
import { modelById } from "../10-catalog/hardware";
import { serverTaken, type Cluster } from "./cluster";
import { locationOf, working } from "./status";

const isQuorumCluster = (c: Cluster): boolean => c.kind === "cloud" && c.platform === "proxmocks" && c.nodes.length >= 2;

// Votes held and votes up; a QDevice is one vote.
export function votes(s: GameState, c: Cluster): { total: number; up: number } {
  const ids = [...c.nodes.map((n) => n.deviceId), ...(c.qdevice ? [c.qdevice] : [])];
  return { total: ids.length, up: ids.filter((id) => working(s, id)).length };
}

export const quorate = (s: GameState, c: Cluster): boolean => {
  if (!isQuorumCluster(c)) return true;
  const v = votes(s, c);
  return v.up * 2 > v.total;
};

// The error a mutating action returns on a cluster without quorum, else null.
export const quorumBlock = (s: GameState, c: Cluster | undefined): string | null => (c && !quorate(s, c) ? "error.noQuorum" : null);

// Why a server cannot be the cluster's QDevice, or null.
export function qdeviceBlock(s: GameState, c: Cluster, deviceId: string): string | null {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return "error.unknownDevice";
  if (!modelById(d.model).server) return "error.notServer";
  if (locationOf(s, d)?.az !== c.az) return "error.otherZone";
  return serverTaken(s, d.id) || d.software.length ? "error.serverInUse" : null;
}
