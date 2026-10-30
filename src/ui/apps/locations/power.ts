import { Play, Power, PowerOff, RefreshCw, RotateCcw, RotateCw, ServerCog, type LucideIcon } from "lucide-react";
import { BMC_NAME, hasBmc, modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { kvmPower } from "../../../sim/60-infra/oob";
import { pduOf } from "../../../sim/60-infra/pdu";
import type { FrontOp } from "../../../sim/60-infra/power";
import { locationOf, working } from "../../../sim/60-infra/status";
import { present } from "../../../sim/60-infra/handwork";
import { powerCycle, powerOff, powerOn, reboot, reset, resetBmc, shutdown, type ActionResult } from "../../../sim/90-actions/hardware";
import { continueBoot } from "../../../sim/90-actions/remote";

export type PowerOp = "on" | "shutdown" | "reboot" | "reset" | "cycle" | "off" | "bmc" | "continue";
export const POWER_LABEL: Record<PowerOp, string> = { on: "Power on", shutdown: "Shut down", reboot: "Reboot", reset: "Reset", cycle: "Power cycle", off: "Power off", bmc: "Reset controller", continue: "Continue boot" };
export const POWER_ICON: Record<PowerOp, LucideIcon> = { on: Power, shutdown: PowerOff, reboot: RotateCw, reset: RotateCcw, cycle: RefreshCw, off: PowerOff, bmc: ServerCog, continue: Play };
export interface PowerOption { op: PowerOp; label: string; disabled?: boolean }

export const POWER_ACTION: Record<PowerOp, (g: GameState, id: string) => ActionResult> = {
  on: powerOn, shutdown, reboot, reset, cycle: powerCycle, off: powerOff, bmc: resetBmc, continue: continueBoot,
};

// The power actions of a mounted server from afar: through its management controller when it has one that answers, a KVM
// that switches its power, or a switched PDU in the rack; a clean shutdown or reboot only needs the operating system.
export function powerOptions(game: GameState, d: Device): { via: string | null; pdu: boolean; options: PowerOption[] } {
  const bmc = hasBmc(d.model, d.brand), dead = bmc && d.bmcHung, name = BMC_NAME[d.brand] ?? "IPMI", pdu = !!pduOf(game, d);
  const kvm = kvmPower(game, d), remote = (bmc && !dead) || pdu || !!kvm, up = working(game, d.id);
  const options: PowerOption[] = [];
  if (!d.on) { if (remote) options.push({ op: "on", label: "Power on" }); }
  else {
    if (d.stuck) options.push({ op: "continue", label: "Continue boot", disabled: !!d.hands });
    options.push({ op: "shutdown", label: "Shut down", disabled: !up }, { op: "reboot", label: "Reboot", disabled: !up });
    if ((bmc && !dead) || kvm) options.push({ op: "reset", label: "Reset" });
    if (remote) options.push({ op: "cycle", label: "Power cycle" }, { op: "off", label: "Power off" });
  }
  if (dead) options.push({ op: "bmc", label: `Reset ${name}`, disabled: !!d.hands });
  return { via: bmc && !dead ? name : kvm ? modelById(kvm.model).name : null, pdu, options };
}

export const FRONT_BUSY: Record<FrontOp | "bmcreset" | "continue" | "recover" | "stick", string> = {
  power: "Pressing power button", hold: "Holding power button", reset: "Pressing reset button", pull: "Unplugging power", plug: "Plugging in power", bmcreset: "Resetting controller",
  continue: "Continuing boot", recover: "Recovering", stick: "Plugging in USB stick",
};
export interface FrontOption { op: FrontOp; label: string; disabled?: boolean }

// The server sits in a datacenter the player is not at, so someone else has to press its buttons.
export function handsAway(game: GameState, d: Device): boolean {
  const loc = locationOf(game, d);
  return !!loc?.dc && !present(game, loc.id);
}
export const handsLabel = (game: GameState, d: Device): string => handsAway(game, d) ? "Remote hands" : "At the server";

// What a hand at the server can do: press its power button.
export function frontOptions(game: GameState, d: Device): FrontOption[] {
  return [{ op: "power", label: "Press power button", disabled: !!d.hands || (d.on && !working(game, d.id)) }];
}

export const isServerInRack = (d: Device): boolean => modelById(d.model).kind === "server" && !!d.rackId;
