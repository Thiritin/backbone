import { useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import type { ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { euroCents, euroPrice } from "../../../../sim/00-core/money";
import { softwareById } from "../../../../sim/10-catalog/platforms";
import { licensingAt } from "../../../../sim/10-catalog/server-os";
import { licenseCost } from "../../../../sim/85-products/products";
import { panelMachine } from "../../../../sim/60-infra/licence";
import { supportOn } from "../../../../sim/60-infra/lifecycle";
import { yearOf } from "../../../../sim/00-core/time";
import { LOG_SOURCES, logLines, panelTasks, type LogSource } from "../../../../sim/80-business/readouts";
import { LicenceTiers } from "./HostSettings";
import { assignedKey, installedVersion, isLicensed, licenceStatus, upgradeKeyBlock } from "../../../../sim/60-infra/licence";
import { machineOf } from "../../../../sim/60-infra/cluster";
import { upgradeOffers } from "../../../../sim/80-business/vendor-shop";
import { softwareTarget, upgradeSoftware } from "../../../../sim/90-actions/console";
import { activateLicence } from "../../../../sim/90-actions/licence";
import { useStore } from "../../../store";
import type { Tab } from "./PanelBase";

export interface ReadoutPage { id: Tab; label: string; body: ReactNode }

const TONE = { running: "accent", done: "ok", error: "bad" } as const;

export function TaskPage({ game, c }: { game: GameState; c: Cluster }) {
  const list = panelTasks(game, c);
  return (
    <table className="cx-readout">
      <thead><tr><th>{t("readouts.start")}</th><th>{t("readouts.finish")}</th><th>{t("readouts.task")}</th><th>{t("readouts.status")}</th></tr></thead>
      <tbody>
        {list.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("readouts.noTasks")}</td></tr>}
        {list.map((x) => (
          <tr key={x.key}>
            <td className="num">{x.start === null ? "" : formatClock(x.start)}</td>
            <td className="num">{formatClock(x.finish)}</td>
            <td>{t(`readouts.task.${x.text}`, x.params)}</td>
            <td><span className={`cx-state ${TONE[x.status]}`}>{t(`readouts.${x.status}`)}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const LOG_LIMIT = 60;

export function LogPage({ game, c, only }: { game: GameState; c: Cluster; only?: LogSource }) {
  const [pick, setSource] = useState<LogSource>("access"), source = only ?? pick;
  const list = logLines(game, c, source, LOG_LIMIT);
  return (
    <div className="cx-readout">
      {!only && <div className="cx-tools">{LOG_SOURCES.map((x) => <button key={x} className={`cx-btn ${x === source ? "primary" : ""}`} onClick={() => setSource(x)}>{t(`readouts.log.${x}`)}</button>)}</div>}
      <pre className="cx-log">{list.length === 0 ? t("readouts.noLines") : list.map((x) => `${formatClock(x.hour)} ${t(`readouts.line.${x.key}`, { ...x.params, ...(x.key === "system.device" ? { event: t(String(x.params.event)) } : {}) })}`).join("\n")}</pre>
    </div>
  );
}

export function LicencePage({ game, c }: { game: GameState; c: Cluster }) {
  const cost = licenseCost(game, c), year = yearOf(game.hour);
  const accounts = game.workloads.filter((w) => w.clusterId === c.id).length, machine = panelMachine(c);
  const rows = [{ id: c.panel, fee: cost.panel }, { id: c.platform, fee: cost.platform }].flatMap((x) => (x.id ? [{ sw: softwareById(x.id), fee: x.fee }] : []));
  return (
    <div className="cx-readout">
      <table>
        <thead><tr><th>{t("readouts.software")}</th><th>{t("readouts.kind")}</th><th>{t("readouts.countedOn")}</th><th>{t("readouts.monthly")}</th></tr></thead>
        <tbody>
          {rows.map(({ sw, fee }) => {
            const kind = licensingAt(sw, year).kind, support = machine ? supportOn(game, machine, sw.id) : "supported";
            return (
              <tr key={sw.id}>
                <td>{sw.name}{support !== "supported" && <> <strong className="cx-unsupported">{t(`software.support.${support}`)}</strong></>}</td>
                <td>{t(`readouts.kind.${kind}`)}</td>
                <td>{kind === "free" ? "" : t(kind === "account" || kind === "gameserver" ? `readouts.counted.${kind}` : "readouts.counted.server", { n: kind === "account" || kind === "gameserver" ? accounts : c.nodes.length || 1 })}</td>
                <td className="num">{kind === "free" ? "" : euroCents(fee)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <LicenceTiers game={game} c={c} />
      <KeyEntry game={game} c={c} />
      <UpgradeEntry game={game} c={c} />
    </div>
  );
}

// Steps the cluster's software up one major on its first machine with a newer major out, with the upgrade key it needs.
function UpgradeEntry({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), [key, setKey] = useState(""), [note, setNote] = useState("");
  const id = c.panel ?? c.platform, machines = c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId);
  if (!id) return null;
  const running = machines.map((m) => machineOf(game, m)?.software?.find((x) => x.id === id)).find((x) => x?.from && x.doneAt !== null && x.doneAt > game.hour);
  if (running) return <p role="status">{t("readouts.upgradingTo", { version: running.version })}</p>;
  const m = machines.find((x) => softwareTarget(game, x, id));
  if (!m) return null;
  const to = softwareTarget(game, m, id)!, needsKey = upgradeKeyBlock(game, m, id, to.version) !== null, held = assignedKey(game, m, id)?.covers;
  const offer = needsKey && held?.kind === "version" ? upgradeOffers(game, id).find((o) => o.from === held.major) : undefined;
  const licence = !isLicensed(id) ? t("readouts.kind.free") : needsKey ? t("readouts.keyNeeded") : t("readouts.covered");
  const run = () => { const r = act(upgradeSoftware, m, id, key.trim() || undefined); setNote(r.ok ? "" : t(r.error ?? "")); if (r.ok) setKey(""); };
  return (
    <>
      <table>
        <thead><tr><th>{t("readouts.version")}</th><th>{t("readouts.upgradeTo")}</th><th>{t("readouts.duration")}</th><th>{t("readouts.licence")}</th>{offer && <th>{t("readouts.upgradePrice")}</th>}</tr></thead>
        <tbody><tr>
          <td>{installedVersion(game, m, id)}</td><td>{to.version}</td><td className="num">{t("readouts.hours", { n: softwareById(id).installHours })}</td><td>{licence}</td>
          {offer && <td className="num">{euroPrice(offer.fee)}</td>}
        </tr></tbody>
      </table>
      <div className="cx-inline">
        {needsKey && (
          <label className="cx-field">{t("vendor-sites.licenceKey")}
            <input className="num" value={key} spellCheck={false} autoComplete="off" onChange={(e) => { setKey(e.target.value); setNote(""); }} />
          </label>
        )}
        <button className="cx-btn primary" disabled={needsKey && !key.trim()} onClick={run}>{t("readouts.upgrade")}</button>
        {note && <span role="alert">{note}</span>}
      </div>
    </>
  );
}

// Enters a key on the first machine of the cluster that is not licensed, or on its first machine to replace the key.
function KeyEntry({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), [key, setKey] = useState(""), [done, setDone] = useState(false);
  const id = c.panel ?? c.platform, machines = c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId);
  const m = id ? machines.find((x) => licenceStatus(game, x, id) !== "active") ?? machines[0] : undefined;
  if (!id || !m || !isLicensed(id)) return null;
  const activate = () => { const r = act(activateLicence, m, id, key); setDone(r.ok); if (r.ok) setKey(""); };
  return (
    <div className="cx-inline">
      <label className="cx-field">{t("vendor-sites.licenceKey")}
        <input className="num" value={key} spellCheck={false} autoComplete="off" onChange={(e) => { setKey(e.target.value); setDone(false); }} />
      </label>
      <button className="cx-btn primary" disabled={!key.trim()} onClick={activate}>{t("host.activate")}</button>
      {done && <span role="status">{t("host.activated")}</span>}
    </div>
  );
}

// The shared pages a panel console appends to its own nav, in its own chrome.
export function useReadoutPages(game: GameState, c: Cluster, _f: ConsoleFeatures): ReadoutPage[] {
  return [
    { id: "tasks", label: t("readouts.tasks"), body: <TaskPage game={game} c={c} /> },
    { id: "logs", label: t("readouts.logs"), body: <LogPage game={game} c={c} /> },
    { id: "licence", label: t("readouts.licence"), body: <LicencePage game={game} c={c} /> },
  ];
}
