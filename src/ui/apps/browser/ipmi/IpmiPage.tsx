import { LogOut, Monitor, Server } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BMC_NAME } from "../../../../sim/10-catalog/hardware";
import { t } from "../../../../i18n/en";
import type { Device, GameState, RebuildRate } from "../../../../sim/50-state";
import { drivesOf, raidUsable } from "../../../../sim/60-infra/status";
import { rebuildHours } from "../../../../sim/88-tick/tick";
import { setRebuildRate } from "../../../../sim/90-actions/hardware";
import { consoleName } from "../../console/ConsoleWindow";
import { sensorsOf } from "../../../../sim/60-infra/sensors";
import { booting, halting } from "../../../../sim/60-infra/status";
import { powerCycle, reset, setPower, shutdown } from "../../../../sim/90-actions/hardware";
import { useSessionState } from "../../../session";
import { useStore } from "../../../store";
import { stamp } from "../../support/labels";
import "../consoles/consoles.css";
import "./ipmi.css";

// Each brand's controller keeps its own look and page structure whatever the desktop theme.
export type BmcLook = "idraq" | "ilol" | "ipmi" | "xclarify";
export const BMC_LOOK: Record<string, { look: BmcLook; frame: "top" | "side"; color: string }> = {
  Dwell: { look: "idraq", frame: "top", color: "#0b2f5e" },
  "Hewlett-Packet": { look: "ilol", frame: "side", color: "#00877c" },
  SuperMacro: { look: "ipmi", frame: "top", color: "#6b6b6b" },
  Lenovoid: { look: "xclarify", frame: "side", color: "#2e8f4a" },
};
const FALLBACK = BMC_LOOK.SuperMacro;
export const bmcTitle = (brand: string): string => (brand === "SuperMacro" ? "SuperMacro IPMI" : BMC_NAME[brand] ?? "IPMI");

type Tab = "power" | "storage" | "sensors" | "log";
const TABS: [Tab, string][] = [["power", "Power"], ["storage", "Storage"], ["sensors", "Sensors"], ["log", "Event log"]];
const RATES: [RebuildRate, string][] = [["low", "Low"], ["medium", "Medium"], ["high", "High"]];

// The array as the BIOS set it up, with the rebuild rate the controller can change while the server runs.
function StorageTab({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act);
  const rb = d.rebuild, done = rb ? Math.max(0, Math.min(1, 1 - (rb.doneAt - game.hour) / rebuildHours(d))) : 0;
  return (
    <>
      <dl className="bmc-facts">
        <div><dt>RAID level</dt><dd>{d.raid === "none" ? "None" : `RAID ${d.raid}`}</dd></div>
        <div><dt>Drives</dt><dd className="num">{drivesOf(d).length}</dd></div>
        <div><dt>Usable</dt><dd className="num">{raidUsable(d)} GB</dd></div>
        {rb && <div><dt>Rebuild</dt><dd className="num">{Math.floor(done * 100)}%</dd></div>}
      </dl>
      <div className="bmc-actions">
        {RATES.map(([v, l]) => <button key={v} className={`cx-btn${d.rebuildRate === v ? " primary" : ""}`} aria-pressed={d.rebuildRate === v} onClick={() => act(setRebuildRate, d.id, v)}>Rebuild rate {l}</button>)}
      </div>
    </>
  );
}
const SIGN_IN: Record<BmcLook, string> = { idraq: "Log in", ilol: "Sign in", ipmi: "Login", xclarify: "Connect" };

function Brand({ brand, size = 22 }: { brand: string; size?: number }) {
  const look = BMC_LOOK[brand] ?? FALLBACK;
  return (
    <span className="cx-brand">
      <span className="bmc-mark" style={{ width: size, height: size, background: look.color }}><Server size={Math.round(size * 0.62)} /></span>
      <b>{bmcTitle(brand)}</b>
    </span>
  );
}

function PowerTab({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act);
  const state = !d.on ? "Off" : booting(game, d) ? "Booting" : halting(d) ? "Shutting down" : "On";
  return (
    <>
      <dl className="bmc-facts">
        <div><dt>Server</dt><dd>{d.hostname ?? d.label ?? d.name}</dd></div>
        <div><dt>Power</dt><dd className={`bmc-state ${d.on ? "on" : "off"}`}>{state}</dd></div>
      </dl>
      <div className="bmc-actions">
        <button className="cx-btn primary" disabled={d.on} onClick={() => act(setPower, d.id, true)}>Power on</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(shutdown, d.id)}>Graceful shutdown</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(reset, d.id)}>Reset</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(powerCycle, d.id)}>Power cycle</button>
      </div>
    </>
  );
}

const PSU_STATE = { ok: "OK", failed: "Failed", unplugged: "No input" } as const;

function SensorsTab({ game, d }: { game: GameState; d: Device }) {
  const s = sensorsOf(game, d);
  return (
    <table className="bmc-table">
      <thead><tr><th>Sensor</th><th>Reading</th></tr></thead>
      <tbody>
        <tr><td>Inlet temperature</td><td className="num">{s.inletC.toFixed(1)} °C</td></tr>
        {s.fans.map((f, i) => <tr key={f.id}><td>Fan {i + 1}</td><td className={`num${f.rpm === 0 ? " bad" : ""}`}>{f.rpm} RPM</td></tr>)}
        {s.psus.map((p, i) => <tr key={p.id}><td>Power supply {i + 1}</td><td className={p.state === "ok" ? "" : "bad"}>{PSU_STATE[p.state]}</td></tr>)}
      </tbody>
    </table>
  );
}

function LogTab({ d }: { d: Device }) {
  return (
    <table className="bmc-table">
      <thead><tr><th>Time</th><th>Event</th></tr></thead>
      <tbody>
        {[...d.log].reverse().map((e, i) => <tr key={i}><td className="num">{stamp(e.hour)}</td><td>{t(e.key)}</td></tr>)}
        {!d.log.length && <tr><td colSpan={2} className="bmc-empty">No entries</td></tr>}
      </tbody>
    </table>
  );
}

function Login({ brand, host, onLogin }: { brand: string; host: string; onLogin: () => void }) {
  const look = BMC_LOOK[brand] ?? FALLBACK;
  return (
    <div className="cx cx-login" data-look={look.look}>
      <form className="cx-card" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        <Brand brand={brand} size={32} />
        <div className="cx-host">{host}</div>
        <label className="cx-field">Username<input defaultValue="root" autoComplete="off" /></label>
        <label className="cx-field">Password<input type="password" defaultValue="calvin" autoComplete="off" /></label>
        <button className="cx-btn primary" type="submit">{SIGN_IN[look.look]}</button>
      </form>
    </div>
  );
}

export function IpmiPage({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const [logins, setLogins] = useSessionState<string[]>("browser.logins", []);
  const [tab, setTab] = useState<Tab>("power");
  const openConsole = useStore((s) => s.openConsole);
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d) return null;
  const key = `ipmi:${d.id}`, look = BMC_LOOK[d.brand] ?? FALLBACK;
  if (!logins.includes(key)) return <Login brand={d.brand} host={host} onLogin={() => setLogins([...logins, key])} />;
  const body: ReactNode = tab === "power" ? <PowerTab game={game} d={d} /> : tab === "storage" ? <StorageTab game={game} d={d} /> : tab === "sensors" ? <SensorsTab game={game} d={d} /> : <LogTab d={d} />;
  const tabs = TABS.map(([id, label]) => <button key={id} className="cx-tab" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>);
  const logout = <>
    <button className="cx-btn ghost" onClick={() => openConsole(d.id)}><Monitor aria-hidden />{consoleName(game, d).replace(/^\S+ /, "")}</button>
    <button className="cx-btn ghost" onClick={() => setLogins(logins.filter((x) => x !== key))}><LogOut aria-hidden />Log out</button>
  </>;
  return look.frame === "top" ? (
    <div className="cx" data-look={look.look} data-frame="top">
      <header className="cx-head"><Brand brand={d.brand} /><span className="cx-host">{host}</span>{logout}</header>
      <nav className="cx-tabs">{tabs}</nav>
      <main className="cx-main">{body}</main>
    </div>
  ) : (
    <div className="cx" data-look={look.look} data-frame="side">
      <aside className="cx-side"><Brand brand={d.brand} /><nav>{tabs}</nav>{logout}</aside>
      <main className="cx-main"><div className="cx-host">{host}</div>{body}</main>
    </div>
  );
}
