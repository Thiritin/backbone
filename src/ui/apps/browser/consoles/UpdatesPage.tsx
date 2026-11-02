import { t } from "../../../../i18n/en";
import { formatClock, yearOf } from "../../../../sim/00-core/time";
import { autoUpdates, softwareById } from "../../../../sim/10-catalog/platforms";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { installedVersion, panelMachine } from "../../../../sim/60-infra/licence";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { setAutoUpdate, updateDue, updateSoftware } from "../../../../sim/90-actions/software";
import { usePageAct } from "../pageAct";
import { ChannelPicker } from "./HostSettings";
import { Actions, Facts } from "./PanelBase";

// Whether the web panel updates itself from its own Updates page in this year; without it the player updates from the shell.
export const hasUpdates = (game: GameState, c: Cluster): boolean => {
  const family = familyOf(c);
  return c.kind === "panel" && !!family && autoUpdates(softwareById(family), yearOf(game.hour));
};

// A web panel's Updates page: the installed version, the release channel, automatic updates and the update due now.
export function UpdatesPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), year = yearOf(game.hour), due = updateDue(game, c), on = !!c.autoUpdate;
  const version = installedVersion(game, panelMachine(c) ?? "", familyOf(c)!) ?? String(c.version);
  return (
    <>
      <Facts facts={[
        { label: t("browser-consoles-2.version"), value: version, num: true },
        { label: t("panel-updates.lastUpdate"), value: formatClock(c.updatedAt), num: true },
      ]} />
      <ChannelPicker c={c} />
      <label className="cx-tools">
        <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => act(setAutoUpdate, c.id, e.target.checked)} />
        {t("browser-consoles-2.autoUpdates")}
      </label>
      <Actions actions={due ? [{ id: "update", label: t("browser-consoles-2.updateTo", { year }), run: () => act(updateSoftware, c.id), tone: "primary" }] : []}>
        {!due && <span className="cx-note">{t("browser-consoles-2.upToDate")}</span>}
      </Actions>
    </>
  );
}
