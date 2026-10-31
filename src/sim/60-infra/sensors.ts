// What a server's management controller reports: inlet temperature from the room, fan speeds and power supply status.
import { dateOf } from "../00-core/time";
import type { Device, GameState, Location } from "../50-state";
import { isPlugged, locationOf, rackPower } from "./status";

export const FAN_RPM = 9000;
// The remaining fans spin up while one has failed.
export const FAN_RPM_COMPENSATING = 12500;

export interface Sensors {
  inletC: number;
  fans: { id: string; rpm: number }[];
  psus: { id: string; state: "ok" | "failed" | "unplugged" }[];
}

// A datacenter hall holds 22 degrees and a basement follows the seasons from 17 to 27, plus the heat built up while
// its cooling falls short (thermal.ts).
export function roomTemperature(s: GameState, loc: Location): number {
  const month = dateOf(s.hour).getUTCMonth();
  return (loc.dc ? 22 : 22 + 5 * Math.cos(((month - 6.5) * Math.PI) / 6)) + (s.ops.heat[loc.id] ?? 0);
}

// The room, up to 3 degrees more from the rack's load and 6 more behind a failed fan.
export function inletTemperature(s: GameState, d: Device): number {
  const loc = locationOf(s, d);
  const room = loc ? roomTemperature(s, loc) : 22;
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
