// economy.md, HyperVee virtual switches: a VM reaches the network through the switch its adapter is plugged into.
import type { GameState } from "../50-state";
import type { Cluster, Workload } from "./cluster";
import { farEnd, working } from "./status";

export type VSwitchType = "external" | "internal" | "private";
// nic is the host port an external switch is bound to; null follows whichever port is connected.
export interface VSwitch { id: string; name: string; type: VSwitchType; nic: number | null }

export const DEFAULT_SWITCH = "default";
export const MAX_SWITCHES = 8;
export const switchesOf = (c: Cluster): VSwitch[] => c.switches ?? [{ id: DEFAULT_SWITCH, name: "Default Switch", type: "external", nic: null }];
export const switchOf = (c: Cluster, w: Workload): VSwitch => {
  const all = switchesOf(c);
  return all.find((x) => x.id === w.switchId) ?? all.find((x) => x.id === DEFAULT_SWITCH) ?? all[0];
};

// Whether the VM's switch leaves it without an uplink: a private or internal switch, or an external one bound to a port that is unplugged or leads to a dead device.
export function vswitchBlocks(s: GameState, c: Cluster, w: Workload): boolean {
  if (c.platform !== "hypervee" || !w.deviceId) return false;
  const sw = switchOf(c, w);
  if (sw.type !== "external") return true;
  if (sw.nic === null) return false;
  const far = farEnd(s, { device: w.deviceId, port: sw.nic });
  return !far || !working(s, far.end.device);
}
