// docs/design/lan.md, Management interfaces in the Browser: an own router's web interface in the switch pages' frame,
// themed per maker as WebFigg and J-Webb.
import { useState } from "react";
import { t } from "../../../../i18n/en";
import { modelById } from "../../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../../sim/50-state";
import { addressOf, freeAddresses, lanOf, leasesOf } from "../../../../sim/60-infra/lan";
import { linkStatus } from "../../../../sim/60-infra/status";
import { setOwnRouterLan, setRemoteAccess } from "../../../../sim/90-actions/routers";
import { useStore } from "../../../store";
import { devName } from "../../hw";
import { MgmtShell } from "./Switch";
import "../consoles/consoles.css";
import "./switch.css";

const LOOKS: Record<string, { look: string; title: string; frame: "side" | "top" }> = {
  MicroTick: { look: "webfigg", title: "WebFigg", frame: "side" },
  Junipurr: { look: "jwebb", title: "J-Webb", frame: "top" },
};
const lookOf = (d: Device) => LOOKS[d.brand] ?? { look: "plain", title: modelById(d.model).name, frame: "top" as const };
export const routerTitle = (d: Device): string => `${lookOf(d).title} ${devName(d)}`;

type Tab = "system" | "dhcp" | "vpn";

function System({ game, d }: { game: GameState; d: Device }) {
  const up = linkStatus(game, d.id).online;
  return (
    <dl className="sw-facts">
      <div><dt>{t("router.model")}</dt><dd>{modelById(d.model).name}</dd></div>
      <div><dt>{t("router.name")}</dt><dd>{devName(d)}</dd></div>
      <div><dt>{t("router.uplink")}</dt><dd className="num"><span className={`cx-state ${up ? "ok" : ""}`}>{up ? t("switch.up") : t("switch.down")}</span> {addressOf(game, d.id)}</dd></div>
      <div><dt>{t("router.address")}</dt><dd className="num">{`${lanOf(game, d)!.gateway}/${lanOf(game, d)!.cidr.split("/")[1]}`}</dd></div>
      {d.fw && <div><dt>{t("router.firmware")}</dt><dd className="num">{d.fw.version}</dd></div>}
    </dl>
  );
}

function Dhcp({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act), lan = lanOf(game, d)!;
  const [gateway, setGateway] = useState(lan.gateway), [prefix, setPrefix] = useState(lan.cidr.split("/")[1]);
  const [from, setFrom] = useState(lan.pool[0]), [to, setTo] = useState(lan.pool[1]);
  const field = (label: string, value: string, set: (v: string) => void) => <label>{label} <input className="num" value={value} onChange={(e) => set(e.target.value)} /></label>;
  return (
    <>
      <form className="cx-tools" onSubmit={(e) => { e.preventDefault(); act(setOwnRouterLan, d.id, gateway, Number(prefix), from, to); }}>
        {field(t("router.address"), gateway, setGateway)}
        {field(t("router.prefix"), prefix, setPrefix)}
        {field(t("router.poolFrom"), from, setFrom)}
        {field(t("router.poolTo"), to, setTo)}
        <button className="cx-btn primary">{t("switch.apply")}</button>
      </form>
      <dl className="sw-facts" style={{ marginTop: 12 }}>
        <div><dt>{t("router.network")}</dt><dd className="num">{lan.cidr}</dd></div>
        <div><dt>{t("router.free")}</dt><dd className="num">{freeAddresses(game, d.id)}</dd></div>
      </dl>
      <h3 className="cx-h">{t("router.leases")}</h3>
      <table className="cx-table">
        <thead><tr><th>{t("router.host")}</th><th>{t("router.mac")}</th><th>{t("router.ip")}</th></tr></thead>
        <tbody>{leasesOf(game, d.id).map((l) => <tr key={l.mac}><td>{l.name}</td><td className="num">{l.mac}</td><td className="num">{l.ip}</td></tr>)}</tbody>
      </table>
    </>
  );
}

function Vpn({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act), on = !!lanOf(game, d)!.vpn;
  return (
    <div className="cx-tools">
      <span>{t("router.vpnServer")}</span>
      <span className={`cx-state ${on ? "ok" : ""}`}>{on ? t("router.enabled") : t("router.disabled")}</span>
      <button className="cx-btn primary" onClick={() => act(setRemoteAccess, d.id, !on)}>{on ? t("router.disable") : t("router.enable")}</button>
    </div>
  );
}

export function RouterPage({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const [tab, setTab] = useState<Tab>("system");
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d) return null;
  const { look, title, frame } = lookOf(d);
  const tabs = [{ id: "system" as const, label: t("router.system") }, { id: "dhcp" as const, label: t("router.dhcp") }, { id: "vpn" as const, label: t("router.vpn") }];
  return (
    <MgmtShell look={look} title={title} model={modelById(d.model).name} host={host} frame={frame} tabs={tabs} tab={tab} setTab={setTab}>
      {tab === "system" && <System game={game} d={d} />}
      {tab === "dhcp" && <Dhcp key={JSON.stringify(lanOf(game, d)!.pool)} game={game} d={d} />}
      {tab === "vpn" && <Vpn game={game} d={d} />}
    </MgmtShell>
  );
}
