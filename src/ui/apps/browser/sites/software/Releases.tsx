import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { releasedAt, type SoftwareVersion } from "../../../../../sim/10-catalog/software-versions";
import type { Product } from "./SoftwareSite";

const month = (hour: number | null) => (hour === null ? t("releases.notSet") : dateOf(hour).toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" }));
const title = (p: Product, v: SoftwareVersion) => `${p.name} ${v.version}${v.name ? ` ${v.name}` : ""}`;
const state = (v: SoftwareVersion, hour: number) =>
  v.securityUntil !== null && v.securityUntil <= hour ? "ended" : v.updatesUntil !== null && v.updatesUntil <= hour ? "securityOnly" : "supported";

// The Versions table and the News announcements of the releases out by now, newest first.
export function Releases({ p, page, hour }: { p: Product; page: "versions" | "news"; hour: number }) {
  const out = releasedAt(p.id, hour).reverse();
  if (page === "news") {
    return (
      <div className="sws-news">
        {out.map((v) => (
          <article key={v.version}>
            <time>{month(v.release)}</time>
            <h3>{t("releases.title", { name: title(p, v) })}</h3>
            <ul>{t(`swnews.${p.id}.${v.version}`).split("|").map((f) => <li key={f}>{f}</li>)}</ul>
          </article>
        ))}
      </div>
    );
  }
  return (
    <table className="sws-versions">
      <thead><tr>{["version", "released", "updatesUntil", "securityUntil", "status"].map((k) => <th key={k}>{t(`releases.${k}`)}</th>)}</tr></thead>
      <tbody>{out.map((v) => {
        const s = state(v, hour);
        return (
          <tr key={v.version} data-state={s}>
            <td>{v.version}{v.name && ` ${v.name}`}</td><td className="num">{month(v.release)}</td>
            <td className="num">{month(v.updatesUntil)}</td><td className="num">{month(v.securityUntil)}</td><td>{t(`releases.${s}`)}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
