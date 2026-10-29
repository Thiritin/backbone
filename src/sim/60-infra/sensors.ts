// What a server's management controller reports: inlet temperature from the room, fan speeds and power supply status.
import { dateOf } from "../00-core/time";
import type { Device, GameState } from "../50-state";
import { isPlugged, locationOf, rackPower } from "./status";

export const FAN_RPM = 9000;
// The remaining fans spin up while one has failed.
export const FAN_RPM_COMPENSATING = 12500;

export interface Sensors {
  inletC: number;
  fans: { id: string; rpm: number }[];
  psus: { id: string; state: "ok" | "failed" | "unplugged" }[];
}

// A datacenter hall holds 22 degrees; a basement follows the seasons from 17 to 27 and heats with the rack's load. A failed fan adds 6.
export function inletTemperature(s: GameState, d: Device): number {
  const loc = locationOf(s, d);
  const month = dateOf(s.hour).getUTCMonth();
  const room = loc?.dc ? 22 : 22 + 5 * Math.cos(((month - 6.5) * Math.PI) / 6);
  const rack = d.rackId ? rackPower(s, d.rackId) : null;
  const load = rack && rack.limitWatts ? Math.min(1, rack.watts / rack.limitWatts) * 3 : 0;
  const fans = d.components.some((c) => c.kind === "fan" && c.failedAt !== null) ? 6 : 0;
  return Math.round((room + load + fans) * 10) / 10;
}

export function sensorsOf(s: GameState, d: Device): Sensors {
  const fans = d.components.filter((c) => c.kind === "fan");
  const compensating = fans.some((c) => c.failedAt !== null);
  return {
    inletC: inletTemperature(s, d),
    fans: fans.map((c) => ({ id: c.id, rpm: !d.on || c.failedAt !== null ? 0 : compensating ? FAN_RPM_COMPENSATING : FAN_RPM })),
    psus: d.components.filter((c) => c.kind === "psu").map((c) => ({ id: c.id, state: c.failedAt !== null ? "failed" : !isPlugged(c) ? "unplugged" : "ok" })),
  };
}
