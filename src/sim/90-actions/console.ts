// The server's own screen (docs/design/console.md): the BIOS setup a key during POST or at the firmware prompt opens.
// While a server sits in setup its boot waits, so its workloads stay down.
import { nowHours } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import { pushLog } from "../60-infra/power";
import { BOOT_HOURS, booting, powered } from "../60-infra/status";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Del during POST, or at the firmware prompt a stuck boot waits at. The key counts for the whole boot, which is the time
// the console shows the splash.
export function enterSetup(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server") return fail("error.notServer");
  if (!d.on || !powered(s, d.id)) return fail("error.serverOff");
  if (d.setup) return { ok: true };
  if (!booting(s, d) && !d.stuck) return fail("error.notAtPost");
  d.setup = true;
  d.stuck = false;
  pushLog(d, s.hour, "ipmi.log.setup");
  return { ok: true };
}

// Leaving setup, saved or discarded, lets the boot run on; every setting applied on the spot.
export function exitSetup(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.setup) return fail("error.notInSetup");
  d.setup = false;
  d.bootUntil = nowHours(s) + BOOT_HOURS;
  pushLog(d, s.hour, "ipmi.log.setupLeft");
  return { ok: true };
}
