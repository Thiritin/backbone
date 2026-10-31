import { t } from "../../i18n/en";
import type { ChangelogDay } from "../changelog";

interface Props { changes: ChangelogDay[]; max?: number }

// The changelog days with their bullets, newest first.
export function ChangeList({ changes, max = Infinity }: Props) {
  const total = changes.reduce((n, d) => n + d.items.length, 0);
  let left = max;
  const shown = changes.map((d) => { const items = d.items.slice(0, Math.max(0, left)); left -= items.length; return { ...d, items }; }).filter((d) => d.items.length > 0);
  if (shown.length === 0) return null;

  return (
    <div className="update-changes">
      {shown.map((d) => (
        <section key={d.date}>
          <h3>{d.version ? t("desktop.changes.version", { version: d.version }) : d.date}</h3>
          <ul>
            {d.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </section>
      ))}
      {total > max && <p className="update-more">{t("desktop.changes.more", { n: total - max })}</p>}
    </div>
  );
}
