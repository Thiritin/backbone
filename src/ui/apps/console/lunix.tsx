import { useEffect, useRef, useState } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import { serverOsById } from "../../../sim/10-catalog/server-os";
import { releaseOf } from "../../../sim/60-infra/fs";
import type { GameState } from "../../../sim/50-state";
import { softwareOn } from "../../../sim/90-actions/software";
import { Editor } from "../terminal/TerminalApp";
import { useShell, type Line } from "../terminal/shell";
import { hostOf, isDevice, type Keyed, type Machine } from "./installer";

const SHELL_ROWS = 22;

interface BootLine { text: string; ok?: boolean }
export function bootLines(game: GameState, m: Machine, version: string): BootLine[] {
  const k = `${releaseOf(game, m.id).kernel}-amd64`, ram = isDevice(m) ? (modelById(m.model).server?.ramGb ?? 1) : m.ramGb, fs = Number(version) >= 6 ? "ext4" : "ext3";
  const kernel = [
    `[    0.000000] Lunix version ${k} (debiant-kernel@lists.debiant.org)`,
    `[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-${k} root=/dev/sda1 ro quiet`,
    `[    0.000000] Memory: ${ram * 1024 * 1024}K available`,
    "[    0.412337] PCI: Using configuration type 1 for base access",
    "[    1.204518] sd 0:0:0:0: [sda] Attached SCSI disk",
    `[    1.880012] ${fs.toUpperCase()}-fs (sda1): mounted filesystem with ordered data mode`,
    "[    2.310450] eth0: Link is Up 1000 Mbps Full Duplex",
  ].map((text) => ({ text }));
  const units = ["Journal Service", "Load Kernel Modules", "Remount Root and Kernel File Systems", "Create Volatile Files and Directories", "Raise network interfaces", "System Logging Service", "Regular background program processing daemon", "Secure Shell server", "Getty on tty1"];
  if (Number(version) >= 8) return [...kernel, ...units.map((u) => ({ text: `Started ${u}.`, ok: true })), { text: "Reached target Multi-User System.", ok: true }];
  const rc = ["Setting the system clock.", "Checking root file system...done.", "Configuring network interfaces...done.", "Starting system log daemon: syslogd.", "Starting kernel log daemon: klogd.", "Starting periodic command scheduler: cron.", "Starting secure shell server: sshd.", "INIT: Entering runlevel: 2"];
  return [...kernel, ...rc.map((text) => ({ text }))];
}

// The boot scrolling past for the OS's boot minutes; share is how far it is.
export function LunixBoot({ game, m, version, share }: { game: GameState; m: Machine; version: string; share: number }) {
  const all = bootLines(game, m, version), shown = all.slice(0, Math.max(1, Math.ceil(share * all.length)));
  return <pre>{shown.map((l, i) => <div key={i}>{l.ok ? <><span className="ok">[  OK  ]</span> {l.text}</> : l.text}</div>)}</pre>;
}

// pass is null until the username is in; nothing of the password echoes.
interface Login { user: string; pass: string | null; wrong: boolean }
const NO_LOGIN: Login = { user: "", pass: null, wrong: false };

export const LunixLogin = ({ m, version, cursor = "█", login = NO_LOGIN }: { m: Machine; version: string; cursor?: string; login?: Login }) =>
  <pre>{`${serverOsById("lunix").name} ${version} ${hostOf(m)} tty1\n\n${login.wrong ? "Login incorrect\n" : ""}${hostOf(m)} login: ${login.user}${login.pass === null ? cursor : `\nPassword: ${cursor}`}`}</pre>;

// tty1: the login, where root gets in with any password, then the shell on the machine with the Terminal's line editing. A
// machine running VMwhere shows its direct console after the login instead.
export function useLunix(game: GameState, m: Machine, version: string, loggedIn: boolean, logIn: () => void, logOut: () => void, active: boolean): Keyed {
  const shell = useShell(`console.${m.id}`, { host: hostOf(m), deviceId: m.id });
  const host = hostOf(m), input = useRef<HTMLInputElement>(null);
  const [login, setLogin] = useState<Login>(NO_LOGIN);
  const dcui = softwareOn(game, m.id).find((x) => x.id === "vmwhere" && x.doneAt === null);
  useEffect(() => { if (loggedIn && !shell.session) logOut(); }, [loggedIn, shell.session]);
  useEffect(() => { if (active && loggedIn) input.current?.focus({ preventScroll: true }); }, [active, loggedIn, shell.open]);
  if (!loggedIn) {
    const enter = () => {
      const motd: Line[] = [{ text: `Lunix ${host} ${releaseOf(game, m.id).kernel}-amd64 #1 SMP Debiant ${version} x86_64` }, { text: " " }];
      shell.begin({ host, deviceId: m.id }, motd);
      logIn();
    };
    const onKey = (k: string) => {
      const field = login.pass === null ? "user" : "pass", value = login[field] ?? "";
      if (k === "Backspace") setLogin({ ...login, [field]: value.slice(0, -1) });
      else if (k.length === 1) setLogin({ ...login, [field]: value + k });
      else if (k !== "Enter" || (field === "user" && !value.trim())) return;
      else if (field === "user") setLogin({ ...login, pass: "" });
      else if (login.user.trim() !== "root") setLogin({ ...NO_LOGIN, wrong: true });
      else { setLogin(NO_LOGIN); enter(); }
    };
    return { view: <LunixLogin m={m} version={version} login={login} />, onKey, keys: ["Enter", "Backspace"] };
  }
  if (dcui) {
    const view = (
      <div className="dcui">
        <div className="dcui-top"><b>VMwhere ESXi {dcui.cluster?.version ?? ""}</b><span>{isDevice(m) ? `${m.brand} ${modelById(m.model).name}` : host}</span></div>
        <div className="dcui-mid">Download tools to manage this host from: https://{host}/</div>
        <div className="dcui-f"><span>&lt;F2&gt; Customize System/View Logs</span><span>&lt;F12&gt; Shut Down/Restart</span></div>
      </div>
    );
    return { view, onKey: () => {}, keys: [], look: "dcui" };
  }
  if (shell.open) {
    const view = <div className="lx-edit"><Editor file={shell.open} onChange={shell.setOpen} onClose={() => shell.setOpen(null)} /></div>;
    return { view, onKey: () => {}, keys: [] };
  }
  const view = (
    <div className="lx-shell" onClick={() => { if (!getSelection()?.toString()) input.current?.focus(); }}>
      {shell.lines.slice(-SHELL_ROWS).map((l, i) => <div key={i}>{l.prompt && `${l.prompt} `}{l.text}</div>)}
      <div className="lx-row" style={shell.busy ? { visibility: "hidden" } : undefined}>
        <span>{shell.prompt}&nbsp;</span>
        <input
          ref={input} value={shell.draft} aria-label="Command" spellCheck={false} autoCapitalize="off" autoComplete="off"
          onChange={(e) => shell.setDraft(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); shell.onKeyDown(e); }}
          onPaste={(e) => { e.stopPropagation(); shell.onPaste(e); }}
        />
      </div>
    </div>
  );
  return { view, onKey: () => {}, keys: [] };
}
