import { dateOf } from "../../../sim/00-core/time";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { isFinal } from "../../../sim/40-support/tickets";
import { useStore } from "../../store";
import { KINDS } from "./labels";

const SHOWN = 12;

export function Reports() {
  const tickets = useStore((s) => s.game.tickets);
  const hour = useStore((s) => s.game.hour);
  const now = dateOf(hour);
  const months = Array.from({ length: SHOWN }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (SHOWN - 1 - i), 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }).map((m) => ({ ...m, count: tickets.filter((tk) => { const c = dateOf(tk.createdAt); return c.getUTCFullYear() === m.year && c.getUTCMonth() === m.month; }).length }));
  const peak = Math.max(1, ...months.map((m) => m.count));
  const kinds = KINDS.map((k) => ({ ...k, total: tickets.filter((tk) => tk.kind === k.id).length, open: tickets.filter((tk) => tk.kind === k.id && !isFinal(tk)).length }));
  const most = Math.max(1, ...kinds.map((k) => k.total));

  return (
    <div className="sup-reports">
      <section>
        <h2>{t("support.ticketsPerKind")}</h2>
        <table>
          <thead><tr><th>{t("support.kind")}</th><th /><th className="r">{t("support.total")}</th><th className="r">{t("support.open")}</th></tr></thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.id}>
                <td><span className="type"><k.icon />{k.label}</span></td>
                <td className="bar"><i style={{ width: `${(k.total / most) * 100}%` }} /></td>
                <td className="r num">{k.total}</td>
                <td className="r num">{k.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>{t("support.ticketsPerMonth")}</h2>
        <div className="months" role="img" aria-label={t("support.ticketsPerMonth")}>
          {months.map((m) => (
            <div key={`${m.year}-${m.month}`} className="m">
              <span className="num">{m.count}</span>
              <i style={{ height: `${(m.count / peak) * 100}%` }} />
              <span>{new Date(Date.UTC(m.year, m.month, 1)).toLocaleDateString(LOCALE, { month: "short", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
