import type { GameState } from "../../../sim/50-state";
import { cardBoard, nextGoal } from "../../../sim/checklist";

const FRONT_GUIDE: Partial<Record<string, "power" | "usb" | "reset">> = { mountServer: "power", mountRouter: "power", plugStick: "usb", bootUsb: "reset" };
// The control on the drawn device that the current guide card needs.
export function frontGuide(game: GameState): "power" | "usb" | "reset" | undefined {
  const cur = cardBoard(game).current;
  return cur ? FRONT_GUIDE[nextGoal(game, cur)] : undefined;
}
