import { useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import type { ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { euroCents } from "../../../../sim/00-core/money";
import { softwareById } from "../../../../sim/10-catalog/platforms";
import { licensingAt } from "../../../../sim/10-catalog/server-os";
import { licenseCost } from "../../../../sim/85-products/products";
import { yearOf } from "../../../../sim/00-core/time";
import { LOG_SOURCES, logLines, panelTasks, type LogSource } from "../../../../sim/80-business/readouts";
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

export function LogPage({ game, c }: { game: GameState; c: Cluster }) {
  const [source, setSource] = useState<LogSource>("access");
  const list = logLines(game, c, source, LOG_LIMIT);
  return (
    <div className="cx-readout">
      <div className="cx-tools">{LOG_SOURCES.map((x) => <button key={x} className={`cx-btn ${x === source ? "primary" : ""}`} onClick={() => setSource(x)}>{t(`readouts.log.${x}`)}</button>)}</div>
      <pre className="cx-log">{list.length === 0 ? t("readouts.noLines") : list.map((x) => `${formatClock(x.hour)} ${t(`readouts.line.${x.key}`, { ...x.params, ...(x.key === "system.device" ? { event: t(String(x.params.event)) } : {}) })}`).join("\n")}</pre>
    </div>
  );
}

// Tier, account cap and expiry belong here once the panel host sim provides them.
const LicenceExtra = (_: { c: Cluster }) => null;

export function LicencePage({ game, c }: { game: GameState; c: Cluster }) {
  const cost = licenseCost(game, c), year = yearOf(game.hour);
  const accounts = game.workloads.filter((w) => w.clusterId === c.id).length;
  const rows = [{ id: c.panel, fee: cost.panel }, { id: c.platform, fee: cost.platform }].flatMap((x) => (x.id ? [{ sw: softwareById(x.id), fee: x.fee }] : []));
  return (
    <div className="cx-readout">
      <table>
        <thead><tr><th>{t("readouts.software")}</th><th>{t("readouts.kind")}</th><th>{t("readouts.countedOn")}</th><th>{t("readouts.monthly")}</th></tr></thead>
        <tbody>
          {rows.map(({ sw, fee }) => {
            const kind = licensingAt(sw, year).kind;
            return (
              <tr key={sw.id}>
                <td>{sw.name}</td>
                <td>{t(`readouts.kind.${kind}`)}</td>
                <td>{kind === "free" ? "" : t(kind === "account" ? "readouts.counted.account" : "readouts.counted.server", { n: kind === "account" ? accounts : c.nodes.length || 1 })}</td>
                <td className="num">{kind === "free" ? "" : euroCents(fee)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <LicenceExtra c={c} />
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
