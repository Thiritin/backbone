import { modelById } from "../../../sim/10-catalog/hardware";
import type { Device } from "../../../sim/50-state";
import { atServer, setPower } from "../../../sim/90-actions/hardware";
import type { PanelOp } from "../../art/fronts";
import type { useStore } from "../../store";

// A press on a device's own controls: the hardware reacts at once. Returns the key of the outcome line, or null when it failed.
export function panelPress(act: ReturnType<typeof useStore.getState>["act"], d: Device, op: PanelOp): string | null {
  if (op === "switch") return act(setPower, d.id, !d.on).ok ? (d.on ? "world.out.off" : "world.out.starting") : null;
  if (modelById(d.model).kind !== "server") return null;
  const key = op === "power" ? (d.on ? "world.out.halting" : "world.out.starting") : op === "hold" ? "world.out.off" : "world.out.reboot";
  return act(atServer, d.id, op, "self").ok ? key : null;
}
