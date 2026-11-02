import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import { deskRecords } from "../../../../../sim/40-support/desk-records";
import { registrarUrl } from "../../../../../sim/80-business/browser";
import { verifyDesk } from "../../../../../sim/90-actions/desk-install";
import { usePageAct } from "../../pageAct";
import "./records.css";

// The records the desk needs at the registrar, until each desk's admin draws its own page (support-desk.md M10 to M13).
export function DomainRecords({ game, go }: { game: GameState; go?: (url: string) => void }) {
  const act = usePageAct(), rows = deskRecords(game), [copied, setCopied] = useState<string | null>(null), [verified, setVerified] = useState(false);
  if (!rows.length) return null;
  const copy = (data: string) => { void navigator.clipboard?.writeText(data).catch(() => undefined); setCopied(data); };
  return (
    <section className="desk-records">
      <h2>{t("desk.records.title")}</h2>
      <table>
        <thead><tr><th>{t("desk.records.type")}</th><th>{t("desk.records.name")}</th><th>{t("desk.records.value")}</th><th>{t("desk.records.status")}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.type} ${r.name}`}>
              <td>{r.type}</td>
              <td><code>{r.name}</code></td>
              <td>{r.data
                ? <><code>{r.data}</code> <button type="button" onClick={() => copy(r.data)}>{copied === r.data ? t("desk.records.copied") : t("desk.records.copy")}</button></>
                : t("desk.records.noAddress")}</td>
              <td><span className="desk-records-chip" data-ok={r.ok}>{r.ok ? t("desk.records.ok") : t("desk.records.missing")}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="desk-records-actions">
        <button type="button" onClick={() => setVerified(act(verifyDesk).ok)}>{verified ? t("desk.records.verified") : t("desk.records.verify")}</button>
        {go && <a href="#dns" onClick={(e) => { e.preventDefault(); go(`${registrarUrl(game)}login/dns`); }}>{t("desk.records.dns")}</a>}
      </div>
    </section>
  );
}
