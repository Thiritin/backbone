import type { ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import type { ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { panelTasks } from "../../../../sim/80-business/readouts";
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

// The shared pages a panel console appends to its own nav, in its own chrome.
export function useReadoutPages(game: GameState, c: Cluster, _f: ConsoleFeatures): ReadoutPage[] {
  return [{ id: "tasks", label: t("readouts.tasks"), body: <TaskPage game={game} c={c} /> }];
}
