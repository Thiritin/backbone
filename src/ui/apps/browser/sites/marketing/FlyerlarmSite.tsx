import { useState, type MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euroCents } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { FLYER_DELIVERY_HOURS, FLYER_HAND_OUT_DAYS, FLYER_HOST, FLYER_SIZES, flyerPrice } from "../../../../../sim/10-catalog/flyers";
import type { GameState } from "../../../../../sim/50-state";
import { handingOut } from "../../../../../sim/80-business/flyers";
import { orderFlyers } from "../../../../../sim/90-actions/marketing";
import { formatDay } from "../../../billing/format";
import { usePageAct } from "../../pageAct";
import { eraOf } from "../era";
import "./flyerlarm.css";

const ERAS = [{ from: 2005, look: "early" as const }, { from: 2015, look: "late" as const }];
const PAGES: [string, string, string][] = [["home", "flyers.nav.home", "/"], ["flyers", "flyers.nav.order", "/flyers"], ["orders", "flyers.nav.orders", "/orders"]];
const count = (n: number) => n.toLocaleString(LOCALE);
const perFlyer = (size: number, year: number) => `${(flyerPrice(size, year) / size).toLocaleString(LOCALE, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €`;

function Home({ year, go }: { year: number; go: (url: string) => void }) {
  return (
    <>
      <section className="fl-hero">
        <h1>{t("flyers.heroTitle")}</h1>
        <p>{t("flyers.heroText")}</p>
        <button type="button" className="fl-button" onClick={() => go(`www.${FLYER_HOST}/flyers`)}>{t("flyers.order")}</button>
      </section>
      <section className="fl-card">
        <h2>{t("flyers.special")}</h2>
        <table className="fl-table">
          <thead><tr><th>{t("flyers.run")}</th><th className="r">{t("flyers.perFlyer")}</th><th className="r">{t("flyers.price")}</th></tr></thead>
          <tbody>
            {FLYER_SIZES.map((n) => <tr key={n}><td>{count(n)}</td><td className="r fl-num">{perFlyer(n, year)}</td><td className="r fl-num">{euroCents(flyerPrice(n, year))}</td></tr>)}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="fl-field">
      <span className="fl-label">{label}</span>
      <div className="fl-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.text}</button>)}
      </div>
    </div>
  );
}

function Order({ game, year, go }: { game: GameState; year: number; go: (url: string) => void }) {
  const act = usePageAct(), cities = [...new Set(game.locations.map((l) => l.city))];
  const [city, setCity] = useState(cities[0]), [size, setSize] = useState(FLYER_SIZES[1]);
  return (
    <section className="fl-card">
      <h2>{t("flyers.nav.order")}</h2>
      <Seg label={t("flyers.city")} value={city} options={cities.map((c) => ({ id: c, text: c }))} onChange={setCity} />
      <Seg label={t("flyers.run")} value={size} options={FLYER_SIZES.map((n) => ({ id: n, text: count(n) }))} onChange={setSize} />
      <dl className="fl-specs">
        <div><dt>{t("flyers.perFlyer")}</dt><dd className="fl-num">{perFlyer(size, year)}</dd></div>
        <div><dt>{t("flyers.delivery")}</dt><dd>{t("flyers.nDays", { n: FLYER_DELIVERY_HOURS / 24 })}</dd></div>
        <div><dt>{t("flyers.handOut")}</dt><dd>{t("flyers.nDays", { n: FLYER_HAND_OUT_DAYS })}</dd></div>
        <div><dt>{t("flyers.price")}</dt><dd className="fl-num"><b>{euroCents(flyerPrice(size, year))}</b></dd></div>
      </dl>
      <button type="button" className="fl-button" onClick={() => { if (act(orderFlyers, city, size).ok) go(`www.${FLYER_HOST}/orders`); }}>{t("flyers.order")}</button>
    </section>
  );
}

function Orders({ game }: { game: GameState }) {
  const runs = [...game.marketing.flyers].reverse();
  const status = (r: GameState["marketing"]["flyers"][number]) => (r.flyersLeft === 0 ? "flyers.done" : handingOut(game, r) ? "flyers.handing" : "flyers.printing");
  return (
    <section className="fl-card">
      <h2>{t("flyers.nav.orders")}</h2>
      {runs.length ? (
        <table className="fl-table">
          <thead><tr><th>{t("flyers.ordered")}</th><th>{t("flyers.city")}</th><th className="r">{t("flyers.run")}</th><th>{t("flyers.status")}</th><th className="r">{t("flyers.left")}</th><th className="r">{t("flyers.leads")}</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{formatDay(r.orderedAt)}</td><td>{r.city}</td><td className="r fl-num">{count(r.size)}</td><td>{t(status(r))}</td>
                <td className="r fl-num">{count(Math.round(r.flyersLeft))}</td><td className="r fl-num">{count(Math.round(r.leads))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="fl-none">{t("flyers.noOrders")}</p>}
    </section>
  );
}

// Flyerlarm, the print shop: a loud 2005 order form until 2014, a flat web shop after.
export function FlyerlarmSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const year = yearOf(game.hour), look = eraOf(ERAS, year);
  const page = path.startsWith("/flyers") ? "flyers" : path.startsWith("/orders") ? "orders" : "home";
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  return (
    <div className={`fl ${look}`}>
      <header className="fl-head">
        <span className="fl-logo">Flyer<b>larm</b></span>
        <span className="fl-tag">{t("flyers.tagline")}</span>
      </header>
      <nav className="fl-nav">
        {PAGES.map(([k, label, p]) => <a key={k} href={`#${k}`} aria-current={k === page ? "page" : undefined} onClick={link(`www.${FLYER_HOST}${p}`)}>{t(label)}</a>)}
      </nav>
      <main className="fl-main">
        {page === "home" ? <Home year={year} go={go} /> : page === "flyers" ? <Order game={game} year={year} go={go} /> : <Orders game={game} />}
      </main>
      <footer className="fl-foot">
        <span>{t("flyers.footer", { year })}</span>
        {look === "early" && <>
          <span>{t("flyers.best")}</span>
          <span className="fl-counter">{t("browser-sites-2.visitors")} <b>{String(31337 + Math.floor(game.hour / 7)).padStart(7, "0")}</b></span>
        </>}
      </footer>
    </div>
  );
}
