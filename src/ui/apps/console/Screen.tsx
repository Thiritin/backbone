import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { booting, deviceHealth, drivesOf } from "../../../sim/60-infra/status";
import { bootFromUsb, enterSetup } from "../../../sim/90-actions/console";
import { continueBoot } from "../../../sim/90-actions/remote";
import { softwareOn } from "../../../sim/90-actions/software";
import { useStore } from "../../store";
import { useBios } from "./bios";
import { useInstaller } from "./installer";
import "./console.css";

// How the screen is reached: the controller's remote console, a KVM on the console end, or a monitor plugged in at the rack.
export type Via = "bmc" | "kvm" | "monitor";
type Phase = "dark" | "post" | "stuck" | "bios" | "menu" | "installer" | "os";
type Look = "debian" | "dcui" | "windows" | "nodisk";

export const SOFT_KEYS: [string, string][] = [["Del", "Delete"], ["F1", "F1"], ["F2", "F2"], ["F10", "F10"], ["F11", "F11"], ["Esc", "Escape"], ["Enter", "Enter"], ["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"]];
export const HANDLED = new Set([...SOFT_KEYS.map(([, k]) => k), "Backspace"]);
const BOOT_DEVICES = ["Hard Disk", "USB: Backbone Installer", "Network (PXE)"];
const DEBIAN: [number, string][] = [[2023, "12"], [2021, "11"], [2019, "10"], [2017, "9"], [2015, "8"], [2013, "7"], [2011, "6.0"], [2009, "5.0"], [2007, "4.0"], [2005, "3.1"]];
const debian = (year: number) => DEBIAN.find(([y]) => year >= y)?.[1] ?? "3.1";
const lookOf = (id: string): Look => (id === "vmwhere" ? "dcui" : id === "hypervee" ? "windows" : "debian");

function Post({ game, d }: { game: GameState; d: Device }) {
  const m = modelById(d.model), drives = drivesOf(d);
  return (
    <pre>
{`${d.brand.toUpperCase()} ${m.name}
BIOS Revision ${yearOf(game.hour)}.1

Memory Test: ${(m.server?.ramGb ?? 0) * 1024} MB OK
Detecting drives ... ${drives.length} ${drives.length === 1 ? "drive" : "drives"} found
RAID controller: ${d.raid === "none" ? "no array" : `RAID ${d.raid}, ${drives.length} drives`}

Press DEL to enter SETUP, F11 for Boot Menu`}
    </pre>
  );
}

function Os({ game, d, look, version, hung }: { game: GameState; d: Device; look: Look; version: number; hung: boolean }) {
  const host = d.hostname ?? d.label ?? d.name, year = yearOf(game.hour), cursor = hung ? "" : "█";
  if (look === "nodisk") return <pre>{`Booting from Hard Disk ...\n\nOperating system not found\nReboot and select proper boot device ${cursor}`}</pre>;
  if (look === "dcui") return (
    <div className="dcui">
      <div className="dcui-top"><b>VMwhere ESXi {version}.0</b><span>{d.brand} {modelById(d.model).name}</span></div>
      <div className="dcui-mid">Download tools to manage this host from: https://{host}/</div>
      <div className="dcui-f"><span>&lt;F2&gt; Customize System/View Logs</span><span>&lt;F12&gt; Shut Down/Restart</span></div>
    </div>
  );
  if (look === "windows") return (
    <div className="winlogon">
      <div className="winlogon-b">Windows Server {year < 2012 ? 2008 : year < 2016 ? 2012 : year < 2019 ? 2016 : year < 2022 ? 2019 : 2022}</div>
      <div>Press Ctrl+Alt+Delete to sign in.</div>
    </div>
  );
  return <pre>{`Debian GNU/Linux ${debian(year)} ${host} tty1\n\n${host} login: ${cursor}`}</pre>;
}

// The server's screen: black while off, the POST splash for the whole boot (the window for Del and F11), the firmware
// prompt, the BIOS setup, the boot menu, the installer on the stick, or the operating system's own first screen. Keys come
// from the keyboard while it has focus and from the row of soft keys.
export function Screen({ game, device: d, via, active = true }: { game: GameState; device: Device; via: Via; active?: boolean }) {
  const act = useStore((s) => s.act);
  const box = useRef<HTMLDivElement>(null);
  const boot = booting(game, d);
  useEffect(() => { if (active) box.current?.focus({ preventScroll: true }); }, [active, d.id]);
  const bios = useBios(game, d), installer = useInstaller(game, d);
  // F11 during POST asks for the boot menu once this boot is through; a new boot forgets it.
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState(0);
  useEffect(() => { if (boot) setMenu(false); }, [boot]);
  const state = deviceHealth(game, d.id).state, sw = softwareOn(game, d.id)[0];
  const phase: Phase = !d.on || state === "nopower" || (via === "bmc" && d.bmcHung) ? "dark" : d.setup ? "bios" : d.stuck && !boot ? "stuck" : boot ? "post" : d.bootFrom === "usb" ? "installer" : menu ? "menu" : "os";
  const look: Look | Phase = phase === "os" ? (sw && sw.doneAt === null ? lookOf(sw.id) : "nodisk") : phase;
  const onKey = (key: string) => {
    if (phase === "post") { if (key === "Delete" || key === "F2") act(enterSetup, d.id); else if (key === "F11") setMenu(true); }
    else if (phase === "stuck") { if (key === "F1") act(continueBoot, d.id); else if (key === "Delete" || key === "F2") act(enterSetup, d.id); }
    else if (phase === "bios") bios.onKey(key);
    else if (phase === "installer") installer.onKey(key);
    else if (phase === "menu") {
      if (key === "ArrowUp") setPick((p) => Math.max(0, p - 1));
      else if (key === "ArrowDown") setPick((p) => Math.min(BOOT_DEVICES.length - 1, p + 1));
      else if (key === "Escape" || (key === "Enter" && pick === 0)) setMenu(false);
      else if (key === "Enter" && pick === 1) { act(bootFromUsb, d.id); setMenu(false); }
    }
  };
  const keydown = (e: KeyboardEvent) => { if (HANDLED.has(e.key) || e.key.length === 1) { e.preventDefault(); e.stopPropagation(); onKey(e.key); } };
  return (
    <div className={`scr-wrap ${via}`}>
      <div ref={box} className="scr" data-look={look} data-hung={state === "hung" || undefined} tabIndex={0} role="application" aria-label="Server screen" onKeyDown={keydown}>
        {phase === "dark" && <span className="scr-osd">No signal</span>}
        {phase === "post" && <Post game={game} d={d} />}
        {phase === "stuck" && <pre>{"CMOS checksum error - Defaults loaded\nPress F1 to continue, DEL to enter SETUP"}</pre>}
        {phase === "bios" && bios.view}
        {phase === "menu" && (
          <div className="bootmenu">
            <div className="bootmenu-t">Please select boot device:</div>
            {BOOT_DEVICES.map((x, i) => <div key={x} className={`inst-row${i === pick ? " on" : ""}`}>{x}</div>)}
            {pick === 2 && <div className="muted">PXE-E53: No boot filename received</div>}
          </div>
        )}
        {phase === "installer" && installer.view}
        {phase === "os" && <Os game={game} d={d} look={look as Look} version={sw?.cluster?.version ?? 0} hung={state === "hung"} />}
      </div>
      <div className="scr-keys" role="group" aria-label="Keys">
        {SOFT_KEYS.map(([label, key]) => <button key={key} onClick={() => { onKey(key); box.current?.focus({ preventScroll: true }); }}>{label}</button>)}
      </div>
    </div>
  );
}
