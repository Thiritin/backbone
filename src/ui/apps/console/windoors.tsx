import { useState } from "react";
import { t } from "../../../i18n/en";
import { dateOf, yearOf } from "../../../sim/00-core/time";
import { runsOn, SOFTWARE, softwareById, type Software } from "../../../sim/10-catalog/platforms";
import type { GameState } from "../../../sim/50-state";
import { installDone, installLog } from "../../../sim/60-infra/apt";
import { machineNet, machineScreen } from "../../../sim/60-infra/oob";
import { reboot } from "../../../sim/90-actions/hardware";
import { installFromSite } from "../../../sim/90-actions/console";
import { installBlock, softwareOn, uninstallSoftware } from "../../../sim/90-actions/software";
import { useStore } from "../../store";
import { hostOf, hoursLeft, isDevice, winEra, type Keyed, type Machine } from "./installer";

type Era = 0 | 1 | 2;
const clock = (game: GameState) => `${String(dateOf(game.hour).getUTCHours()).padStart(2, "0")}:${String(game.minute).padStart(2, "0")}`;

// The boot: the scrolling bar of 2003, the green bar to 2012 R2, the flat spinner after.
export function WindoorsBoot({ version }: { version: string }) {
  const era = winEra(version);
  return (
    <div className="wb" data-era={era}>
      <div className="wb-logo">{`Windoors Server ${version}`}</div>
      {era === 2 ? <div className="wb-spin" /> : <div className="wb-bar"><span /></div>}
    </div>
  );
}

// The logon until someone presses Ctrl+Alt+Delete and types any Administrator password, then the desktop with Server
// Manager open; pass is null until the password box is up.
export function useWindoors(game: GameState, m: Machine, version: string, loggedIn: boolean, logIn: () => void, logOut: () => void): Keyed {
  const era = winEra(version);
  const [pass, setPass] = useState<string | null>(null);
  if (loggedIn) return { view: <Desktop game={game} m={m} version={version} era={era} logOut={logOut} />, onKey: () => {}, keys: [] };
  const d = dateOf(game.hour);
  const view = (
    <div className="wl" data-era={era}>
      {era === 2 && <div className="wl-clock">{clock(game)}<small>{d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</small></div>}
      <div className="wl-box">
        {era !== 2 && <div className="wl-h">{`Windoors Server ${version}`}</div>}
        {pass === null
          ? <div>{era === 0 ? "Press Ctrl-Alt-Delete to begin." : era === 1 ? "Press Ctrl+Alt+Delete to log on." : "Press Ctrl+Alt+Delete to unlock."}</div>
          : <><div>{era === 0 ? "User name: Administrator" : "Administrator"}</div><div className="wl-pass">{"•".repeat(pass.length)}<span className="wl-caret" /></div></>}
      </div>
    </div>
  );
  const onKey = (k: string) => {
    if (pass === null) { if (k === "CtrlAltDel" || k === "Enter") setPass(""); }
    else if (k === "Enter") { setPass(null); logIn(); }
    else if (k === "Escape") setPass(null);
    else if (k === "Backspace") setPass(pass.slice(0, -1));
    else if (k.length === 1) setPass(pass + k);
  };
  return { view, onKey, keys: pass === null ? ["CtrlAltDel"] : ["Enter", "Escape", "Backspace"] };
}

type Win = "manager" | "roles" | "programs" | null;
interface Entry { sw: Software; installed: boolean; installing: boolean; why: string | null }

// The Windoors software the year allows, roles (the hypervisor) or programs, with whether it is on the machine.
function entries(game: GameState, m: Machine, roles: boolean | null): Entry[] {
  const year = yearOf(game.hour), on = softwareOn(game, m.id);
  return SOFTWARE.filter((sw) => runsOn(sw, "windoors") && year >= sw.from && (roles === null || (sw.exclusive === "hypervisor") === roles)).map((sw) => {
    const x = on.find((y) => y.id === sw.id);
    return { sw, installed: !!x && x.doneAt === null, installing: !!x && x.doneAt !== null, why: x ? null : installBlock(game, m.id, sw.id) };
  });
}

const START_ITEMS: Record<Era, [string, string, string]> = {
  0: ["Manage Your Server", "Add or Remove Programs", "Log Off"],
  1: ["Server Manager", "Programs and Features", "Log Off"],
  2: ["Server Manager", "Programs and Features", "Sign out"],
};

function Desktop({ game, m, version, era, logOut }: { game: GameState; m: Machine; version: string; era: Era; logOut: () => void }) {
  const [win, setWin] = useState<Win>("manager");
  const [start, setStart] = useState(false);
  const items = START_ITEMS[era];
  const open = (w: Win) => { setWin(w); setStart(false); };
  const title = win === "manager" ? items[0] : win === "programs" ? items[1] : win === "roles" ? ROLE_WIZARD[era] : "";
  return (
    <div className="wd" data-era={era}>
      <div className="wd-area">
        {win && (
          <div className="wd-win">
            <div className="wd-bar"><span>{title}</span><button aria-label="Close" onClick={() => setWin(null)}>×</button></div>
            <div className="wd-body">
              {win === "manager" && <Manager game={game} m={m} version={version} era={era} open={setWin} />}
              {win === "roles" && <Wizard game={game} m={m} era={era} items={entries(game, m, era === 2 ? null : true)} close={() => setWin("manager")} />}
              {win === "programs" && <Programs game={game} m={m} era={era} />}
            </div>
          </div>
        )}
      </div>
      {start && (
        <div className="wd-menu">
          <button onClick={() => open("manager")}>{items[0]}</button>
          <button onClick={() => open("programs")}>{items[1]}</button>
          <button onClick={() => { setStart(false); logOut(); }}>{items[2]}</button>
        </div>
      )}
      <div className="wd-task">
        <button className="wd-startbtn" onClick={() => setStart(!start)}>{era === 0 ? "start" : "Start"}</button>
        <span className="wd-tasks">{win && <span>{title}</span>}</span>
        {machineNet(game, m.id) && <span className="wd-net" title="No network access">{era === 0 ? NO_NET_2003 : NO_NET}</span>}
        <span className="wd-clock">{clock(game)}</span>
      </div>
    </div>
  );
}

// The tray's no-network icon: the two monitors with the red X, then the globe with the yellow warning.
const NO_NET_2003 = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-label="No network access">
    <rect x="1" y="2" width="8" height="6" fill="#dfe8f6" stroke="#333" /><rect x="5" y="6" width="8" height="6" fill="#dfe8f6" stroke="#333" />
    <circle cx="12" cy="12" r="3.5" fill="#d00" /><path d="M10.6 10.6l2.8 2.8M13.4 10.6l-2.8 2.8" stroke="#fff" strokeWidth="1.3" />
  </svg>
);
const NO_NET = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-label="No network access">
    <circle cx="7" cy="7" r="5.5" fill="none" stroke="#cfe3ff" /><path d="M1.5 7h11M7 1.5c-3 3-3 8 0 11M7 1.5c3 3 3 8 0 11" fill="none" stroke="#cfe3ff" />
    <path d="M11.5 8.3l4 7.2h-8z" fill="#f5c400" stroke="#333" strokeWidth=".6" /><path d="M11.5 10.8v2.4M11.5 14.1v.6" stroke="#000" />
  </svg>
);
const NetLine = ({ game, m }: { game: GameState; m: Machine }) => (machineNet(game, m.id) ? <div className="wm1-sec">Network: no network access</div> : null);

const ROLE_WIZARD: Record<Era, string> = { 0: "Configure Your Server Wizard", 1: "Add Roles Wizard", 2: "Add Roles and Features Wizard" };
const STEPS: Record<Era, string[]> = {
  0: ["Server Role", "Summary of Selections", "Applying Selections"],
  1: ["Before You Begin", "Server Roles", "Confirmation", "Progress", "Results"],
  2: ["Before You Begin", "Installation Type", "Server Selection", "Server Roles", "Features", "Confirmation", "Results"],
};
// Where each phase of the install sits in the era's step list.
const AT: Record<Era, Record<"pick" | "confirm" | "progress" | "results", number>> = {
  0: { pick: 0, confirm: 1, progress: 2, results: 2 },
  1: { pick: 1, confirm: 2, progress: 3, results: 4 },
  2: { pick: 3, confirm: 5, progress: 6, results: 6 },
};

function Installed({ game, m, list, label }: { game: GameState; m: Machine; list: Entry[]; label: string }) {
  const act = useStore((s) => s.act);
  const [note, setNote] = useState("");
  const on = list.filter((e) => e.installed || e.installing);
  if (!on.length) return null;
  return (
    <div className="wm-list">
      {on.map((e) => (
        <div key={e.sw.id} className="wm-item">
          <span>{e.sw.name}</span>
          {e.installing ? <span className="muted">Installing</span> : <button onClick={() => { const r = act(uninstallSoftware, m.id); setNote(r.ok ? "" : t(r.error)); }}>{label}</button>}
        </div>
      ))}
      {note && <div className="wm-note">{note}</div>}
      {game && null}
    </div>
  );
}

// Server Manager as each era has it: Manage Your Server, the console with its tree, or the flat dashboard.
function Manager({ game, m, version, era, open }: { game: GameState; m: Machine; version: string; era: Era; open: (w: Win) => void }) {
  const host = hostOf(m), all = entries(game, m, null);
  if (era === 0) return (
    <div className="wm0">
      <div className="wm0-h"><b>Manage Your Server</b><span>Server: {host}</span></div>
      <div className="wm0-body">
        <NetLine game={game} m={m} />
        <div className="wm0-t">Your server has been configured with the following roles and programs:</div>
        <Installed game={game} m={m} list={all} label="Remove" />
        <div className="wm-links">
          <button onClick={() => open("roles")}>Add or remove a role</button>
          <button onClick={() => open("programs")}>Add or Remove Programs</button>
        </div>
      </div>
    </div>
  );
  if (era === 1) return (
    <div className="wm1">
      <ul className="wm1-tree">
        <li className="on">Server Manager ({host})</li>
        {["Roles", "Features", "Diagnostics", "Configuration", "Storage"].map((x) => <li key={x}>{x}</li>)}
      </ul>
      <div className="wm1-main">
        <div className="wm1-h">Server Manager</div>
        <div className="wm1-sec">Server Summary<span>Computer name: {host}, Windoors Server {version}</span></div>
        <NetLine game={game} m={m} />
        <div className="wm1-sec">Roles Summary</div>
        <Installed game={game} m={m} list={all} label="Remove" />
        <div className="wm-links"><button onClick={() => open("roles")}>Add Roles</button><button onClick={() => open("programs")}>Programs and Features</button></div>
      </div>
    </div>
  );
  return (
    <div className="wm2">
      <div className="wm2-h">Server Manager <span>Dashboard</span></div>
      <div className="wm2-tiles">
        <button onClick={() => open("roles")}><b>2</b> Add roles and features</button>
        <button disabled><b>3</b> Add other servers to manage</button>
      </div>
      <NetLine game={game} m={m} />
      <div className="wm1-sec">Roles and features on {host}</div>
      <Installed game={game} m={m} list={all} label="Remove" />
    </div>
  );
}

// The install wizard: pick one, confirm, then the Progress page over the install hours and the result.
function Wizard({ game, m, era, items, close, roles = true }: { game: GameState; m: Machine; era: Era; items: Entry[]; close: () => void; roles?: boolean }) {
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "confirm" | "run" | "failed">("pick");
  const [note, setNote] = useState("");
  const sw = pick ? softwareById(pick) : null, mine = items.find((e) => e.sw.id === pick);
  const now = machineScreen(game, m.id, true);
  const shown = phase !== "run" ? phase : mine?.installing ? "progress" : "results";
  const install = () => {
    const r = act(installFromSite, m.id, pick!);
    if (r.ok) setPhase("run");
    else if (r.error === "error.noDownload") setPhase("failed");
    else setNote(t(r.error));
  };
  const doneAt = softwareOn(game, m.id).find((x) => x.id === pick)?.doneAt ?? null;
  const share = now.kind === "installing" ? now.progress : 0, log = sw ? installLog(sw) : [];
  return (
    <div className="wz" data-era={era} data-steps={roles || undefined}>
      {roles && <ul className="wz-steps">{STEPS[era].map((x, i) => <li key={x} className={i === AT[era][shown === "failed" ? "progress" : shown] ? "on" : ""}>{x}</li>)}</ul>}
      <div className="wz-main">
        {shown === "pick" && <>
          <div className="wz-t">{!roles ? "Select a program" : era === 0 ? "Select a role" : "Select one or more roles to install on this server"}</div>
          {items.length === 0 && <div className="muted">{roles ? "No roles" : "No programs"}</div>}
          {items.map((e) => (
            <label key={e.sw.id} className={`wz-row${e.why && !e.installed ? " dim" : ""}`}>
              <input type="radio" name="sw" checked={pick === e.sw.id || e.installed} disabled={e.installed || e.installing || !!e.why} onChange={() => setPick(e.sw.id)} />
              <span>{e.sw.name}{e.installed ? " (Installed)" : ""}</span>
              {e.why && !e.installed && !e.installing && <small>{t(e.why)}</small>}
            </label>
          ))}
        </>}
        {shown === "confirm" && sw && <>
          <div className="wz-t">Confirm installation selections</div>
          <div>{sw.name}</div>
          <div className="muted">Installation time: {sw.installHours} h</div>
        </>}
        {shown === "progress" && sw && <>
          <div className="wz-t">Installation progress</div>
          <div>{sw.name}</div>
          <div>{log[Math.min(log.length - 1, Math.floor(share * log.length))]}</div>
          <div className="inst-bar"><span style={{ width: `${Math.floor(share * 100)}%` }} /></div>
          <div className="muted">{doneAt !== null ? `${hoursLeft(game, doneAt)} h left` : ""}</div>
        </>}
        {shown === "failed" && sw && <>
          <div className="wz-t">Installation progress</div>
          <div>{sw.name}</div>
          <div className="wm-note">{t("error.noDownload")}</div>
        </>}
        {shown === "results" && sw && <>
          <div className="wz-t">Installation succeeded</div>
          {installDone(game, m.id, sw).map((x) => <div key={x}>{x}</div>)}
        </>}
        {note && <div className="wm-note">{note}</div>}
        <div className="wz-btns">
          {shown === "pick" && <><button disabled={!pick} onClick={() => setPhase("confirm")}>Next</button><button onClick={close}>Cancel</button></>}
          {shown === "confirm" && <><button onClick={() => setPhase("pick")}>Previous</button><button onClick={install}>Install</button></>}
          {shown === "results" && isDevice(m) && <button onClick={() => act(reboot, m.id)}>Restart now</button>}
          {(shown === "progress" || shown === "results" || shown === "failed") && <button onClick={close}>Close</button>}
        </div>
      </div>
    </div>
  );
}

// Add or Remove Programs, or Programs and Features: the installed programs with Remove, and the installers from their sites.
function Programs({ game, m, era }: { game: GameState; m: Machine; era: Era }) {
  const [adding, setAdding] = useState(false);
  const list = entries(game, m, false);
  if (adding) return <Wizard game={game} m={m} era={era} items={list} roles={false} close={() => setAdding(false)} />;
  return (
    <div className="wp">
      <div className="wp-tabs"><b>{era === 0 ? "Change or Remove Programs" : "Uninstall or change a program"}</b><button onClick={() => setAdding(true)}>{era === 0 ? "Add New Programs" : "Install a program from the network"}</button></div>
      <Installed game={game} m={m} list={list} label={era === 0 ? "Remove" : "Uninstall"} />
    </div>
  );
}
