import { formatClock } from "../../../sim/00-core/time";
import { feed } from "../../../sim/80-business/news";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import "./news.css";

export function NewsApp() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  const items = feed(game);
  return (
    <div className="news">
      {items.length === 0 && <p className="notif-empty">{t("misc2.noNews")}</p>}
      {items.map((n) => (
        <article className="news-item" key={`${n.key}-${n.hour}-${JSON.stringify(n.params)}`}>
          <time>{formatClock(n.hour).slice(4, -8)}</time>
          <h3>{t(`${n.key}.title`, n.params)}</h3>
          <p>{t(`${n.key}.text`, n.params)}</p>
          {typeof n.params.url === "string" && <button className="news-link" onClick={() => openApp("Browser", { kind: "url", id: String(n.params.url) })}>{String(n.params.url).split("/")[0]}</button>}
        </article>
      ))}
    </div>
  );
}
