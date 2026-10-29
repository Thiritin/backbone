// Burn-in: start a quick or full stress test on a racked server that carries no customers.
import { BURNIN_HOURS } from "../10-catalog/burnin";
import { modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import { serverTaken } from "../60-infra/cluster";
import { booting, powered } from "../60-infra/status";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function startBurnin(s: GameState, deviceId: string, full: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId || !modelById(d.model).server) return fail("error.burninNoServer");
  if (d.burnin) return fail("error.burninRunning");
  if (!d.on || booting(s, d) || !powered(s, d.id)) return fail("error.burninNoPower");
  if (serverTaken(s, d.id) || d.maintenance || d.rebuild) return fail("error.burninTaken");
  s.devices = s.devices.map((x) => (x.id === d.id ? { ...x, burnin: { until: s.hour + (full ? BURNIN_HOURS.full : BURNIN_HOURS.quick), full } } : x));
  return { ok: true };
}
