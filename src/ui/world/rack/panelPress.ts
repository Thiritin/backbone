import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { customersAffectedBy } from "../../../sim/60-infra/incidents";
import { booting, halting } from "../../../sim/60-infra/status";
import { atServer, setPower } from "../../../sim/90-actions/hardware";
import { cardBoard, nextGoal } from "../../../sim/checklist";
import { devName } from "../../apps/hw";
import type { PanelOp } from "../../art/fronts";
import type { useStore } from "../../store";

type Act = ReturnType<typeof useStore.getState>["act"];

// How many customers a press would cut off: a clean halt, a hold or a reset of a running server takes its services down.
export function affected(game: GameState, d: Device, op: PanelOp): number {
  const kind = modelById(d.model).kind;
  if (!d.on || op === "hint" || (op === "switch" ? kind !== "gateway" : kind !== "server")) return 0;
  return customersAffectedBy(game, d).length;
}

const withCount = (line: string, count: number) => (count > 0 ? t("world.out.customers", { line, count }) : line);

// A press on a device's own controls: the hardware reacts at once. Returns the outcome line, or null when the press failed
// (the action reports its own error).
export function panelPress(game: GameState, act: Act, d: Device, op: PanelOp): string | null {
  const name = devName(d), kind = modelById(d.model).kind;
  if (op === "hint") return t(d.on ? "world.out.holdOff" : "world.out.holdOn");
  if (op === "switch") { const n = affected(game, d, op); return act(setPower, d.id, !d.on).ok ? withCount(t(d.on ? "world.out.off" : "world.out.starting", { name }), n) : null; }
  if (kind !== "server") return null;
  if (op === "power" && booting(game, d)) return t("world.out.stillStarting", { name });
  if (op === "power" && halting(d)) return t("world.out.stillHalting", { name });
  const n = affected(game, d, op), key = op === "power" ? (d.on ? "world.out.halting" : "world.out.starting") : op === "hold" ? "world.out.off" : "world.out.reboot";
  return act(atServer, d.id, op, "self").ok ? withCount(t(key, { name }), n) : null;
}

const FRONT_GUIDE: Partial<Record<string, "power" | "usb" | "reset">> = { mountServer: "power", mountRouter: "power", plugStick: "usb", bootUsb: "reset" };
// The control on the drawn device that the current guide card needs.
export function frontGuide(game: GameState): "power" | "usb" | "reset" | undefined {
  const cur = cardBoard(game).current;
  return cur ? FRONT_GUIDE[nextGoal(game, cur)] : undefined;
}
