import { useState } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { tiersOf } from "../../../../../sim/10-catalog/licence-tiers";
import type { GameState } from "../../../../../sim/50-state";
import { alarmKey, clusterSummary, rulesOf } from "../../../../../sim/60-infra/alarms";
import { isOwnVm, type Cluster, type Drs, type Pool } from "../../../../../sim/60-infra/cluster";
import { EDITION_COST, editionAllows, editionOf, upgradeCost, type Feature } from "../../../../../sim/60-infra/vmwhere";
import { acknowledgeAlarm, applyRec, deletePool, resetAlarms, savePool, setAlarmRules, setDrs, setPool, upgradeEdition } from "../../../../../sim/90-actions/vmwhere";
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

const NUM = (v: string) => (v === "" ? null : Number(v));

// Cluster > Configure > Alarm Definitions and Monitor > Issues > Triggered Alarms.
export function AlarmsPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), r = rulesOf(c), sum = clusterSummary(game, c.id);
  const set = (k: keyof typeof r, v: string) => act(setAlarmRules, c.id, { ...r, [k]: Number(v) });
  const rows: [keyof typeof r, string][] = [["cpu", t("vw.alarm.cpu")], ["ram", t("vw.alarm.ram")], ["disk", t("vw.alarm.disk")]];
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("vw.alarm.name")}</th><th>{t("vw.alarm.threshold")}</th></tr></thead>
        <tbody>
          {rows.map(([k, label]) => <tr key={k}><td>{label}</td><td><input type="number" step="0.05" min="0.5" value={r[k]} onChange={(e) => set(k, e.target.value)} /></td></tr>)}
        </tbody>
      </table>
      <div className="cx-tools">
        <button className="cx-btn" disabled={!sum.alarms.length} onClick={() => act(acknowledgeAlarm, c.id)}>{t("vw.alarm.ackAll")}</button>
        <button className="cx-btn" disabled={!c.acks.length} onClick={() => act(resetAlarms, c.id)}>{t("vw.alarm.reset")}</button>
      </div>
      <table className="cx-table">
        <tbody>
          {sum.alarms.map((a) => <tr key={alarmKey(a)}><td>{t(a.key, a.params)}</td><td><button className="cx-btn" onClick={() => act(acknowledgeAlarm, c.id, alarmKey(a))}>{t("vw.alarm.ack")}</button></td></tr>)}
        </tbody>
      </table>
    </>
  );
}

// Resource pools under the cluster: limits, shares and which VMs belong to which pool.
export function PoolsPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState(""), [cpu, setCpu] = useState(""), [ram, setRam] = useState(""), [shares, setShares] = useState<Pool["shares"]>("normal");
  const vms = game.workloads.filter((w) => w.clusterId === c.id && isOwnVm(w));
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("vw.alarm.name")}</th><th>{t("vw.pool.cpuLimit")}</th><th>{t("vw.pool.ramLimit")}</th><th>{t("vw.pool.shares")}</th><th /></tr></thead>
        <tbody>
          {c.pools.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td className="num">{p.vcpuLimit ?? t("vw.pool.unlimited")}</td><td className="num">{p.ramLimitGb ?? t("vw.pool.unlimited")}</td><td>{t(`vw.pool.${p.shares}`)}</td>
              <td><button className="cx-btn" onClick={() => act(deletePool, c.id, p.id)}>{t("browser-consoles-2.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cx-tools">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t("vw.alarm.name")} placeholder={t("vw.alarm.name")} />
        <input type="number" min="1" value={cpu} onChange={(e) => setCpu(e.target.value)} aria-label={t("vw.pool.cpuLimit")} placeholder={t("vw.pool.cpuLimit")} />
        <input type="number" min="1" value={ram} onChange={(e) => setRam(e.target.value)} aria-label={t("vw.pool.ramLimit")} placeholder={t("vw.pool.ramLimit")} />
        <select value={shares} onChange={(e) => setShares(e.target.value as Pool["shares"])} aria-label={t("vw.pool.shares")}>{(["low", "normal", "high"] as const).map((x) => <option key={x} value={x}>{t(`vw.pool.${x}`)}</option>)}</select>
        <button className="cx-btn primary" onClick={() => act(savePool, c.id, { name, vcpuLimit: NUM(cpu), ramLimitGb: NUM(ram), shares })}>{t("bk.add")}</button>
      </div>
      <table className="cx-table">
        <tbody>
          {vms.map((w) => (
            <tr key={w.id}>
              <td>{w.hostname ?? w.id}</td>
              <td><select value={w.poolId ?? ""} onChange={(e) => act(setPool, w.id, e.target.value || null)} aria-label={t("vw.pool.pool")}>
                <option value="">{t("vw.pool.none")}</option>{c.pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
