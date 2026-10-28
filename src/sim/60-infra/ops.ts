import type { Device, GameState } from "../50-state";

export type IncidentCause = "grid" | "generator" | "seizure";
// minutes is how long the grid was out and dark how many of them reached the servers; a seizure lasts until returnAt.
// customers holds customer ids.
export interface Incident {
  id: string; hour: number; cause: IncidentCause; locationId: string; minutes: number; dark: number;
  devices: string[]; customers: string[]; agency: string | null; returnAt: number | null;
}
export interface Seized { device: Device; locationId: string; at: number; returnAt: number; agency: string }
// dark: hour until which a location has no power. takedowns: hour until which a service is taken down.
export interface Ops { incidents: Incident[]; seized: Seized[]; dark: Record<string, number>; takedowns: Record<string, number> }

export const newOps = (): Ops => ({ incidents: [], seized: [], dark: {}, takedowns: {} });

export const takenDown = (s: GameState, serviceId: string): boolean => (s.ops.takedowns[serviceId] ?? 0) > s.hour;
