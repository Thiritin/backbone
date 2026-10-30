import { useEffect, useRef, type KeyboardEvent } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { hostOfVm, type Workload } from "../../../sim/60-infra/cluster";
import { setMedia } from "../../../sim/90-actions/console";
import { startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { vmLabel, vmState } from "../products/parts";
import { useInstaller } from "./installer";
import { HANDLED, SOFT_KEYS } from "./Screen";

const DEBIAN: [number, string][] = [[2023, "12"], [2021, "11"], [2019, "10"], [2017, "9"], [2015, "8"], [2013, "7"], [2011, "6.0"], [2009, "5.0"], [2007, "4.0"], [2005, "3.1"]];
const debian = (year: number) => DEBIAN.find(([y]) => year >= y)?.[1] ?? "3.1";
const VM_KEYS = SOFT_KEYS.filter(([, k]) => !k.startsWith("F") && k !== "Delete");

// One of the player's own VMs in a console window: the hypervisor's virtual console with the ISO drive and the power
// keys in the bar. A VM has no BIOS and no boot menu: it boots the installer while the ISO is in, its own disk otherwise.
export function VmConsole({ vm: w, front }: { vm: Workload; front: boolean }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (front) box.current?.focus({ preventScroll: true }); }, [front, w.id]);
  const installer = useInstaller(game, w);
  const st = vmState(game, w), on = st === "running" || st === "down" || st === "frozen", host = hostOfVm(game, w.id);
  const phase = !on ? "dark" : w.media ? "installer" : host?.panel ? "debian" : "nodisk";
  const name = w.hostname ?? vmLabel(game, w).name;
  const onKey = (key: string) => { if (phase === "installer") installer.onKey(key); };
  const keydown = (e: KeyboardEvent) => { if (HANDLED.has(e.key) || e.key.length === 1) { e.preventDefault(); e.stopPropagation(); onKey(e.key); } };
  return (
    <div className="con">
      <div className="con-bar">
        <b>{name}</b>
        <span className="muted">Virtual console</span>
        <span className="grow" />
        <button onClick={() => act(setMedia, w.id, w.media ? null : "lunix")}>{w.media ? "Eject ISO" : "Load installer ISO"}</button>
        {st === "stopped" ? <button onClick={() => act(startWorkload, w.id)}>Power on</button> : <button disabled={!on} onClick={() => act(stopWorkload, w.id)}>Shut down</button>}
      </div>
      <div className="con-body">
        <div className="scr-wrap vm">
          <div ref={box} className="scr" data-look={phase} tabIndex={0} role="application" aria-label="Virtual machine screen" onKeyDown={keydown}>
            {phase === "dark" && <span className="scr-osd">No signal</span>}
            {phase === "installer" && installer.view}
            {phase === "nodisk" && <pre>{"Booting from Hard Disk ...\n\nOperating system not found\nReboot and select proper boot device █"}</pre>}
            {phase === "debian" && <pre>{`Debian GNU/Linux ${debian(yearOf(game.hour))} ${name} tty1\n\n${name} login: █`}</pre>}
          </div>
          <div className="scr-keys" role="group" aria-label="Keys">
            {VM_KEYS.map(([label, key]) => <button key={key} onClick={() => { onKey(key); box.current?.focus({ preventScroll: true }); }}>{label}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
