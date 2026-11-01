import { euro } from "../../../../../sim/00-core/money";
import { tiersOf } from "../../../../../sim/10-catalog/licence-tiers";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster, Drs } from "../../../../../sim/60-infra/cluster";
import { EDITION_COST, editionAllows, editionOf, upgradeCost, type Feature } from "../../../../../sim/60-infra/vmwhere";
import { applyRec, setDrs, upgradeEdition } from "../../../../../sim/90-actions/vmwhere";
import { t } from "../../../../../i18n/en";
import { nodeName } from "../HypervisorBase";
import { useStore } from "../../../../store";

const FEATURES: Feature[] = ["failover", "alarms", "drs", "pools"];

// Administration > Licensing: the editions of the cluster, what each unlocks and the upgrade button.
export function Licensing({ c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), now = editionOf(c);
  return (
    <>
      <table className="cx-table">
        <tbody>
          <tr><th>{t("vw.edition")}</th><td>{tiersOf("vmwhere").find((x) => x.id === now)?.name}</td></tr>
          <tr><th>{t("vw.expiration")}</th><td>{t("vw.never")}</td></tr>
        </tbody>
      </table>
      <table className="cx-table">
        <thead><tr><th>{t("vw.edition")}</th>{FEATURES.map((f) => <th key={f}>{t(`vw.feature.${f}`)}</th>)}<th /></tr></thead>
        <tbody>
          {tiersOf("vmwhere").map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              {FEATURES.map((f) => <td key={f}>{editionAllows({ ...c, licence: { tier: x.id, trialUntil: null, lapsedAt: null } }, f) ? "✓" : ""}</td>)}
              <td>{x.id === now ? t("vw.current") : EDITION_COST[x.id] > EDITION_COST[now] && <button className="cx-btn" onClick={() => act(upgradeEdition, c.id, x.id)}>{t("vw.upgrade", { price: euro(upgradeCost(c, x.id)) })}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const MODES: Drs[] = ["off", "manual", "partial", "full"];

// Cluster > Configure > vSphere DRS and Monitor > DRS > Recommendations.
export function DrsPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act);
  return (
    <>
      <div className="cx-tools">
        {MODES.map((m) => <label key={m} className="cx-check"><input type="radio" name="drs" checked={c.drs === m} onChange={() => act(setDrs, c.id, m)} />{t(`vw.drs.${m}`)}</label>)}
      </div>
      <table className="cx-table">
        <thead><tr><th>{t("vw.vm")}</th><th>{t("vw.toHost")}</th><th /></tr></thead>
        <tbody>
          {c.recs.map((r) => (
            <tr key={r.workloadId}>
              <td>{game.workloads.find((w) => w.id === r.workloadId)?.hostname ?? r.workloadId}</td><td>{nodeName(game, r.to)}</td>
              <td><button className="cx-btn" onClick={() => act(applyRec, c.id, r.workloadId)}>{t("vw.apply")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
