import { useState, type MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro, euroCents } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { CITIES } from "../../../../../sim/10-catalog/economy";
import { HOSTTOAST_HOST, LISTED_PRODUCTS, TIER_IDS, TIERS, type ListedProduct, type TierId } from "../../../../../sim/10-catalog/hosttoast";
import type { GameState } from "../../../../../sim/50-state";
import { hosttoastList, tierName, uptime90 } from "../../../../../sim/80-business/hosttoast";
import { registerHostToast, setHostToastTier } from "../../../../../sim/90-actions/marketing";
import { useStore } from "../../../../store";
import "./hosttoast.css";

const HOSTS = `www.${HOSTTOAST_HOST}/hosts`;
const pct = (x: number, digits = 1) => x.toLocaleString(LOCALE, { style: "percent", maximumFractionDigits: digits });
const Badge = ({ tier }: { tier: TierId }) => <span className={`ht-badge ht-${tier}`}>{tierName(tier)}</span>;
const Bar = ({ v }: { v: number }) => <span className="ht-bar" aria-label={String(Math.round(v))}><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>;

function needs(tier: TierId): string {
  const n = TIERS[tier], out: string[] = [];
  if (n.months) out.push(t("hosttoast.needs.age", { months: n.months }));
  if (n.uptime) out.push(t("hosttoast.needs.uptime", { pct: pct(n.uptime) }));
  if (n.answer) out.push(t("hosttoast.needs.ticket", { hours: n.answer }));
  return out.length ? out.join(", ") : t("hosttoast.needs.none");
}

function ForHosts({ game }: { game: GameState }) {
  const act = useStore((s) => s.act), tier = game.hosttoast.tier;
  return (
    <>
      <h1>{t("hosttoast.nav.forHosts")}</h1>
      {!tier && <button type="button" className="ht-button" onClick={() => act(registerHostToast)}>{t("hosttoast.signup")}</button>}
      {tier && (
        <dl className="ht-facts">
          <div><dt>{t("hosttoast.current")}</dt><dd><Badge tier={tier} /></dd></div>
          <div><dt>{t("hosttoast.uptime90")}</dt><dd className="num">{pct(uptime90(game), 2)}</dd></div>
        </dl>
      )}
      <table className="ht-table">
        <thead><tr><th>{t("hosttoast.col.tier")}</th><th className="r">{t("hosttoast.col.fee")}</th><th>{t("hosttoast.col.needs")}</th><th className="r">{t("hosttoast.col.trust")}</th><th /></tr></thead>
        <tbody>
          {TIER_IDS.map((id) => (
            <tr key={id}>
              <td><Badge tier={id} /></td>
              <td className={TIERS[id].fee ? "r num" : "r"}>{TIERS[id].fee ? euro(TIERS[id].fee) : t("hosttoast.free")}</td>
              <td>{needs(id)}</td>
              <td className="r num">+{TIERS[id].trust}</td>
              <td className="r">
                {tier === id ? <span className="ht-state">{t("hosttoast.currentShort")}</span>
                  : tier && <button type="button" className="ht-button" onClick={() => act(setHostToastTier, id)}>{t("hosttoast.apply")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function List({ game }: { game: GameState }) {
  const [product, setProduct] = useState<ListedProduct>("webHosting");
  const [city, setCity] = useState<string>("");
  const rows = hosttoastList(game, product, city || null), last = yearOf(game.hour) - 1;
  const hosts = game.hosttoast.awards.filter((a) => a.kind === "host" && a.year === last);
  const nameOf = (id: string) => (id === "you" ? game.company.name : game.competitors.find((r) => r.id === id)?.name ?? "");
  const badges = (id: string) => game.hosttoast.awards.filter((a) => a.year === last && a.id === id);
  return (
    <>
      {hosts.length > 0 && (
        <section className="ht-awards">
          <h2>{t("hosttoast.hostOfYear", { year: last })}</h2>
          <ul>{hosts.map((a) => <li key={a.product}><span>{t(`sim.line.${a.product}`)}</span> <b>{nameOf(a.id)}</b></li>)}</ul>
        </section>
      )}
      <div className="ht-filters">
        <label>{t("hosttoast.product")}
          <select value={product} onChange={(e) => setProduct(e.target.value as ListedProduct)}>
            {LISTED_PRODUCTS.map((p) => <option key={p} value={p}>{t(`sim.line.${p}`)}</option>)}
          </select>
        </label>
        <label>{t("hosttoast.city")}
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{t("hosttoast.allCities")}</option>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <table className="ht-table ht-list">
        <thead>
          <tr>
            <th className="r">#</th><th>{t("hosttoast.col.tier")}</th><th>{t("hosttoast.col.host")}</th><th className="r">{t("hosttoast.col.reviews")}</th>
            <th className="r">{t(product === "reseller" ? "hosttoast.col.perGb" : "hosttoast.col.from")}</th><th>{t("hosttoast.col.p")}</th><th>{t("hosttoast.col.r")}</th><th>{t("hosttoast.col.c")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={r.id === "you" ? "ht-you" : undefined}>
              <td className="r num">{i + 1}</td>
              <td><Badge tier={r.tier} /></td>
              <td>
                {r.name}
                {badges(r.id).map((a) => <span key={`${a.kind}${a.product}`} className="ht-medal">{a.kind === "host" ? t("hosttoast.hostOfYearShort") : t("hosttoast.seal")}</span>)}
              </td>
              <td className="r num">★ {r.score.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({r.reviews.toLocaleString(LOCALE)})</td>
              <td className="r num">{euroCents(r.price)}</td>
              <td><Bar v={r.P} /></td><td><Bar v={r.R} /></td><td><Bar v={r.C} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function HostToastSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const year = yearOf(game.hour), page = path.startsWith("/hosts") ? "hosts" : "list";
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const nav: [string, string, string][] = [["list", t("hosttoast.nav.list"), `www.${HOSTTOAST_HOST}/`], ["hosts", t("hosttoast.nav.forHosts"), HOSTS]];
  return (
    <div className={`ht ${year < 2012 ? "early" : "late"}`}>
      <div className="ht-page">
        <header className="ht-head">
          <span className="ht-logo">HOST<b>toast</b></span>
          <span className="ht-tag">{t("hosttoast.tagline")}</span>
        </header>
        <nav className="ht-nav">
          {nav.map(([k, label, url]) => <a key={k} href={`#${k}`} aria-current={k === page ? "page" : undefined} onClick={link(url)}>{label}</a>)}
        </nav>
        <main className="ht-main">{page === "hosts" ? <ForHosts game={game} /> : <List game={game} />}</main>
        <footer className="ht-foot">{t("hosttoast.footer", { year })}</footer>
      </div>
    </div>
  );
}
