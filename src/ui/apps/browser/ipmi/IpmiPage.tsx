import { LogOut, Monitor, Server } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BMC_NAME } from "../../../../sim/10-catalog/hardware";
import { t } from "../../../../i18n/en";
import type { Device, GameState, RebuildRate } from "../../../../sim/50-state";
import { drivesOf, raidUsable } from "../../../../sim/60-infra/status";
import { rebuildHours } from "../../../../sim/88-tick/tick";
import { mountVirtualMedia, mountableImages } from "../../../../sim/90-actions/media";
import { isoName } from "../consoles/HypervisorBase";
import { setRebuildRate } from "../../../../sim/90-actions/hardware";
import { consoleName } from "../../console/ConsoleWindow";
import { sensorRows } from "../../../../sim/80-business/readouts";
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

type Tab = "power" | "storage" | "sensors" | "media" | "log";
const TABS: [Tab, string][] = [["power", t("misc1.ipmi.power")], ["storage", t("misc1.ipmi.storage")], ["sensors", t("misc1.ipmi.sensors")], ["media", t("readouts.media.title")], ["log", t("misc1.ipmi.eventLog")]];
const RATES: [RebuildRate, string][] = [["low", t("misc1.ipmi.low")], ["medium", t("misc1.ipmi.medium")], ["high", t("misc1.ipmi.high")]];

// The array as the BIOS set it up, with the rebuild rate the controller can change while the server runs.
function StorageTab({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act);
  const rb = d.rebuild, done = rb ? Math.max(0, Math.min(1, 1 - (rb.doneAt - game.hour) / rebuildHours(d))) : 0;
  return (
    <>
      <dl className="bmc-facts">
        <div><dt>{t("misc1.ipmi.raidLevel")}</dt><dd>{d.raid === "none" ? t("misc1.ipmi.none") : `RAID ${d.raid}`}</dd></div>
        <div><dt>{t("misc1.ipmi.drives")}</dt><dd className="num">{drivesOf(d).length}</dd></div>
        <div><dt>{t("misc1.ipmi.usable")}</dt><dd className="num">{raidUsable(d)} GB</dd></div>
        {rb && <div><dt>{t("misc1.ipmi.rebuild")}</dt><dd className="num">{Math.floor(done * 100)}%</dd></div>}
      </dl>
      <div className="bmc-actions">
        {RATES.map(([v, l]) => <button key={v} className={`cx-btn${d.rebuildRate === v ? " primary" : ""}`} aria-pressed={d.rebuildRate === v} onClick={() => act(setRebuildRate, d.id, v)}>{t("misc1.ipmi.rebuildRate", { rate: l })}</button>)}
      </div>
    </>
  );
}
const SIGN_IN: Record<BmcLook, string> = { idraq: t("misc1.ipmi.logIn"), ilol: t("misc1.ipmi.signIn"), ipmi: t("misc1.ipmi.login"), xclarify: t("misc1.ipmi.connect") };

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
  const state = !d.on ? t("misc1.ipmi.off") : booting(game, d) ? t("misc1.ipmi.booting") : halting(d) ? t("misc1.ipmi.shuttingDown") : t("misc1.ipmi.on");
  return (
    <>
      <dl className="bmc-facts">
        <div><dt>{t("misc1.ipmi.server")}</dt><dd>{d.hostname ?? d.label ?? d.name}</dd></div>
        <div><dt>{t("misc1.ipmi.power")}</dt><dd className={`bmc-state ${d.on ? "on" : "off"}`}>{state}</dd></div>
      </dl>
      <div className="bmc-actions">
        <button className="cx-btn primary" disabled={d.on} onClick={() => act(setPower, d.id, true)}>{t("misc1.ipmi.powerOn")}</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(shutdown, d.id)}>{t("misc1.ipmi.gracefulShutdown")}</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(reset, d.id)}>{t("misc1.ipmi.reset")}</button>
        <button className="cx-btn" disabled={!d.on} onClick={() => act(powerCycle, d.id)}>{t("misc1.ipmi.powerCycle")}</button>
      </div>
    </>
  );
}

const PSU_STATE = { ok: t("misc1.ipmi.ok"), failed: t("misc1.ipmi.failed"), unplugged: t("misc1.ipmi.noInput") } as const;

const UNIT = { inlet: " °C", fan: " RPM", power: " W", load: " %", psu: "" } as const;

function SensorsTab({ game, d }: { game: GameState; d: Device }) {
  return (
    <table className="bmc-table">
      <thead><tr><th>{t("misc1.ipmi.sensor")}</th><th>{t("misc1.ipmi.reading")}</th><th>{t("readouts.sensor.status")}</th><th>{t("readouts.sensor.lower")}</th><th>{t("readouts.sensor.upper")}</th></tr></thead>
      <tbody>
        {sensorRows(game, d).map((r) => (
          <tr key={`${r.kind}${r.n}`} data-status={r.status}>
            <td>{t(`readouts.sensor.${r.kind}`, { n: r.n })}</td>
            <td className="num">{r.psu ? PSU_STATE[r.psu] : `${r.kind === "inlet" ? r.value!.toFixed(1) : r.value}${UNIT[r.kind]}`}</td>
            <td>{t(`readouts.sensor.${r.status}`)}</td>
            <td className="num">{r.lower === null ? "" : `${r.lower}${UNIT[r.kind]}`}</td>
            <td className="num">{r.upper === null ? "" : `${r.upper}${UNIT[r.kind]}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The images the controller can present to the server as a virtual drive.
function MediaTab({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act), images = mountableImages(game);
  return (
    <table className="bmc-table">
      <thead><tr><th>{t("readouts.media.image")}</th><th>{t("misc1.ipmi.reading")}</th><th /></tr></thead>
      <tbody>
        {images.length === 0 && <tr><td colSpan={3} className="bmc-empty">{t("readouts.media.none")}</td></tr>}
        {images.map((im) => {
          const mounted = d.virtualMedia === im;
          return (
            <tr key={im}>
              <td>{isoName(im)}</td><td>{mounted ? t("readouts.media.mounted") : ""}</td>
              <td><button className="cx-btn" onClick={() => act(mountVirtualMedia, d.id, mounted ? null : im)}>{mounted ? t("readouts.media.eject") : t("readouts.media.mount")}</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LogTab({ d }: { d: Device }) {
  return (
    <table className="bmc-table">
      <thead><tr><th>{t("misc1.ipmi.time")}</th><th>{t("misc1.ipmi.event")}</th></tr></thead>
      <tbody>
        {[...d.log].reverse().map((e, i) => <tr key={i}><td className="num">{stamp(e.hour)}</td><td>{t(e.key)}</td></tr>)}
        {!d.log.length && <tr><td colSpan={2} className="bmc-empty">{t("misc1.ipmi.noEntries")}</td></tr>}
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
        <label className="cx-field">{t("misc1.ipmi.username")}<input defaultValue="root" autoComplete="off" /></label>
        <label className="cx-field">{t("misc1.ipmi.password")}<input type="password" defaultValue="calvin" autoComplete="off" /></label>
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
  const body: ReactNode = tab === "power" ? <PowerTab game={game} d={d} /> : tab === "storage" ? <StorageTab game={game} d={d} /> : tab === "sensors" ? <SensorsTab game={game} d={d} /> : tab === "media" ? <MediaTab game={game} d={d} /> : <LogTab d={d} />;
  const tabs = TABS.map(([id, label]) => <button key={id} className="cx-tab" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>);
  const logout = <>
    <button className="cx-btn ghost" onClick={() => openConsole(d.id)}><Monitor aria-hidden />{consoleName(game, d).replace(/^\S+ /, "")}</button>
    <button className="cx-btn ghost" onClick={() => setLogins(logins.filter((x) => x !== key))}><LogOut aria-hidden />{t("misc1.ipmi.logOut")}</button>
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
