import { useEffect, useRef } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { SERVER_OS, serverOsAt } from "../../../sim/10-catalog/server-os";
import type { GameState } from "../../../sim/50-state";
import type { Workload } from "../../../sim/60-infra/cluster";
import { setMedia } from "../../../sim/90-actions/console";
import { startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { vmLabel, vmState } from "../products/parts";
import { focusIn, keyHandler, Keys, useOsScreen } from "./Screen";

// One of the player's own VMs in a console window: the hypervisor's virtual console with the ISO drive and the power
// keys in the bar. A VM has no BIOS and no boot menu: it boots the installer while an ISO is in, its own disk otherwise.
export function VmConsole({ game, vm: w, front }: { game: GameState; vm: Workload; front: boolean }) {
  const act = useStore((s) => s.act);
  const box = useRef<HTMLDivElement>(null);
  const os = useOsScreen(game, w, front, w.media ?? "lunix");
  useEffect(() => { if (front) focusIn(box.current); }, [front, w.id, os.screen.kind]);
  const st = vmState(game, w), on = st === "running" || st === "down" || st === "frozen";
  const dark = !on || os.screen.kind === "dark", year = yearOf(game.hour);
  const media = () => [
    ...SERVER_OS.map((o) => ({ label: `${o.name} ${serverOsAt(o.id, year).version}`, checked: w.media === o.id, run: () => act(setMedia, w.id, o.id) })),
    null,
    { label: "Eject", disabled: !w.media, run: () => act(setMedia, w.id, null) },
  ];
  return (
    <div className="con">
      <div className="con-bar">
        <b>{w.hostname ?? vmLabel(game, w).name}</b>
        <span className="muted">Virtual console</span>
        <span className="grow" />
        <button onClick={menuOn(media)}>Media</button>
        {st === "stopped" ? <button onClick={() => act(startWorkload, w.id)}>Power on</button> : <button disabled={!on} onClick={() => act(stopWorkload, w.id)}>Shut down</button>}
      </div>
      <div className="con-body">
        <div className="scr-wrap vm">
          <div ref={box} className="scr" data-look={dark ? "dark" : os.look} tabIndex={0} role="application" aria-label="Virtual machine screen" onKeyDown={keyHandler(dark ? () => {} : os.onKey)}>
            {dark ? <span className="scr-osd">No signal</span> : os.view}
          </div>
          <Keys keys={dark ? [] : os.keys} onKey={os.onKey} focus={() => focusIn(box.current)} />
        </div>
      </div>
    </div>
  );
}
