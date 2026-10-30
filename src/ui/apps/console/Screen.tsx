import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { nowHours, yearOf } from "../../../sim/00-core/time";
import { modelById } from "../../../sim/10-catalog/hardware";
import { SERVER_OS, serverOsAt, serverOsById, type ServerOsId } from "../../../sim/10-catalog/server-os";
import type { Device, GameState } from "../../../sim/50-state";
import { machineScreen, type MachineScreen } from "../../../sim/60-infra/oob";
import { drivesOf } from "../../../sim/60-infra/status";
import { bootFromUsb, enterSetup } from "../../../sim/90-actions/console";
import { continueBoot } from "../../../sim/90-actions/remote";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import { useBios } from "./bios";
import { isDevice, OsInstalling, useInstaller, winEra, type Machine } from "./installer";
import { LunixBoot, LunixLogin, useLunix } from "./lunix";
import { useWindoors, WindoorsBoot } from "./windoors";
import "./console.css";

// How the screen is reached: the controller's remote console, a KVM on the console end, or a monitor plugged in at the rack.
export type Via = "bmc" | "kvm" | "monitor";

const LABELS: Record<string, string> = {
  Delete: "Del", F1: "F1", F2: "F2", F3: "F3", F8: "F8", F10: "F10", F11: "F11", Escape: "Esc", Tab: "Tab", Enter: "Enter",
  Backspace: "Bksp", ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", ArrowRight: "→", d: "D", CtrlAltDel: "Ctrl+Alt+Del",
};
const HANDLED = new Set([...Object.keys(LABELS)]);
const stickName = (os: ServerOsId, year: number) => {
  const v = serverOsAt(os, year).version;
  return os === "lunix" ? `Debiant ${v} netinst` : `Windoors Server ${v}`;
};

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

const UP = new Set<MachineScreen["kind"]>(["login", "desktop", "installing"]);

// What a machine shows once its firmware is through: the installer on the media, the install, the OS booting, the Lunix
// login and shell or the Windoors logon and desktop, or nothing to boot. Login lasts until the machine boots again.
export function useOsScreen(game: GameState, m: Machine, active: boolean, stick: ServerOsId): { screen: MachineScreen; look: string; view: ReactNode; onKey: (k: string) => void; keys: string[] } {
  const token = isDevice(m) ? m.bootUntil ?? 0 : 0;
  const [login, setLogin] = useSessionState<number | null>(`console.${m.id}.login`, null);
  const bare = machineScreen(game, m.id), loggedIn = login === token && UP.has(bare.kind);
  const screen = machineScreen(game, m.id, loggedIn);
  useEffect(() => { if (login !== null && !loggedIn) setLogin(null); }, [login, loggedIn]);
  const logIn = () => setLogin(token), logOut = () => setLogin(null);
  const version = m.os?.version ?? "", os = m.os?.id ?? "lunix";
  const media = screen.kind === "bootMenu" ? (screen.media.length === 1 ? screen.media[0] : stick) : stick;
  const installer = useInstaller(game, m, media);
  const lunix = useLunix(game, m, version, loggedIn, logIn, logOut, active);
  const windoors = useWindoors(game, m, version, loggedIn, logIn, logOut);
  const none = { onKey: () => {}, keys: [] as string[] };
  const win = (v: string) => (winEra(v) === 0 ? "wt" : "ws");
  switch (screen.kind) {
    case "bootMenu": return { screen, look: media === "lunix" ? "deb" : win(serverOsAt("windoors", yearOf(game.hour)).version), ...installer };
    case "osInstall": return { screen, look: screen.os === "lunix" ? "deb" : screen.progress < 0.45 && winEra(version) === 0 ? "wt" : "win", view: <OsInstalling game={game} m={m} os={screen.os} progress={screen.progress} />, ...none };
    case "booting": {
      const left = isDevice(m) ? (m.bootUntil ?? 0) - nowHours(game) : 0, share = 1 - left / (serverOsById(screen.os).bootMinutes / 60);
      return { screen, look: screen.os === "lunix" ? "lunix" : "win", view: screen.os === "lunix" ? <LunixBoot game={game} m={m} version={version} share={share} /> : <WindoorsBoot version={version} />, ...none };
    }
    case "login": case "desktop": case "installing":
      if (os === "windoors") return { screen, look: "win", ...windoors };
      return { screen, look: lunix.look ?? "lunix", ...lunix };
    case "hung": return { screen, look: os === "lunix" ? "lunix" : "win", view: !m.os ? <pre>{"Booting from Hard Disk ...\n\nOperating system not found\nReboot and select proper boot device"}</pre> : os === "lunix" ? <LunixLogin m={m} version={version} cursor="" /> : windoors.view, ...none };
    case "notFound": return { screen, look: "nodisk", view: <pre>{"Booting from Hard Disk ...\n\nOperating system not found\nReboot and select proper boot device █"}</pre>, ...none };
    default: return { screen, look: screen.kind, view: null, ...none };
  }
}

// The soft keys a screen takes, and the keyboard while the screen has focus; a shell's own input keeps its keys.
export function Keys({ keys, onKey, focus }: { keys: string[]; onKey: (k: string) => void; focus: () => void }) {
  return (
    <div className="scr-keys" role="group" aria-label="Keys">
      {[...new Set(keys)].filter((k) => k !== "Backspace").map((k) => <button key={k} onClick={() => { onKey(k); focus(); }}>{LABELS[k] ?? k}</button>)}
    </div>
  );
}
export const keyHandler = (onKey: (k: string) => void) => (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (HANDLED.has(e.key) || e.key.length === 1) { e.preventDefault(); e.stopPropagation(); onKey(e.key); }
};
export const focusIn = (box: HTMLDivElement | null) => (box?.querySelector("input, textarea") as HTMLElement | null ?? box)?.focus({ preventScroll: true });

// The server's screen: black while off, the POST splash (the window for Del and F11), the firmware prompt, the BIOS
// setup, the boot menu, then whatever the OS on its disks or the stick shows.
export function Screen(props: { game: GameState; device: Device; via: Via; active?: boolean }) {
  return <DeviceScreen key={props.device.id} {...props} />;
}

function DeviceScreen({ game, device: d, via, active = true }: { game: GameState; device: Device; via: Via; active?: boolean }) {
  const act = useStore((s) => s.act);
  const box = useRef<HTMLDivElement>(null);
  const bios = useBios(game, d);
  const [stick, setStick] = useSessionState<ServerOsId>(`console.${d.id}.stick`, "lunix");
  // F11 during POST asks for the boot menu once POST is through; it holds for that boot only.
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [pick, setPick] = useState(0);
  const os = useOsScreen(game, d, active, stick), kind = os.screen.kind, year = yearOf(game.hour);
  useEffect(() => { if (active) focusIn(box.current); }, [active, kind]);
  const menu = menuFor !== null && menuFor === d.bootUntil && kind !== "post" && kind !== "setup" && kind !== "dark";
  const devices = ["Hard Disk", ...SERVER_OS.map((o) => `USB: ${stickName(o.id, year)}`), "Network (PXE)"];
  const dark = kind === "dark" || (via === "bmc" && d.bmcHung);
  const shown = dark ? "dark" : menu ? "menu" : kind === "setup" ? "bios" : kind;
  const onKey = (key: string) => {
    if (shown === "post") { if (key === "Delete" || key === "F2") act(enterSetup, d.id); else if (key === "F11") setMenuFor(d.bootUntil ?? 0); }
    else if (shown === "stuck") { if (key === "F1") act(continueBoot, d.id); else if (key === "Delete" || key === "F2") act(enterSetup, d.id); }
    else if (shown === "bios") bios.onKey(key);
    else if (shown === "menu") {
      if (key === "ArrowUp") setPick((p) => Math.max(0, p - 1));
      else if (key === "ArrowDown") setPick((p) => Math.min(devices.length - 1, p + 1));
      else if (key === "Escape" || (key === "Enter" && pick === 0)) setMenuFor(null);
      else if (key === "Enter" && pick <= SERVER_OS.length) { setStick(SERVER_OS[pick - 1].id); act(bootFromUsb, d.id); setMenuFor(null); }
    } else if (shown !== "dark" && shown !== "hung") os.onKey(key);
  };
  const keys = shown === "post" ? ["Delete", "F2", "F11"] : shown === "stuck" ? ["F1", "Delete"] : shown === "bios" ? ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight", "Enter", "Escape", "F10"]
    : shown === "menu" ? ["ArrowUp", "ArrowDown", "Enter", "Escape"] : shown === "dark" || shown === "hung" ? [] : os.keys;
  const look = shown === "bios" || shown === "menu" || shown === "dark" || shown === "post" || shown === "stuck" ? shown : os.look;
  return (
    <div className={`scr-wrap ${via}`}>
      <div ref={box} className="scr" data-look={look} data-hung={kind === "hung" || undefined} tabIndex={0} role="application" aria-label="Server screen" onKeyDown={keyHandler(onKey)}>
        {shown === "dark" && <span className="scr-osd">No signal</span>}
        {shown === "post" && <Post game={game} d={d} />}
        {shown === "stuck" && <pre>{"CMOS checksum error - Defaults loaded\nPress F1 to continue, DEL to enter SETUP"}</pre>}
        {shown === "bios" && bios.view}
        {shown === "menu" && (
          <div className="bootmenu">
            <div className="bootmenu-t">Please select boot device:</div>
            {devices.map((x, i) => <div key={x} className={`inst-row${i === pick ? " on" : ""}`}>{x}</div>)}
            {pick === devices.length - 1 && <div className="muted">PXE-E53: No boot filename received</div>}
          </div>
        )}
        {!["dark", "post", "stuck", "bios", "menu"].includes(shown) && os.view}
      </div>
      <Keys keys={keys} onKey={onKey} focus={() => focusIn(box.current)} />
    </div>
  );
}
