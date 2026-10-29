import { CirclePower, Plug, Power, PowerOff, RefreshCw, RotateCcw, RotateCw, ServerCog, Unplug, type LucideIcon } from "lucide-react";
import { BMC_NAME, hasBmc, modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { pduOf } from "../../../sim/60-infra/pdu";
import type { FrontOp } from "../../../sim/60-infra/power";
import { isPlugged, psusOf, working } from "../../../sim/60-infra/status";
import { powerCycle, powerOff, powerOn, reboot, reset, resetBmc, shutdown, type ActionResult } from "../../../sim/90-actions/hardware";

export type PowerOp = "on" | "shutdown" | "reboot" | "reset" | "cycle" | "off" | "bmc";
export const POWER_LABEL: Record<PowerOp, string> = { on: "Power on", shutdown: "Shut down", reboot: "Reboot", reset: "Reset", cycle: "Power cycle", off: "Power off", bmc: "Reset controller" };
export const POWER_ICON: Record<PowerOp, LucideIcon> = { on: Power, shutdown: PowerOff, reboot: RotateCw, reset: RotateCcw, cycle: RefreshCw, off: PowerOff, bmc: ServerCog };
export interface PowerOption { op: PowerOp; label: string; disabled?: boolean }

export const POWER_ACTION: Record<PowerOp, (g: GameState, id: string) => ActionResult> = {
  on: powerOn, shutdown, reboot, reset, cycle: powerCycle, off: powerOff, bmc: resetBmc,
};

// The power actions of a mounted server from afar: through its management controller when it has one that answers,
// a switched PDU in the rack otherwise; a clean shutdown or reboot only needs the operating system.
export function powerOptions(game: GameState, d: Device): { via: string | null; pdu: boolean; options: PowerOption[] } {
  const bmc = hasBmc(d.model, d.brand), dead = bmc && d.bmcHung, name = BMC_NAME[d.brand] ?? "IPMI", pdu = !!pduOf(game, d);
  const remote = (bmc && !dead) || pdu, up = working(game, d.id);
  const options: PowerOption[] = [];
  if (!d.on) { if (remote) options.push({ op: "on", label: "Power on" }); }
  else {
    options.push({ op: "shutdown", label: "Shut down", disabled: !up }, { op: "reboot", label: "Reboot", disabled: !up });
    if (bmc && !dead) options.push({ op: "reset", label: "Reset" });
    if (remote) options.push({ op: "cycle", label: "Power cycle" }, { op: "off", label: "Power off" });
  }
  if (dead) options.push({ op: "bmc", label: `Reset ${name}`, disabled: !!d.hands });
  return { via: bmc && !dead ? name : null, pdu, options };
}

export const FRONT_ICON: Record<FrontOp, LucideIcon> = { power: CirclePower, hold: PowerOff, reset: RotateCcw, pull: Unplug, plug: Plug };
export const FRONT_BUSY: Record<FrontOp | "bmcreset", string> = {
  power: "Pressing power button", hold: "Holding power button", reset: "Pressing reset button", pull: "Unplugging power", plug: "Plugging in power", bmcreset: "Resetting controller",
};
export interface FrontOption { op: FrontOp; label: string; disabled?: boolean }

// What a hand at the server can do: its front buttons and its power cords.
export function frontOptions(game: GameState, d: Device): FrontOption[] {
  const busy = !!d.hands, cords = psusOf(d);
  return [
    { op: "power" as const, label: "Press power button", disabled: busy || (d.on && !working(game, d.id)) },
    ...(d.on ? [{ op: "hold" as const, label: "Hold power button", disabled: busy }, { op: "reset" as const, label: "Press reset button", disabled: busy }] : []),
    ...(cords.some(isPlugged) ? [{ op: "pull" as const, label: "Unplug power", disabled: busy }] : []),
    ...(cords.some((c) => !isPlugged(c)) ? [{ op: "plug" as const, label: "Plug in power", disabled: busy }] : []),
  ];
}

export const isServerInRack = (d: Device): boolean => modelById(d.model).kind === "server" && !!d.rackId;
