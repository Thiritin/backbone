import { BMC_NAME, modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { isOwnVm, vmById } from "../../../sim/60-infra/cluster";
import { consoleVia } from "../../../sim/60-infra/oob";
import { useStore } from "../../store";
import { devName } from "../hw";
import { useDeviceMenu } from "../locations/Inspector";
import { powerOptions } from "../locations/power";
import { Screen } from "./Screen";
import { VmConsole } from "./VmConsole";
import { vmLabel } from "../products/parts";

// What each brand calls its controller's screen.
const CONSOLE_NAME: Record<string, string> = { Dwell: "iDRAQ Virtual Console", "Hewlett-Packet": "iLOL Remote Console", SuperMacro: "SuperMacro iKVM", Lenovoid: "XClarify Remote Control" };
export const consoleName = (game: GameState, d: Device): string => {
  const via = consoleVia(game, d.id);
  return via?.kind === "bmc" ? CONSOLE_NAME[d.brand] ?? `${BMC_NAME[d.brand] ?? "IPMI"} console` : via ? modelById(via.device.model).name : "Console";
};
export const consoleTitle = (game: GameState, id: string): string => {
  const d = game.devices.find((x) => x.id === id), vm = vmById(game, id);
  return d ? `${consoleName(game, d)}: ${devName(d)}` : vm ? `Console: ${vm.hostname ?? vmLabel(game, vm).name}` : "Console";
};

const none = () => {};

// The console in its own window: the way in and the power keys that way offers, then the screen with its soft keys. One
// of the player's own VMs gets the hypervisor's virtual console instead.
export function ConsoleWindow({ deviceId, front }: { deviceId: string; front: boolean }) {
  const game = useStore((s) => s.game);
  const d = game.devices.find((x) => x.id === deviceId), vm = vmById(game, deviceId);
  const menus = useDeviceMenu(game, none, none);
  if (vm && isOwnVm(vm)) return <VmConsole key={vm.id} game={game} vm={vm} front={front} />;
  if (!d) return null;
  const via = consoleVia(game, d.id), power = via ? powerOptions(game, d) : null;
  return (
    <div className="con">
      <div className="con-bar">
        <b>{devName(d)}</b>
        <span className="muted">{via ? consoleName(game, d) : "No way in"}</span>
        <span className="grow" />
        {power?.options.map((o) => <button key={o.op} disabled={o.disabled} onClick={() => menus.op(d, o.op)}>{o.label}</button>)}
      </div>
      <div className="con-body">
        {via ? <Screen game={game} device={d} via={via.kind === "bmc" ? "bmc" : "kvm"} active={front} /> : <div className="scr" data-look="dark"><span className="scr-osd">No signal</span></div>}
      </div>
      {menus.dialog}
    </div>
  );
}
