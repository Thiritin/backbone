// economy.md, UPS: a managed UPS's web interface in the switch pages' frame, with its battery and the servers it shuts down.
import { useState } from "react";
import { t } from "../../../../i18n/en";
import { LOCALE } from "../../../../i18n/lang";
import { modelById } from "../../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../../sim/50-state";
import { upsMinutes } from "../../../../sim/60-infra/incidents";
import { addressOf } from "../../../../sim/60-infra/lan";
import { deviceWatts, linkStatus, locationOf } from "../../../../sim/60-infra/status";
import { shutdownBy } from "../../../../sim/60-infra/ups";
import { devName } from "../../hw";
import { lookOf, MgmtShell } from "./Switch";
import "../consoles/consoles.css";
import "./switch.css";

export const upsTitle = (d: Device): string => `${d.brand} ${devName(d)}`;

type Tab = "status" | "shutdown";
const num = (n: number) => Math.round(n).toLocaleString(LOCALE);

function Status({ game, d }: { game: GameState; d: Device }) {
  const loc = locationOf(game, d), here = game.devices.filter((x) => x.rackId && x.on && locationOf(game, x)?.id === loc?.id);
  const up = linkStatus(game, d.id).online;
  return (
    <dl className="sw-facts">
      <div><dt>{t("ups.model")}</dt><dd>{modelById(d.model).name}</dd></div>
      <div><dt>{t("ups.name")}</dt><dd>{devName(d)}</dd></div>
      <div><dt>{t("ups.address")}</dt><dd className="num"><span className={`cx-state ${up ? "ok" : ""}`}>{up ? t("switch.up") : t("switch.down")}</span> {addressOf(game, d.id)}</dd></div>
      <div><dt>{t("ups.battery")}</dt><dd className="num">{t("ups.wh", { n: num(modelById(d.model).batteryWh ?? 0) })}</dd></div>
      <div><dt>{t("ups.load")}</dt><dd className="num">{t("ups.watts", { n: num(here.reduce((n, x) => n + deviceWatts(x), 0)) })}</dd></div>
      <div><dt>{t("ups.runtime")}</dt><dd className="num">{t("ups.minutes", { n: num(loc ? upsMinutes(game, loc.id) : 0) })}</dd></div>
    </dl>
  );
}

function Shutdown({ game, d }: { game: GameState; d: Device }) {
  const loc = locationOf(game, d);
  const servers = game.devices.filter((x) => x.rackId && modelById(x.model).kind === "server" && locationOf(game, x)?.id === loc?.id);
  return (
    <table className="cx-table">
      <thead><tr><th>{t("ups.host")}</th><th>{t("ups.address")}</th><th>{t("ups.method")}</th></tr></thead>
      <tbody>
        {servers.map((x) => {
          const by = shutdownBy(game, x), up = linkStatus(game, x.id).online;
          return (
            <tr key={x.id}>
              <td>{devName(x)}</td>
              <td className="num"><span className={`cx-state ${up ? "ok" : ""}`}>{up ? t("switch.up") : t("switch.down")}</span> {addressOf(game, x.id)}</td>
              <td>{by === "agent" ? t("ups.agent") : by === "hypervisor" ? t("ups.hypervisor") : t("ups.none")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function UpsPage({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const [tab, setTab] = useState<Tab>("status");
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d) return null;
  const { look, frame } = lookOf(d);
  const tabs = [{ id: "status" as const, label: t("ups.status") }, { id: "shutdown" as const, label: t("ups.shutdown") }];
  return (
    <MgmtShell look={look} title={d.brand} model={modelById(d.model).name} host={host} frame={frame} tabs={tabs} tab={tab} setTab={setTab}>
      {tab === "status" && <Status game={game} d={d} />}
      {tab === "shutdown" && <Shutdown game={game} d={d} />}
    </MgmtShell>
  );
}
