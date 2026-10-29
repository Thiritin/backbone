// Burn-in: a stress test of a racked server that finds worn parts before customers do (economy.md, Burn-in).
import { hashRng, rand } from "../00-core/rng";
import { COMPONENTS } from "../10-catalog/hardware";
import { FULL_FAIL_SHARE, QUICK_WORN_SHARE } from "../10-catalog/burnin";
import type { Component, Device, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { failComponents } from "../88-tick/tick";
import { HOURS_PER_YEAR, powered } from "./status";

const lifeShare = (s: GameState, c: Component): number => (s.hour - c.installedAt) / HOURS_PER_YEAR / COMPONENTS[c.kind].life;

// Ends a test whose time is up: quick marks the hidden parts near their end, full shows every age and fails some of the parts past their life.
function finish(s: GameState, d: Device, events: SimEvent[]): Device {
  const { full } = d.burnin!, live = d.components.filter((c) => c.failedAt === null);
  let next: Device = d;
  let found = 0;
  if (full) {
    const r = hashRng(s.seed, s.hour, Number(d.id.replace(/\D/g, "")), 1031);
    const weak = live.filter((c) => lifeShare(s, c) >= 1 && rand(r) < FULL_FAIL_SHARE);
    found = weak.length;
    next = failComponents(s, d, weak.map((c) => c.id), events);
  }
  next = {
    ...next, burnin: null, ...(full && !found ? { burnedInAt: s.hour } : {}),
    components: next.components.map((c) => {
      if (!c.wear) return c;
      if (full) { const { wear: _, ...rest } = c; return rest; }
      return lifeShare(s, c) >= QUICK_WORN_SHARE ? { ...c, wear: "worn" as const } : c;
    }),
  };
  if (!full) found = next.components.filter((c) => c.wear === "worn").length;
  const params = { device: d.label ?? d.name, found };
  events.push(full ? { app: "Locations", key: "event.burninFull", params } : { app: "Locations", key: "event.burninQuick", params });
  return next;
}

export function burninTick(s: GameState, events: SimEvent[]) {
  if (!s.devices.some((d) => d.burnin)) return;
  s.devices = s.devices.map((d) => {
    if (!d.burnin) return d;
    if (!d.on || !powered(s, d.id)) {
      events.push({ app: "Locations", key: "event.burninAborted", params: { device: d.label ?? d.name } });
      return { ...d, burnin: null };
    }
    return d.burnin.until <= s.hour ? finish(s, d, events) : d;
  });
}
