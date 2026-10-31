// economy.md, Cooling and overheating: a room heats up while its cooling sheds less than its racks draw, and its servers
// slow down, shut themselves off and start again as the temperature passes the thresholds.
import { nowMinutes } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { BASEMENT } from "../20-world/datacenters";
import type { Device, GameState, Location } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { heatIncident } from "./incidents";
import { losePower, pushLog } from "./power";
import { inletTemperature } from "./sensors";
import { bootHours, locationOf, rackPower } from "./status";

export const THERMAL = {
  throttleC: 35, shutdownC: 45, resumeC: 30,
  // The share of its performance a throttling server keeps.
  throttlePerf: 0.6,
  // Degrees a minute per kW a position's share of the room cannot shed.
  climb: 0.5,
  // kW a hall position loses through the building per degree above normal.
  shed: 0.02,
  // The basement holds as much air and wall as 4 datacenter positions, sheds BASEMENT.kw at its normal temperature and
  // 0.2 kW more per degree above it.
  basementMass: 4, basementShed: 0.2,
  // A hall's cooling handles this much more than the power it sells.
  headroom: 1.2,
  // Every this many hours a server ran throttling hot adds its components' base failure rate once more.
  wearHours: 100,
};

// Without built-up heat or a failed fan no room reaches the throttle threshold, so the sensor is read only then.
export function throttled(s: GameState, d: Device): boolean {
  const loc = locationOf(s, d);
  if (!loc || (!s.ops.heat[loc.id] && !d.components.some((c) => c.kind === "fan" && c.failedAt !== null))) return false;
  return inletTemperature(s, d) >= THERMAL.throttleC;
}

// minutes: game minutes since the last call, 60 when the hourly tick runs on its own.
export function thermalTick(s: GameState, minutes = 1): SimEvent[] {
  const events: SimEvent[] = [];
  for (const loc of s.locations) {
    for (let m = minutes - 1; m >= 0; m--) if (!step(s, loc, nowMinutes(s) - m, events)) break;
  }
  return events;
}

// False once the room is at its normal temperature with nothing to change for the rest of the call.
function step(s: GameState, loc: Location, at: number, events: SimEvent[]): boolean {
  const heat = s.ops.heat[loc.id] ?? 0;
  const out = (s.ops.cooling[loc.id] ?? 0) > at / 60;
  const waiting = s.devices.some((d) => d.overheatedAt !== undefined && locationOf(s, d)?.id === loc.id);
  if (loc.dc && !heat && !out && !waiting) return false;
  const racks = s.racks.filter((r) => r.locationId === loc.id).map((r) => rackPower(s, r.id));
  const kw = racks.reduce((n, p) => n + p.watts, 0) / 1000;
  const cooling = !loc.dc ? BASEMENT.kw : out ? 0 : (THERMAL.headroom * racks.reduce((n, p) => n + p.limitWatts, 0)) / 1000;
  const mass = loc.dc ? Math.max(1, loc.positions) : THERMAL.basementMass;
  const shed = loc.dc ? THERMAL.shed * mass : THERMAL.basementShed;
  const next = Math.max(0, heat + (THERMAL.climb * (kw - cooling - shed * heat)) / mass);
  if (next !== heat) {
    const { [loc.id]: _, ...rest } = s.ops.heat;
    s.ops = { ...s.ops, heat: next < 0.01 ? rest : { ...rest, [loc.id]: next } };
  }
  if (next < 0.01 && !waiting) return false;

  const servers = s.devices.filter((d) => modelById(d.model).kind === "server" && locationOf(s, d)?.id === loc.id);
  const hot = servers.filter((d) => d.on && inletTemperature(s, d) >= THERMAL.shutdownC).map((d) => d.id);
  const back = servers.filter((d) => d.overheatedAt !== undefined && !hot.includes(d.id) && inletTemperature(s, d) < THERMAL.resumeC);
  if (!hot.length && !back.length) return true;
  const since = Math.min(...back.map((d) => d.overheatedAt!));
  s.devices = s.devices.map((d) => {
    if (hot.includes(d.id)) {
      const next: Device = { ...d, on: false, overheatedAt: d.overheatedAt ?? at, bootUntil: undefined, haltUntil: undefined };
      losePower(s, next, "ipmi.log.overheat");
      return next;
    }
    if (!back.includes(d)) return d;
    const next: Device = { ...d, overheatedAt: undefined };
    if (!d.on) {
      next.on = true;
      next.bootUntil = at / 60 + bootHours(s, next);
      pushLog(next, s.hour, "ipmi.log.powerOn");
    }
    return next;
  });
  if (hot.length) events.push({ app: "Support", key: "event.overheated", params: { location: loc.name, count: hot.length } });
  if (back.length) heatIncident(s, loc, back, Math.floor(since / 60), at - since, events);
  return true;
}
