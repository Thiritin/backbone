import { useEffect, useRef } from "react";
import { t } from "../../../i18n/en";
import { imageName } from "../../../sim/10-catalog/server-os";
import type { GameState } from "../../../sim/50-state";
import type { Workload } from "../../../sim/60-infra/cluster";
import { setMedia } from "../../../sim/90-actions/console";
import { mountableImages } from "../../../sim/90-actions/media";
import { startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { vmLabel, vmState } from "../products/parts";
import { askPower } from "../workload-menu";
import { focusIn, keyHandler, Keys, useOsScreen } from "./Screen";

// One of the player's own VMs in a console window: the hypervisor's virtual console with the ISO drive and the power
// keys in the bar. A VM has no BIOS and no boot menu: it boots the installer while an ISO is in, its own disk otherwise.
export function VmConsole({ game, vm: w, front }: { game: GameState; vm: Workload; front: boolean }) {
  const act = useStore((s) => s.act);
  const box = useRef<HTMLDivElement>(null);
  const os = useOsScreen(game, w, front, w.media ?? null);
  useEffect(() => { if (front) focusIn(box.current); }, [front, w.id, os.screen.kind]);
  const st = vmState(game, w), on = st === "running" || st === "down" || st === "frozen" || st === "booting";
  // A checkpointed VM or one on a frozen node keeps its picture and takes no input.
  const paused = st === "checkpointed" || st === "frozen";
  const dark = !(on || paused || st === "halting") || os.screen.kind === "dark", deaf = dark || paused;
  const name = w.hostname ?? vmLabel(game, w).name;
  const media = () => [
    ...mountableImages(game).map((o) => ({ label: imageName(o), checked: w.media === o, run: () => act(setMedia, w.id, o) })),
    null,
    { label: t("console.eject"), disabled: !w.media, run: () => act(setMedia, w.id, null) },
  ];
  return (
    <div className="con">
      <div className="con-bar">
        <b>{name}</b>
        <span className="muted">{t("console.virtualConsole")}</span>
        <span className="grow" />
        <button onClick={menuOn(media)}>{t("console.media")}</button>
        {st === "stopped" ? <button onClick={() => act(startWorkload, w.id)}>{t("console.powerOn")}</button> : <button disabled={!on} onClick={() => askPower("stop", name, t("console.shutDown"), () => act(stopWorkload, w.id))}>{t("console.shutDown")}</button>}
      </div>
      <div className="con-body">
        <div className="scr-wrap vm">
          <div ref={box} className="scr" data-look={dark ? "dark" : os.look} tabIndex={0} role="application" aria-label={t("console.vmScreen")} inert={paused} onKeyDown={keyHandler(deaf ? () => {} : os.onKey)}>
            {dark ? <span className="scr-osd">{t("console.noSignal")}</span> : os.view}
          </div>
          <Keys keys={deaf ? [] : os.keys} onKey={os.onKey} focus={() => focusIn(box.current)} />
        </div>
      </div>
    </div>
  );
}
