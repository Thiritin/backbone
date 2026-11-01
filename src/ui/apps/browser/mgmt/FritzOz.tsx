import { LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { modelById } from "../../../../sim/10-catalog/hardware";
import type { Device, GameState, PortShare } from "../../../../sim/50-state";
import { sharedAddress } from "../../../../sim/60-infra/addresses";
import { DESK_NAME, holderOf, lanOf, leasesOf, routerPassword } from "../../../../sim/60-infra/lan";
import { linkStatus } from "../../../../sim/60-infra/status";
import { dropPortShare, reserveAddress, setPortShare, setRouterLan, viewDevices } from "../../../../sim/90-actions/lan";
import { useSessionState } from "../../../session";
import "../consoles/consoles.css";
import "../ipmi/ipmi.css";
import { usePageAct } from "../pageAct";

// Fritz!OZ, the web interface of the basement's Fritz!Bocks (docs/design/lan.md, Management interfaces in the Browser).
type Page = "overview" | "devices" | "ipv4" | "shares" | "firmware";
const FIRMWARE: Record<string, string> = { "home-router": "04.29", "fb-7050": "04.80", "fb-7390": "06.20", "fb-7590": "07.29", "fb-5690": "08.00" };

function Login({ game, d, host, onLogin }: { game: GameState; d: Device; host: string; onLogin: () => void }) {
  const [pass, setPass] = useState(""), [wrong, setWrong] = useState(false);
  const submit = () => (pass === routerPassword(game, d.id) ? onLogin() : setWrong(true));
  return (
    <div className="cx cx-login" data-look="fritz">
      <form className="cx-card" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="cx-brand">Fritz!OZ</div>
        <div className="cx-host">{modelById(d.model).name} · {host}</div>
        <label className="cx-field">{t("misc1.ipmi.password")}<input type="password" value={pass} autoComplete="off" onChange={(e) => { setPass(e.target.value); setWrong(false); }} /></label>
        {wrong && <div className="cx-note" role="alert">{t("browser-consoles-2.fritz.wrongPassword")}</div>}
        <button className="cx-btn primary" type="submit">{t("browser-consoles-2.fritz.logIn")}</button>
      </form>
    </div>
  );
}

const kindLabel = (k: PortShare["kind"]) => t(k === "web" ? "browser-consoles-2.fritz.web" : "browser-consoles-2.fritz.exposed");
const nameOf = (name: string) => (name === DESK_NAME ? t("browser-consoles-2.fritz.desk") : name);

function Overview({ game, d }: { game: GameState; d: Device }) {
  const online = linkStatus(game, d.id).online, active = leasesOf(game, d.id).filter((l) => l.active).length;
  return (
    <table className="cx-table"><tbody>
      <tr><th>{t("browser-consoles-2.fritz.model")}</th><td>{modelById(d.model).name}</td></tr>
      <tr><th>{t("browser-consoles-2.fritz.internet")}</th><td>{t(online ? "browser-consoles-2.fritz.connected" : "browser-consoles-2.fritz.notConnected")}</td></tr>
      <tr><th>{t("browser-consoles-2.fritz.publicIp")}</th><td className="num">{(online && sharedAddress(game)?.ip) || "-"}</td></tr>
      <tr><th>{t("browser-consoles-2.fritz.activeDevices")}</th><td className="num">{active}</td></tr>
    </tbody></table>
  );
}

function Devices({ game, d }: { game: GameState; d: Device }) {
  const act = usePageAct(), lan = lanOf(game, d)!;
  useEffect(() => { act(viewDevices, d.id); }, [act, d.id]);
  return (
    <table className="cx-table">
      <thead><tr><th>{t("browser-consoles-2.fritz.name")}</th><th>{t("browser-consoles-2.fritz.ipAddress")}</th><th>{t("browser-consoles-2.fritz.mac")}</th><th>{t("browser-consoles-2.fritz.fixed")}</th></tr></thead>
      <tbody>{leasesOf(game, d.id).map((l) => (
        <tr key={l.mac} className={l.active ? undefined : "cx-note"}>
          <td>{nameOf(l.name)}{!l.active && ` · ${t("browser-consoles-2.fritz.inactive")}`}</td><td className="num">{l.ip}</td><td className="num">{l.mac}</td>
          <td><input type="checkbox" aria-label={t("browser-consoles-2.fritz.fixed")} checked={lan.reservations.some((r) => r.mac === l.mac)} onChange={(e) => act(reserveAddress, d.id, l.mac, e.target.checked)} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function Ipv4({ game, d }: { game: GameState; d: Device }) {
  const act = usePageAct(), lan = lanOf(game, d)!, last = (ip: string) => ip.split(".")[3];
  const [gw, setGw] = useState(lan.gateway), [from, setFrom] = useState(last(lan.pool[0])), [to, setTo] = useState(last(lan.pool[1]));
  return (
    <form className="cx-card" onSubmit={(e) => { e.preventDefault(); act(setRouterLan, d.id, gw.trim(), Number(from), Number(to)); }}>
      <label className="cx-field">{t("browser-consoles-2.fritz.ipAddress")}<input className="num" value={gw} onChange={(e) => setGw(e.target.value)} /></label>
      <label className="cx-field">{t("browser-consoles-2.fritz.subnet")}<input className="num" value="255.255.255.0" readOnly /></label>
      <label className="cx-field">{t("browser-consoles-2.fritz.dhcpFrom")}<input className="num" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="cx-field">{t("browser-consoles-2.fritz.dhcpTo")}<input className="num" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label className="cx-field">{t("browser-consoles-2.fritz.leaseTime")}<input className="num" value={t("browser-consoles-2.fritz.hours", { n: lan.leaseHours })} readOnly /></label>
      <button className="cx-btn primary" type="submit">{t("browser-consoles-2.fritz.apply")}</button>
    </form>
  );
}

function Shares({ game, d }: { game: GameState; d: Device }) {
  const act = usePageAct(), lan = lanOf(game, d)!;
  const hosts = leasesOf(game, d.id).filter((l) => l.active && l.deviceId && l.iface === "eth");
  const [target, setTarget] = useState(hosts[0]?.deviceId ?? ""), [kind, setKind] = useState<PortShare["kind"]>("web");
  const holder = (ip: string) => { const h = holderOf(game, ip); return h && game.devices.find((x) => x.id === h.deviceId); };
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-2.fritz.device")}</th><th>{t("browser-consoles-2.fritz.ipAddress")}</th><th>{t("browser-consoles-2.fritz.share")}</th><th>{t("browser-consoles-2.fritz.ports")}</th><th /></tr></thead>
        <tbody>
          {lan.shares.map((x) => { const h = holder(x.ip); return (
            <tr key={x.ip}>
              <td>{h ? h.hostname ?? h.name : "-"}</td><td className="num">{x.ip}</td><td>{kindLabel(x.kind)}</td>
              <td className="num">{x.kind === "web" ? "TCP 80, 443" : t("browser-consoles-2.fritz.all")}</td>
              <td><button className="cx-btn" onClick={() => act(dropPortShare, d.id, x.ip)}>{t("browser-consoles-2.fritz.remove")}</button></td>
            </tr>
          ); })}
          {!lan.shares.length && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-2.fritz.noShares")}</td></tr>}
        </tbody>
      </table>
      <form className="cx-tools" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (target) act(setPortShare, d.id, target, kind); }}>
        <label className="cx-field">{t("browser-consoles-2.fritz.device")}
          <select value={target} onChange={(e) => setTarget(e.target.value)}>{hosts.map((h) => <option key={h.mac} value={h.deviceId!}>{h.name} ({h.ip})</option>)}</select>
        </label>
        <label className="cx-field">{t("browser-consoles-2.fritz.share")}
          <select value={kind} onChange={(e) => setKind(e.target.value as PortShare["kind"])}>{(["web", "exposed"] as const).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
        </label>
        <button className="cx-btn primary" type="submit" disabled={!target}>{t("browser-consoles-2.fritz.add")}</button>
      </form>
    </>
  );
}

function Firmware({ d }: { d: Device }) {
  return (
    <table className="cx-table"><tbody>
      <tr><th>{t("browser-consoles-2.fritz.model")}</th><td>{modelById(d.model).name}</td></tr>
      <tr><th>{t("browser-consoles-2.fritz.version")}</th><td className="num">Fritz!OZ {FIRMWARE[d.model] ?? "04.29"}</td></tr>
      <tr><th>{t("browser-consoles-2.fritz.firmware")}</th><td>{t("browser-consoles-2.fritz.upToDate")}</td></tr>
    </tbody></table>
  );
}

export function FritzOz({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const [logins, setLogins] = useSessionState<string[]>("browser.logins", []);
  const [page, setPage] = useState<Page>("overview");
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d || !lanOf(game, d)) return null;
  const key = `fritz:${d.id}`;
  if (!logins.includes(key)) return <Login game={game} d={d} host={host} onLogin={() => setLogins([...logins, key])} />;
  const nav: [string, [Page, string][]][] = [
    ["", [["overview", t("browser-consoles-2.fritz.overview")]]],
    [t("browser-consoles-2.fritz.homeNetwork"), [["devices", t("browser-consoles-2.fritz.devices")], ["ipv4", t("browser-consoles-2.fritz.ipv4")]]],
    [t("browser-consoles-2.fritz.internet"), [["shares", t("browser-consoles-2.fritz.permitAccess")]]],
    [t("browser-consoles-2.fritz.system"), [["firmware", t("browser-consoles-2.fritz.firmware")]]],
  ];
  const body: ReactNode = page === "overview" ? <Overview game={game} d={d} /> : page === "devices" ? <Devices game={game} d={d} />
    : page === "ipv4" ? <Ipv4 game={game} d={d} /> : page === "shares" ? <Shares game={game} d={d} /> : <Firmware d={d} />;
  return (
    <div className="cx" data-look="fritz" data-frame="side">
      <aside className="cx-side">
        <div className="cx-brand">Fritz!OZ</div>
        <nav>{nav.map(([group, items]) => (
          <div key={group || "top"}>
            {group && <div className="cx-cap">{group}</div>}
            {items.map(([id, label]) => <button key={id} className="cx-tab" aria-pressed={page === id} onClick={() => setPage(id)}>{label}</button>)}
          </div>
        ))}</nav>
        <button className="cx-btn ghost" onClick={() => setLogins(logins.filter((x) => x !== key))}><LogOut aria-hidden />{t("misc1.ipmi.logOut")}</button>
      </aside>
      <main className="cx-main"><div className="cx-host">{host}</div>{body}</main>
    </div>
  );
}
