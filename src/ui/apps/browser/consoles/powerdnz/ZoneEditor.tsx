import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { deleteRecord, saveRecord, setSecondary } from "../../../../../sim/90-actions/netsvc-dns";
import type { GameState } from "../../../../../sim/50-state";
import { ownerOf, secondaryChoices, TTLS, zoneOf, type DnsRecord, type DnsType } from "../../../../../sim/60-infra/netsvc-dns";
import { useStore } from "../../../../store";

const TYPES: DnsType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];
type Draft = Omit<DnsRecord, "id"> & { id?: string };
const blank: Draft = { type: "A", name: "", ttl: 3600, data: "" };

// The zone page: its records with Edit and Delete, and a form to add or change one. Early look is the plain table, late look the card.
export function ZoneEditor({ game, zone, era, onBack }: { game: GameState; zone: string; era: string; onBack: () => void }) {
  const act = useStore((s) => s.act), [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState("");
  const z = zoneOf(game, zone), owner = ownerOf(game, zone), choices = owner ? secondaryChoices(game, owner) : [];
  const save = () => {
    const r = act(saveRecord, zone, draft!);
    if (r.ok) { setDraft(null); setError(""); } else setError(t(r.error, {}));
  };
  return (
    <section className="pd-box pd-zone" data-era={era}>
      <h2>{zone}</h2>
      <div className="cx-tools"><button onClick={onBack}>{t("netsvc.allZones")}</button><button onClick={() => { setDraft(blank); setError(""); }}>{t("netsvc.addRecord")}</button></div>
      <label className="pd-secondary">{t("netsvc.secondary")}
        <select value={z.secondary ?? ""} onChange={(e) => act(setSecondary, zone, e.target.value || null)}>
          <option value="">{t("netsvc.noSecondary")}</option>{choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.type")}</th><th>{t("netsvc.ttl")}</th><th>{t("netsvc.data")}</th><th /></tr></thead>
        <tbody>{z.records.map((r) => (
          <tr key={r.id}>
            <td><b>{r.name}</b></td><td>{r.type}</td><td className="num">{r.ttl}</td><td className="num">{r.data}</td>
            <td className="cx-acts"><button onClick={() => { setDraft(r); setError(""); }}>{t("netsvc.edit")}</button><button onClick={() => act(deleteRecord, zone, r.id)}>{t("netsvc.delete")}</button></td>
          </tr>
        ))}</tbody>
      </table>
      {draft && (
        <form className="pd-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input aria-label={t("browser-consoles-2.name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select aria-label={t("browser-consoles-2.type")} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DnsType })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label={t("netsvc.ttl")} value={draft.ttl} onChange={(e) => setDraft({ ...draft, ttl: Number(e.target.value) })}>{TTLS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <input aria-label={t("netsvc.data")} value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })} />
          <button type="submit">{t("netsvc.save")}</button><button type="button" onClick={() => setDraft(null)}>{t("netsvc.cancel")}</button>
          {error && <span className="cx-note" role="alert">{error}</span>}
        </form>
      )}
    </section>
  );
}
