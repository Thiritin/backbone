import { useState } from "react";
import { useT } from "../look";
import { LOCALE } from "../../../../../i18n/lang";
import type { GameState } from "../../../../../sim/50-state";
import { TTLS, type DnsType } from "../../../../../sim/60-infra/netsvc-dns";
import type { Webspace } from "../../../../../sim/60-infra/webspace";
import { CRON_PRESETS, cronLoad, scheduleOf, webZone, zoneNames } from "../../../../../sim/60-infra/webzone";
import { createCronJob, deleteWebRecord, saveWebRecord } from "../../../../../sim/90-actions/webdomains";
import { deleteCron } from "../../../../../sim/90-actions/webspace";
import { usePageAct } from "../../pageAct";
import { zoneChoices } from "../../../../../sim/60-infra/zone-choices";
import { ChoiceField } from "../../../../ChoiceField";

const TYPES: DnsType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

// Zone Editor: the records PowerDNZ shows for the domain. The early Simple DNS Zone Editor adds only A and CNAME records.
export function ZoneEditor({ game, ws, simple }: { game: GameState; ws: Webspace; simple: boolean }) {
  const t = useT();
  const act = usePageAct(), zones = zoneNames(ws), [zone, setZone] = useState(ws.domain);
  const [type, setType] = useState<DnsType>("A"), [name, setName] = useState(""), [ttl, setTtl] = useState(TTLS[1]), [data, setData] = useState("");
  const z = webZone(game, ws, zone), types = simple ? TYPES.slice(0, 1).concat("CNAME") : TYPES;
  const full = (n: string) => (n === "@" ? `${zone}.` : `${n}.${zone}.`);
  return (
    <>
      <div className="cx-tools">
        <select aria-label={t("cpd.domain")} value={zone} onChange={(e) => setZone(e.target.value)}>{zones.map((d) => <option key={d}>{d}</option>)}</select>
      </div>
      <form className="cx-inline" onSubmit={(e) => { e.preventDefault(); if (act(saveWebRecord, ws.workloadId, zone, { type, name, ttl, data }).ok) { setName(""); setData(""); } }}>
        <label className="cx-field"><span>{t("cpd.zone.name")}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        {!simple && <label className="cx-field"><span>{t("cpd.zone.ttl")}</span><select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>{TTLS.map((x) => <option key={x}>{x}</option>)}</select></label>}
        <label className="cx-field"><span>{t("cpd.zone.type")}</span><select value={type} onChange={(e) => setType(e.target.value as DnsType)}>{types.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="cx-field"><span>{simple ? t(type === "A" ? "cpd.zone.address" : "cpd.zone.cname") : t("cpd.zone.record")}</span><ChoiceField key={`${zone} ${type}`} value={data} choices={zoneChoices(game, zone, type, z.records)} onChange={setData} /></label>
        <button type="submit" className="cx-btn primary">{t(simple ? (type === "A" ? "cpd.zone.addA" : "cpd.zone.addCname") : "cpd.zone.add")}</button>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpd.zone.name")}</th><th>{t("cpd.zone.ttl")}</th><th>{t("cpd.zone.type")}</th><th>{t("cpd.zone.record")}</th><th /></tr></thead>
        <tbody>{z.records.map((r) => (
          <tr key={r.id}><td>{full(r.name)}</td><td className="num">{r.ttl}</td><td>{r.type}</td><td>{r.data}</td>
            <td><button className="cx-btn" onClick={() => act(deleteWebRecord, ws.workloadId, zone, r.id)}>{t("cpd.delete")}</button></td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

const pct = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 2 });

// Cron Jobs: the add form with its Common Settings list, and the current jobs with the share of a core each keeps busy.
export function CronJobs({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct(), [f, setF] = useState(["*", "*", "*", "*", "*"]), [cmd, setCmd] = useState("");
  const jobs = Object.values(ws.cron), heads = ["minute", "hour", "day", "month", "weekday"] as const;
  return (
    <>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); if (act(createCronJob, ws.workloadId, f.join(" "), cmd).ok) setCmd(""); }}>
        <label className="cx-field"><span>{t("cpd.cron.common")}</span>
          <select value="" onChange={(e) => e.target.value && setF(e.target.value.split(" "))}>
            <option value="">--</option>
            {CRON_PRESETS.map(([k, v]) => <option key={k} value={v}>{t(`cpd.cron.preset.${k}`)} ({v})</option>)}
          </select>
        </label>
        <div className="cx-inline">
          {heads.map((h, i) => <label key={h} className="cx-field"><span>{t(`cpd.cron.${h}`)}</span><input value={f[i]} onChange={(e) => setF(f.map((x, j) => (j === i ? e.target.value : x)))} /></label>)}
        </div>
        <label className="cx-field"><span>{t("cpd.cron.command")}</span><input value={cmd} onChange={(e) => setCmd(e.target.value)} /></label>
        <button type="submit" className="cx-btn primary">{t("cpd.cron.add")}</button>
      </form>
      <table className="cx-table">
        <thead><tr>{heads.map((h) => <th key={h}>{t(`cpd.cron.${h}`)}</th>)}<th>{t("cpd.cron.command")}</th><th>{t("cpd.cron.load")}</th><th /></tr></thead>
        <tbody>
          {jobs.length === 0 && <tr><td colSpan={8} className="cx-empty">{t("cpd.none")}</td></tr>}
          {jobs.map((j) => (
            <tr key={j.id}>
              {scheduleOf(j).split(" ").map((x, i) => <td key={i} className="num">{x}</td>)}
              <td>{j.command}</td><td className="num">{pct.format(cronLoad(j))}</td>
              <td><button className="cx-btn" onClick={() => act(deleteCron, ws.workloadId, j.id)}>{t("cpd.delete")}</button></td>
            </tr>
          ))}
          {jobs.length > 0 && <tr><td colSpan={6}>{t("cpd.cron.total")}</td><td className="num">{pct.format(jobs.reduce((a, j) => a + cronLoad(j), 0))}</td><td /></tr>}
        </tbody>
      </table>
    </>
  );
}
