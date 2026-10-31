import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { euro } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Doc } from "../../sim/50-state";
import { LEGAL_FORMS } from "../../sim/80-business/office";
import { FILED_WITH, SHARE_CAPITAL } from "../../sim/80-business/paperwork";
import { signForm } from "../../sim/90-actions/docs";
import { useStore } from "../store";
import "./paper.css";

export const paperDay = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

// A downloaded application as a printed page, signed with one click on the signature line.
export function FormDoc({ doc }: { doc: Doc }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const f = doc.form!, r = game.registration;
  const rows: [string, string][] = [
    [t("browser-sites-1.of.businessName"), game.company.name],
    [t("browser-sites-1.of.ownerField"), r?.owner ?? ""],
    [t("browser-sites-1.of.regNumber"), r ? `GA ${r.number}` : ""],
    [t("paperwork.doc.current"), r ? LEGAL_FORMS[r.form] : ""],
    [t("paperwork.doc.next"), LEGAL_FORMS[f.form]],
    ...(f.form === "limited" ? [[t("paperwork.doc.capital"), euro(SHARE_CAPITAL)] as [string, string]] : []),
    [t("paperwork.of.sendTo"), FILED_WITH[f.form]],
  ];
  return (
    <div className="paper-scroll">
      <article className="paper">
        <h1>{t(`paperwork.doc.head.${f.form}`)}</h1>
        <table><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
        <p className="paper-note">{t("paperwork.of.final")}</p>
        <div className="paper-sign">
          {f.signed !== null
            ? <span className="paper-ink">{r?.owner}</span>
            : <button className="btn" onClick={() => act(signForm, doc.id)}>{t("paperwork.doc.sign")}</button>}
          <span className="paper-line">{t("paperwork.doc.signature")}</span>
          {f.signed !== null && <small>{t("paperwork.doc.signedOn", { date: paperDay(f.signed) })}</small>}
        </div>
      </article>
    </div>
  );
}
