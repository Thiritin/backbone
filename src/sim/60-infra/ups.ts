// economy.md, UPS: a UPS with a network card signals a grid outage to the servers it protects, which shut down cleanly before
// its battery runs out. A server listens through the agent installed on its OS or through its hypervisor's API.
import { isManagedUps, modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { clustersOn } from "./cluster";
import { linkStatus } from "./status";

export const UPS_PACKAGE = "nuts-client";
// Hypervisors whose API the UPS's management software drives.
export const UPS_API = new Set(["vmwhere", "hypervee"]);

export type Shutdown = "agent" | "hypervisor";

// How a server hears of an outage, null when it would lose power.
export function shutdownBy(s: GameState, d: Device): Shutdown | null {
  if (modelById(d.model).kind !== "server") return null;
  if (clustersOn(s, d.id).some((c) => c.kind === "cloud" && c.platform !== null && UPS_API.has(c.platform))) return "hypervisor";
  return d.upsAgent ? "agent" : null;
}

export const managedUps = (s: GameState, devices: Device[]): Device[] =>
  devices.filter((d) => d.rackId && isManagedUps(modelById(d.model)) && linkStatus(s, d.id).online);

// The servers among devices that shut down cleanly when the power fails: both a managed UPS among pool and the server reach the network.
export function cleanShutdowns(s: GameState, pool: Device[], devices: Device[]): Set<string> {
  if (!managedUps(s, pool).length) return new Set();
  return new Set(devices.filter((d) => linkStatus(s, d.id).online && shutdownBy(s, d)).map((d) => d.id));
}
