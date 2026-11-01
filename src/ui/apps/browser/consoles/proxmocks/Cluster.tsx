import type { GameState } from "../../../../../sim/50-state";
import { serverTaken, type Cluster } from "../../../../../sim/60-infra/cluster";
import { qdeviceBlock, quorate, votes } from "../../../../../sim/60-infra/quorum";
import { setQdevice } from "../../../../../sim/90-actions/quorum";
import { t } from "../../../../../i18n/en";
import { nodeName } from "../HypervisorBase";
import { Facts } from "../PanelBase";
import { usePageAct } from "../../pageAct";

// Datacenter > Cluster: the Cluster Information box with the vote count and the QDevice.
export function ClusterInfo({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), v = votes(game, c);
  const free = game.devices.filter((d) => !serverTaken(game, d.id) && !qdeviceBlock(game, c, d.id));
  return (
    <section className="pmx-panel">
      <h4>{t("pmx.clusterInfo")}</h4>
      <Facts facts={[
        { label: t("pmx.quorate"), value: quorate(game, c) ? t("pmx.yes") : t("pmx.no") },
        { label: t("pmx.expectedVotes"), value: String(v.total), num: true },
        { label: t("pmx.totalVotes"), value: String(v.up), num: true },
        { label: t("pmx.qdevice"), value: c.qdevice ? nodeName(game, c.qdevice) : t("pmx.none") },
      ]} />
      <div className="cx-tools">
        {c.qdevice ? <button className="cx-btn" onClick={() => act(setQdevice, c.id, null)}>{t("pmx.removeQdevice")}</button>
          : free.map((d) => <button key={d.id} className="cx-chip" onClick={() => act(setQdevice, c.id, d.id)}>{t("pmx.addQdevice", { name: nodeName(game, d.id) })}</button>)}
      </div>
    </section>
  );
}
