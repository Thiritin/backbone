import { BMC_NAME, hasBmc, modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { working } from "../../../sim/60-infra/status";
import { powerCycle, pullPower, reset, resetBmc, setPower, shutdown, type ActionResult } from "../../../sim/90-actions/hardware";

export type PowerOp = "on" | "shutdown" | "reset" | "cycle" | "pull" | "bmc";
export const POWER_LABEL: Record<PowerOp, string> = { on: "Power on", shutdown: "Shut down", reset: "Reset", cycle: "Power cycle", pull: "Pull power", bmc: "Reset controller" };
export interface PowerOption { op: PowerOp; label: string; disabled?: boolean }

export const POWER_ACTION: Record<PowerOp, (g: GameState, id: string) => ActionResult> = {
  on: (g, id) => setPower(g, id, true), shutdown, reset, cycle: powerCycle, pull: pullPower, bmc: resetBmc,
};

// The power actions of a mounted server: through its management controller when it has one that answers, on site otherwise.
// via names the controller the first actions go through.
export function powerOptions(game: GameState, d: Device): { via: string | null; options: PowerOption[] } {
  const bmc = hasBmc(d.model, d.brand), dead = bmc && d.bmcHung, name = BMC_NAME[d.brand] ?? "IPMI";
  const options: PowerOption[] = [];
  if (!d.on) options.push({ op: "on", label: "Power on", disabled: dead });
  else {
    options.push({ op: "shutdown", label: "Shut down", disabled: !working(game, d.id) });
    if (bmc && !dead) options.push({ op: "reset", label: "Reset" }, { op: "cycle", label: "Power cycle" });
    options.push({ op: "pull", label: "Pull power", disabled: !!d.hands });
  }
  if (dead) options.push({ op: "bmc", label: `Reset ${name}`, disabled: !!d.hands });
  return { via: bmc && !dead ? name : null, options };
}

export const isServerInRack = (d: Device): boolean => modelById(d.model).kind === "server" && !!d.rackId;
