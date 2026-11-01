import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateOf } from "../../../sim/00-core/time";
import { feedByDay } from "../../../sim/80-business/news";
import { LOCALE } from "../../../i18n/lang";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import "../news/news.css";
import "./calendar.css";

const key = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...o });

export function CalendarApp() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  const now = dateOf(game.hour);
  const today = key(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [[y, m], setYm] = useState<[number, number]>([now.getUTCFullYear(), now.getUTCMonth()]);
  const [sel, setSel] = useState(today);
  const days = feedByDay(game);
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const step = (n: number) => setYm(([yy, mm]) => { const d = new Date(Date.UTC(yy, mm + n, 1)); return [d.getUTCFullYear(), d.getUTCMonth()]; });
  return (
    <div className="cal">
      <header className="cal-head">
        <button className="btn ghost" aria-label={t("calendar.prev")} onClick={() => step(-1)}><ChevronLeft /></button>
        <h2>{fmt({ month: "long", year: "numeric" }).format(Date.UTC(y, m, 1))}</h2>
        <button className="btn ghost" aria-label={t("calendar.next")} onClick={() => step(1)}><ChevronRight /></button>
      </header>
      <div className="cal-grid">
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="cal-dow">{fmt({ weekday: "short" }).format(Date.UTC(2024, 0, 1 + i))}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const k = key(y, m, i + 1);
          return (
            <button key={k} className={`cal-day${k === sel ? " sel" : ""}${k === today ? " today" : ""}`} onClick={() => setSel(k)}>
              {i + 1}
              {days.has(k) && <i className="cal-dot" />}
            </button>
          );
        })}
      </div>
      <div className="cal-list">
        {(days.get(sel) ?? []).map((n) => (
          <article className="news-item" key={`${n.key}-${n.hour}-${JSON.stringify(n.params)}`}>
            <h3>{t(`${n.key}.title`, n.params)}</h3>
            <p>{t(`${n.key}.text`, n.params)}</p>
            {typeof n.params.url === "string" && <button className="news-link" onClick={() => openApp("Browser", { kind: "url", id: String(n.params.url) })}>{String(n.params.url).split("/")[0]}</button>}
          </article>
        ))}
      </div>
    </div>
  );
}
