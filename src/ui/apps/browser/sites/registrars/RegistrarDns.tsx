import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { nowHours, yearOf } from "../../../../../sim/00-core/time";
import type { Registrar } from "../../../../../sim/10-catalog/registrars";
import { settled, zoneRecords, type CompanyRecord } from "../../../../../sim/60-infra/company-zone";
import { TTLS, type DnsType } from "../../../../../sim/60-infra/netsvc-dns";
import type { GameState } from "../../../../../sim/50-state";
import { removeCompanyRecord, setCompanyRecord } from "../../../../../sim/90-actions/domains";
import { eraOf } from "../era";
import { usePageAct } from "../../pageAct";
import { REGISTRAR_ERAS } from "./RegistrarPage";

const TYPES: DnsType[] = ["A", "AAAA", "CNAME", "MX", "TXT"];
interface Draft { id?: string; type: DnsType; name: string; value: string; priority: string; ttl: number }
const blank: Draft = { type: "A", name: "@", value: "", priority: "10", ttl: 3600 };

// An MX record keeps its priority in front of the host.
const split = (r: CompanyRecord): [string, string] => (r.type === "MX" ? [r.data.split(" ")[0], r.data.split(" ").slice(1).join(" ")] : ["", r.data]);
const draftOf = (r: CompanyRecord): Draft => { const [priority, value] = split(r); return { id: r.id, type: r.type, name: r.name, value, priority: priority || "10", ttl: r.ttl }; };

// The DNS page for the company domain: its records with Edit and Delete and a form to add or change one, titled as the partner named it.
export function RegistrarDns({ game, r }: { game: GameState; r: Registrar }) {
  const act = usePageAct(), [draft, setDraft] = useState<Draft | null>(null), hour = nowHours(game);
  const look = eraOf(REGISTRAR_ERAS[r.id], yearOf(game.hour)), domain = game.company.domain;
  const save = (d: Draft) => {
    const res = act(setCompanyRecord, { id: d.id, type: d.type, name: d.name, ttl: d.ttl, data: d.type === "MX" ? `${d.priority.trim()} ${d.value.trim()}` : d.value });
    if (res.ok) setDraft(null);
  };
  return (
    <section className="bks-box">
      <h2>{t(`registrarDns.title.${r.id}.${look}`)}{domain && `: ${domain}`}</h2>
      {domain && (
        <>
          <table className="bks-table bks-rows">
            <thead>
              <tr>
                <th>{t("browser-consoles-2.type")}</th><th>{t("registrarDns.host")}</th><th>{t("registrarDns.pointsTo")}</th><th>{t("registrarDns.priority")}</th>
                <th>{t("netsvc.ttl")}</th><th>{t("registrarPanel.status")}</th><th />
              </tr>
            </thead>
            <tbody>
              {zoneRecords(game).map((x) => {
                const [priority, value] = split(x);
                return (
                  <tr key={x.id}>
                    <td>{x.type}</td><td>{x.name}</td><td className="num">{value}</td><td className="num">{priority}</td>
                    <td>{t(`registrarDns.ttl.${x.ttl}`)}</td><td>{t(settled(x, hour) ? "registrarPanel.status.active" : "registrarDns.pending")}</td>
                    <td className="r">
                      <button className="bks-btn" onClick={() => setDraft(draftOf(x))}>{t("netsvc.edit")}</button>{" "}
                      <button className="bks-btn" onClick={() => act(removeCompanyRecord, x.id)}>{t("netsvc.delete")}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {draft ? (
            <form className="bks-form" onSubmit={(e) => { e.preventDefault(); save(draft); }}>
              <label>{t("browser-consoles-2.type")}<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DnsType })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>{t("registrarDns.host")}<input spellCheck={false} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label>{t("registrarDns.pointsTo")}<input spellCheck={false} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
              {draft.type === "MX" && <label>{t("registrarDns.priority")}<input inputMode="numeric" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} /></label>}
              <label>{t("netsvc.ttl")}<select value={draft.ttl} onChange={(e) => setDraft({ ...draft, ttl: Number(e.target.value) })}>{TTLS.map((x) => <option key={x} value={x}>{t(`registrarDns.ttl.${x}`)}</option>)}</select></label>
              <div className="bks-row"><button className="bks-btn primary" type="submit">{t("netsvc.save")}</button> <button className="bks-btn" type="button" onClick={() => setDraft(null)}>{t("netsvc.cancel")}</button></div>
            </form>
          ) : <p><button className="bks-btn" onClick={() => setDraft(blank)}>{t("netsvc.addRecord")}</button></p>}
        </>
      )}
    </section>
  );
}
