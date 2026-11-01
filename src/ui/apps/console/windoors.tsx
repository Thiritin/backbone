import { useState } from "react";
import { isLicensed } from "../../../sim/60-infra/licence";
import { t } from "../../../i18n/en";
import { dateOf, yearOf } from "../../../sim/00-core/time";
import { runsOn, SOFTWARE, softwareById, type Software } from "../../../sim/10-catalog/platforms";
import type { Device, GameState, IfaceConfig } from "../../../sim/50-state";
import { isIp, maskOf, prefixOf } from "../../../sim/60-infra/ifaces";
import { addressOf, macOf } from "../../../sim/60-infra/lan";
import { setIface } from "../../../sim/90-actions/lan";
import { installDone, installLog } from "../../../sim/60-infra/apt";
import { machineNet, machineScreen } from "../../../sim/60-infra/oob";
import { supportOn } from "../../../sim/60-infra/lifecycle";
import { reboot } from "../../../sim/90-actions/hardware";
import { installFromSite } from "../../../sim/90-actions/console";
import { installBlock, softwareOn, uninstallSoftware } from "../../../sim/90-actions/software";
import { useStore } from "../../store";
import { hostOf, hoursLeft, isDevice, winEra, type Keyed, type Machine } from "./installer";
import { LOCALE } from "../../../i18n/lang";

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
      {era === 2 && <div className="wl-clock">{clock(game)}<small>{d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</small></div>}
      <div className="wl-box">
        {era !== 2 && <div className="wl-h">{`Windoors Server ${version}`}</div>}
        {pass === null
          ? <div>{era === 0 ? t("console.logonBegin") : era === 1 ? t("console.logonLogOn") : t("console.logonUnlock")}</div>
          : <><div>{era === 0 ? t("console.logonUser") : "Administrator"}</div><div className="wl-pass">{"•".repeat(pass.length)}<span className="wl-caret" /></div></>}
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

type Win = "manager" | "roles" | "programs" | "adapter" | null;
const endSuffix = (game: GameState, m: Machine, id: string): string => {
  const support = supportOn(game, m.id, id);
  return support === "supported" ? "" : ` (${t(`software.support.${support}`)})`;
};

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
  0: [t("console.manageServer"), t("console.addRemovePrograms"), t("console.logOff")],
  1: [t("console.serverManager"), t("console.programsFeatures"), t("console.logOff")],
  2: [t("console.serverManager"), t("console.programsFeatures"), t("console.signOut")],
};

function Desktop({ game, m, version, era, logOut }: { game: GameState; m: Machine; version: string; era: Era; logOut: () => void }) {
  const [win, setWin] = useState<Win>("manager");
  const [start, setStart] = useState(false);
  const items = START_ITEMS[era];
  const open = (w: Win) => { setWin(w); setStart(false); };
  const title = win === "manager" ? items[0] : win === "programs" ? items[1] : win === "roles" ? ROLE_WIZARD[era] : win === "adapter" ? t("console.win.adapter") : "";
  return (
    <div className="wd" data-era={era}>
      <div className="wd-area">
        {win && (
          <div className="wd-win">
            <div className="wd-bar"><span>{title}</span><button aria-label={t("console.close")} onClick={() => setWin(null)}>×</button></div>
            <div className="wd-body">
              {win === "manager" && <Manager game={game} m={m} version={version} era={era} open={setWin} />}
              {win === "roles" && <Wizard game={game} m={m} era={era} items={entries(game, m, era === 2 ? null : true)} close={() => setWin("manager")} />}
              {win === "programs" && <Programs game={game} m={m} era={era} />}
              {win === "adapter" && isDevice(m) && <Adapter game={game} m={m} close={() => setWin("manager")} />}
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
        <button className="wd-startbtn" onClick={() => setStart(!start)}>{era === 0 ? t("console.startOld") : t("console.start")}</button>
        <span className="wd-tasks">{win && <span>{title}</span>}</span>
        {machineNet(game, m.id) && <span className="wd-net" title={t("console.noNetworkAccess")}>{era === 0 ? NO_NET_2003 : NO_NET}</span>}
        <span className="wd-clock">{clock(game)}</span>
      </div>
    </div>
  );
}

// The tray's no-network icon: the two monitors with the red X, then the globe with the yellow warning.
const NO_NET_2003 = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-label={t("console.noNetworkAccess")}>
    <rect x="1" y="2" width="8" height="6" fill="#dfe8f6" stroke="#333" /><rect x="5" y="6" width="8" height="6" fill="#dfe8f6" stroke="#333" />
    <circle cx="12" cy="12" r="3.5" fill="#d00" /><path d="M10.6 10.6l2.8 2.8M13.4 10.6l-2.8 2.8" stroke="#fff" strokeWidth="1.3" />
  </svg>
);
const NO_NET = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-label={t("console.noNetworkAccess")}>
    <circle cx="7" cy="7" r="5.5" fill="none" stroke="#cfe3ff" /><path d="M1.5 7h11M7 1.5c-3 3-3 8 0 11M7 1.5c3 3 3 8 0 11" fill="none" stroke="#cfe3ff" />
    <path d="M11.5 8.3l4 7.2h-8z" fill="#f5c400" stroke="#333" strokeWidth=".6" /><path d="M11.5 10.8v2.4M11.5 14.1v.6" stroke="#000" />
  </svg>
);
const NetLine = ({ game, m }: { game: GameState; m: Machine }) => (machineNet(game, m.id) ? <div className="wm1-sec">{t("console.networkLine")}</div> : null);

type AdapterField = "ip" | "mask" | "gw" | "dns";
const ADAPTER_FIELDS: AdapterField[] = ["ip", "mask", "gw", "dns"];
// Without a lease Windoors configures itself a link-local address from its MAC.
const linkLocal = (mac: string) => { const b = mac.split(":").map((x) => parseInt(x, 16)); return `169.254.${b[4]}.${b[5]}`; };

// The adapter's IPv4 properties: by DHCP, or a fixed address with mask, gateway and DNS server (lan.md, Installer).
function Adapter({ game, m, close }: { game: GameState; m: Device; close: () => void }) {
  const act = useStore((s) => s.act);
  const c = game.devices.find((x) => x.id === m.id)?.iface ?? { mode: "dhcp" as const };
  const [auto, setAuto] = useState(c.mode === "dhcp");
  const [form, setForm] = useState<Record<AdapterField, string>>({ ip: c.ip ?? "", mask: maskOf(c.prefix ?? 24), gw: c.gw ?? "", dns: c.dns ?? "" });
  const [note, setNote] = useState("");
  const apply = (iface: IfaceConfig) => { const r = act(setIface, m.id, iface); if (r.ok) close(); else setNote(t(r.error)); };
  const ok = () => {
    if (auto) return apply({ mode: "dhcp" });
    const prefix = prefixOf(form.mask);
    if (!isIp(form.ip) || prefix === null || [form.gw, form.dns].some((x) => x && !isIp(x))) return setNote(t("console.win.invalid"));
    apply({ mode: "static", ip: form.ip, prefix, ...(form.gw ? { gw: form.gw } : {}), ...(form.dns ? { dns: form.dns } : {}) });
  };
  return (
    <div className="wa">
      <div className="wm1-sec">{t("console.win.ipv4")}<span>{t("console.win.address", { ip: addressOf(game, m.id) ?? linkLocal(macOf(game, m.id)) })}</span></div>
      <label><input type="radio" name="wa-mode" checked={auto} onChange={() => setAuto(true)} /> {t("console.win.auto")}</label>
      <label><input type="radio" name="wa-mode" checked={!auto} onChange={() => setAuto(false)} /> {t("console.win.manual")}</label>
      {ADAPTER_FIELDS.map((f) => (
        <label key={f} className="wa-row"><span>{t(`console.win.${f}`)}</span><input value={form[f]} disabled={auto} inputMode="decimal" onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></label>
      ))}
      {note && <div className="wm-note">{note}</div>}
      <div className="wm-links"><button onClick={ok}>{t("console.ok")}</button><button onClick={close}>{t("console.cancel")}</button></div>
    </div>
  );
}
const AdapterLink = ({ m, open }: { m: Machine; open: (w: Win) => void }) => (isDevice(m) ? <div className="wm-links"><button onClick={() => open("adapter")}>{t("console.win.adapter")}</button></div> : null);

const ROLE_WIZARD: Record<Era, string> = { 0: t("console.wizard0"), 1: t("console.wizard1"), 2: t("console.wizard2") };
const STEPS: Record<Era, string[]> = {
  0: [t("console.stepServerRole"), t("console.stepSummary"), t("console.stepApplying")],
  1: [t("console.stepBegin"), t("console.stepRoles"), t("console.stepConfirmation"), t("console.stepProgress"), t("console.stepResults")],
  2: [t("console.stepBegin"), t("console.stepInstallType"), t("console.stepServerSelection"), t("console.stepRoles"), t("console.stepFeatures"), t("console.stepConfirmation"), t("console.stepResults")],
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
          {e.installing ? <span className="muted">{t("console.installing")}</span> : <button onClick={() => { const r = act(uninstallSoftware, m.id); setNote(r.ok ? "" : t(r.error)); }}>{label}</button>}
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
      <div className="wm0-h"><b>{t("console.manageServer")}</b><span>{t("console.serverHost", { host })}</span></div>
      <div className="wm0-body">
        <NetLine game={game} m={m} />
        <AdapterLink m={m} open={open} />
        <div className="wm0-t">{t("console.configuredRoles")}</div>
        <Installed game={game} m={m} list={all} label={t("console.remove")} />
        <div className="wm-links">
          <button onClick={() => open("roles")}>{t("console.addRemoveRole")}</button>
          <button onClick={() => open("programs")}>{t("console.addRemovePrograms")}</button>
        </div>
      </div>
    </div>
  );
  if (era === 1) return (
    <div className="wm1">
      <ul className="wm1-tree">
        <li className="on">{t("console.serverManager")} ({host})</li>
        {[t("console.treeRoles"), t("console.treeFeatures"), t("console.treeDiagnostics"), t("console.treeConfiguration"), t("console.treeStorage")].map((x) => <li key={x}>{x}</li>)}
      </ul>
      <div className="wm1-main">
        <div className="wm1-h">{t("console.serverManager")}</div>
        <div className="wm1-sec">{t("console.serverSummary")}<span>{t("console.computerName", { host, version })}</span></div>
        <NetLine game={game} m={m} />
        <AdapterLink m={m} open={open} />
        <div className="wm1-sec">{t("console.rolesSummary")}</div>
        <Installed game={game} m={m} list={all} label={t("console.remove")} />
        <div className="wm-links"><button onClick={() => open("roles")}>{t("console.addRoles")}</button><button onClick={() => open("programs")}>{t("console.programsFeatures")}</button></div>
      </div>
    </div>
  );
  return (
    <div className="wm2">
      <div className="wm2-h">{t("console.serverManager")} <span>{t("console.dashboard")}</span></div>
      <div className="wm2-tiles">
        <button onClick={() => open("roles")}><b>2</b> {t("console.addRolesFeatures")}</button>
        <button disabled><b>3</b> {t("console.addOtherServers")}</button>
      </div>
      <NetLine game={game} m={m} />
      <AdapterLink m={m} open={open} />
      <div className="wm1-sec">{t("console.rolesFeaturesOn", { host })}</div>
      <Installed game={game} m={m} list={all} label={t("console.remove")} />
    </div>
  );
}

// The install wizard: pick one, confirm, then the Progress page over the install hours and the result.
function Wizard({ game, m, era, items, close, roles = true }: { game: GameState; m: Machine; era: Era; items: Entry[]; close: () => void; roles?: boolean }) {
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "confirm" | "run" | "failed">("pick");
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const sw = pick ? softwareById(pick) : null, mine = items.find((e) => e.sw.id === pick);
  const now = machineScreen(game, m.id, true);
  const shown = phase !== "run" ? phase : mine?.installing ? "progress" : "results";
  const install = () => {
    const r = act(installFromSite, m.id, pick!, key.trim() || undefined);
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
          <div className="wz-t">{!roles ? t("console.selectProgram") : era === 0 ? t("console.selectRole") : t("console.selectRolesInstall")}</div>
          {items.length === 0 && <div className="muted">{roles ? t("console.noRoles") : t("console.noPrograms")}</div>}
          {items.map((e) => (
            <label key={e.sw.id} className={`wz-row${e.why && !e.installed ? " dim" : ""}`}>
              <input type="radio" name="sw" checked={pick === e.sw.id || e.installed} disabled={e.installed || e.installing || !!e.why} onChange={() => setPick(e.sw.id)} />
              <span>{e.sw.name}{e.installed ? t("console.installedSuffix") : ""}{e.installed ? endSuffix(game, m, e.sw.id) : ""}</span>
              {e.why && !e.installed && !e.installing && <small>{t(e.why)}</small>}
            </label>
          ))}
        </>}
        {shown === "confirm" && sw && <>
          <div className="wz-t">{t("console.confirmSelections")}</div>
          <div>{sw.name}</div>
          <div className="muted">{t("console.installTime", { n: sw.installHours })}</div>
          {isLicensed(sw.id) && <label className="wz-row">{t("vendor-sites.licenceKey")}<input value={key} spellCheck={false} autoComplete="off" onChange={(e) => setKey(e.target.value)} /></label>}
        </>}
        {shown === "progress" && sw && <>
          <div className="wz-t">{t("console.installProgress")}</div>
          <div>{sw.name}</div>
          <div>{log[Math.min(log.length - 1, Math.floor(share * log.length))]}</div>
          <div className="inst-bar"><span style={{ width: `${Math.floor(share * 100)}%` }} /></div>
          <div className="muted">{doneAt !== null ? t("console.hoursLeft", { n: hoursLeft(game, doneAt) }) : ""}</div>
        </>}
        {shown === "failed" && sw && <>
          <div className="wz-t">{t("console.installProgress")}</div>
          <div>{sw.name}</div>
          <div className="wm-note">{t("error.noDownload")}</div>
        </>}
        {shown === "results" && sw && <>
          <div className="wz-t">{t("console.installSucceeded")}</div>
          {installDone(game, m.id, sw).map((x) => <div key={x}>{x}</div>)}
        </>}
        {note && <div className="wm-note">{note}</div>}
        <div className="wz-btns">
          {shown === "pick" && <><button disabled={!pick} onClick={() => setPhase("confirm")}>{t("console.next")}</button><button onClick={close}>{t("console.cancel")}</button></>}
          {shown === "confirm" && <><button onClick={() => setPhase("pick")}>{t("console.previous")}</button><button onClick={install}>{t("console.install")}</button></>}
          {shown === "results" && isDevice(m) && <button onClick={() => act(reboot, m.id)}>{t("console.restartNow")}</button>}
          {(shown === "progress" || shown === "results" || shown === "failed") && <button onClick={close}>{t("console.close")}</button>}
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
      <div className="wp-tabs"><b>{era === 0 ? t("console.changeRemove") : t("console.uninstallChange")}</b><button onClick={() => setAdding(true)}>{era === 0 ? t("console.addNewPrograms") : t("console.installFromNetwork")}</button></div>
      <Installed game={game} m={m} list={list} label={era === 0 ? t("console.remove") : t("console.uninstall")} />
    </div>
  );
}
