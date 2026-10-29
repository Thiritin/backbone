import type { ChangelogDay } from "../changelog";

interface Props { changes: ChangelogDay[]; max?: number; appOf?: (text: string) => string | null; onOpen?: (app: string) => void }

// The changelog days with their bullets, newest first; a bullet that names an app gets an Open button.
export function ChangeList({ changes, max = Infinity, appOf, onOpen }: Props) {
  const total = changes.reduce((n, d) => n + d.items.length, 0);
  let left = max;
  const shown = changes.map((d) => { const items = d.items.slice(0, Math.max(0, left)); left -= items.length; return { date: d.date, items }; }).filter((d) => d.items.length > 0);
  if (shown.length === 0) return null;

  return (
    <div className="update-changes">
      {shown.map((d) => (
        <section key={d.date}>
          <h3>{d.date}</h3>
          <ul>
            {d.items.map((i) => {
              const app = onOpen && appOf?.(i);
              return (
                <li key={i}>
                  {i}
                  {app && <button className="btn ghost update-open" onClick={() => onOpen(app)}>Open</button>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {total > max && <p className="update-more">{total - max} more changes</p>}
    </div>
  );
}
