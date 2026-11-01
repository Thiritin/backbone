import { ChartColumn, Lock, Swords, TrendingDown, Users } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { CITIES } from "../../../sim/10-catalog/economy";
import type { Profile } from "../../../sim/30-customers/customers";
import { hourOf, START_YEAR, yearOf } from "../../../sim/00-core/time";
import { cityMarket, needsOf, OFFER, openRivals, SLA_ASKED } from "../../../sim/30-market/market";
import { BUDGET_RANGE } from "../../../sim/30-market/sales";
import { demand, lostReasons, segmentsOf, studied, studyCost } from "../../../sim/30-market/research";
import { profileStats } from "../../../sim/40-support/tickets";
import { PROFILE_IDS } from "../../../sim/80-business/marketing";
import { buyStudy } from "../../../sim/90-actions/market";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { AUDIENCE } from "../marketing/MarketingApp";
import { reviewCount, rivalScore } from "../../../sim/30-market/rivals";
import { monthYear, patience, PRODUCT } from "../support/labels";
import "../shop/shop.css";
import "../billing/billing.css";
import "../marketing/marketing.css";
import "../customers/customers.css";
import "./market.css";
import { noticesOutages } from "../customers/notice";
import { LOCALE } from "../../../i18n/lang";

type Section = "demand" | "profiles" | "lost" | "competitors";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const perMonth = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString(LOCALE));
const SLA_LABEL = { basic: t("misc1.market.slaBasic"), business: t("misc1.market.slaBusiness"), premium: t("misc1.market.slaPremium") } as const;
const LOWER = { basic: "basic", business: "basic", premium: "business" } as const;
const PLAN_SIZE = { low: t("misc1.market.planSmall"), medium: t("misc1.market.planSecond"), high: t("misc1.market.planLargest") } as const;

function Bar({ label, value, accent }: { label: ReactNode; value: number; accent?: boolean }) {
  return (
    <div className={`mkt-bar mk-bar${accent ? "" : " mk-muted"}`}>
      <span className="mk-label">{label}</span>
      <span className="mkt-track"><span style={{ width: pct(Math.min(1, value)) }} /></span>
      <span className="num">{pct(value)}</span>
    </div>
  );
}

export function MarketApp() {
  const game = useStore((s) => s.game);
  const [section, setSection] = useState<Section>("demand");
  const items: [Section, string, ReactNode, number | null][] = [
    ["demand", t("misc1.market.demand"), <ChartColumn />, null],
    ["profiles", t("misc1.market.profiles"), <Users />, game.marketing.studies.length || null],
    ["lost", t("misc1.market.lostSales"), <TrendingDown />, lostReasons(game, 3).reduce((n, g) => n + g.count, 0) || null],
    ["competitors", t("misc1.market.competitors"), <Swords />, openRivals(game).length],
  ];
  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label={t("misc1.market.sections")}>
        <div className="side-h">{t("misc1.market.market")}</div>
        {items.map(([id, label, icon, count]) => (
          <button key={id} className={`side-item${section === id ? " active" : ""}`} aria-pressed={section === id} onClick={() => setSection(id)}>
            {icon}{label}{count !== null && <span className="side-count">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          <div><dt>{t("misc1.market.buyersMonth")}</dt><dd className="num">{perMonth(CITIES.reduce((n, c) => n + cityMarket(c.name, game.hour), 0))}</dd></div>
          <div><dt>{t("misc1.market.lost3")}</dt><dd className="num">{lostReasons(game, 3).reduce((n, g) => n + g.count, 0)}</dd></div>
          <div><dt>{t("misc1.market.studies")}</dt><dd className="num">{t("misc1.market.studiesOf", { n: game.marketing.studies.length, total: PROFILE_IDS.length })}</dd></div>
        </dl>
        <div className="fin-scroll">
          {section === "demand" && <Demand />}
          {section === "profiles" && <Profiles />}
          {section === "lost" && <Lost />}
          {section === "competitors" && <Competitors />}
        </div>
      </div>
    </div>
  );
}

function Demand() {
  const game = useStore((s) => s.game);
  const [city, setCity] = useState(game.locations[0]?.city ?? CITIES[0].name);
  const rows = demand(game, city);
  return (
    <>
      <div className="mk-bar-top">
        <div className="seg" role="group" aria-label={t("misc1.market.city")}>
          {CITIES.map((c) => <button key={c.name} aria-pressed={city === c.name} onClick={() => setCity(c.name)}>{c.name}</button>)}
        </div>
      </div>
      <div className="shop-grid mkt-flat">
        {rows.map((r) => (
          <div key={r.product} className="shop-card mk-card">
            <div className="mkt-head"><strong>{PRODUCT[r.product]}</strong></div>
            <dl className="shop-specs mkt-specs">
              <div><dt>{t("misc1.market.buyersMonth")}</dt><dd className="num">{perMonth(r.buyers)}</dd></div>
              <div><dt>{t("misc1.market.yourRequests")}</dt><dd className="num">{perMonth(r.you)}</dd></div>
              <div><dt>{t("misc1.market.yourShare")}</dt><dd className="num">{pct(r.you / r.buyers)}</dd></div>
            </dl>
            <div className="mk-bars">
              <Bar label={t("misc1.market.you")} value={r.you / r.buyers} accent />
              {r.rivals.map((x) => <Bar key={x.name} label={x.name} value={x.buyers / r.buyers} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Profiles() {
  return <div className="shop-grid mk-top">{PROFILE_IDS.map((p) => <ProfileCard key={p} profile={p} />)}</div>;
}

function ProfileCard({ profile }: { profile: Profile }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const st = profileStats(profile), cost = studyCost(profile), sla = SLA_ASKED[profile];
  if (!studied(game, profile)) {
    return (
      <div className="shop-card mk-card mk-hidden">
        <div className="mkt-head"><strong>{st.name}</strong><Lock className="mk-lock" /></div>
        <dl className="shop-specs">
          <div><dt>{t("misc1.market.shareBuyers")}</dt><dd className="num">{pct(st.mix)}</dd></div>
          <div><dt>{t("misc1.market.study")}</dt><dd className="num">{euro(cost)}</dd></div>
        </dl>
        <div className="shop-buy">
          <span className="grow" />
          <button className="btn primary" disabled={game.cash < cost} onClick={() => act(buyStudy, profile)}>{t("misc1.market.buyStudy")}</button>
        </div>
      </div>
    );
  }
  const offer = OFFER[st.budget];
  const needs = [t("misc1.market.needLocation")];
  if (sla !== "basic") needs.push(t("misc1.market.needDatacenter"));
  if (sla === "premium") needs.push(t("misc1.market.needAge"));
  if (st.budget === "high") needs.push(t("misc1.market.needReview"));
  return (
    <div className="shop-card mk-card">
      <div className="mkt-head"><strong>{st.name}</strong></div>
      <dl className="shop-specs">
        <div className="mk-wide"><dt>{t("misc1.market.pays")}</dt><dd className="num">{t("misc1.market.paysRange", { from: pct(offer * BUDGET_RANGE[0]), to: pct(offer * BUDGET_RANGE[1]) })}</dd></div>
        <div><dt>{t("misc1.market.shareBuyers")}</dt><dd className="num">{pct(st.mix)}</dd></div>
        <div><dt>{t("misc1.market.plan")}</dt><dd>{PLAN_SIZE[st.budget]}</dd></div>
        <div><dt>SLA</dt><dd>{sla !== "basic" ? t("misc1.market.slaOr", { a: SLA_LABEL[sla], b: SLA_LABEL[LOWER[sla]] }) : SLA_LABEL[sla]}</dd></div>
        <div><dt>{t("misc1.market.replyWithin")}</dt><dd>{patience(st.reply)}</dd></div>
        <div><dt>{t("misc1.market.noticesOutages")}</dt><dd>{noticesOutages(profile)}</dd></div>
        <div><dt>{t("misc1.market.priceSensitivity")}</dt><dd>{st.lambda >= 1 ? t("misc1.market.high") : st.lambda >= 0.6 ? t("misc1.market.medium") : t("misc1.market.low")}</dd></div>
      </dl>
      <div className="mk-bars">
        <Bar label={t("misc1.market.performance")} value={st.wP} accent />
        <Bar label={t("misc1.market.reliability")} value={st.wR} accent />
        <Bar label={t("misc1.market.convenience")} value={st.wC} accent />
      </div>
      <div className="mkt-row">
        <span className="mkt-label">{t("misc1.market.buys")}</span>
        <div className="mkt-chips">{needsOf(profile, yearOf(game.hour)).map(([p, w]) => <span key={p} className="mk-tag">{PRODUCT[p]} <span className="num">{pct(w)}</span></span>)}</div>
      </div>
      <div className="mkt-row">
        <span className="mkt-label">{t("misc1.market.demands")}</span>
        <ul className="mk-needs">{needs.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </div>
  );
}

const PERIODS = [3, 6, 12];

function Lost() {
  const game = useStore((s) => s.game);
  const [months, setMonths] = useState(3);
  const groups = lostReasons(game, months), max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <>
      <div className="mk-bar-top">
        <div className="seg" role="group" aria-label={t("misc1.market.period")}>
          {PERIODS.map((m) => <button key={m} aria-pressed={months === m} onClick={() => setMonths(m)}>{t("misc1.market.nMonths", { n: m })}</button>)}
        </div>
      </div>
      <table className="mkt-aware">
        <thead><tr><th>{t("misc1.market.reason")}</th><th>{t("misc1.market.count")}</th><th className="mkt-right">{t("misc1.market.valueMonth")}</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={`${g.reason}${JSON.stringify(g.params)}`}>
              <td>{t(g.reason, g.params)}</td>
              <td><div className="mkt-bar"><span className="mkt-track"><span style={{ width: pct(g.count / max) }} /></span><span className="num">{g.count}</span></div></td>
              <td className="num">{euroCents(g.reference)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!groups.length && <div className="sup-none">{t("misc1.market.noLost")}</div>}
    </>
  );
}

const W = 520, H = 160, PAD = { l: 32, r: 8, t: 8, b: 20 };
// Rival layers are neutral steps so the accent stays yours.
const shade = (k: number) => `color-mix(in oklch, var(--text) ${[10, 34, 18, 42, 26, 50, 14, 38][k % 8]}%, var(--win))`;

function ShareChart({ city }: { city: string }) {
  const game = useStore((s) => s.game);
  const [hover, setHover] = useState<number | null>(null);
  const log = game.shareLog, ci = CITIES.findIndex((c) => c.name === city);
  if (log.length < 2) return <div className="sup-none">{t("misc.noHistoryYet")}</div>;
  const hosts = [{ id: "you", name: t("misc1.market.you"), at: (i: number) => log[i].you[ci] ?? 0 },
    ...game.competitors.map((r) => ({ id: r.id, name: r.name, at: (i: number) => log[i].rivals[r.id]?.[ci] ?? 0 }))].filter((h, k) => k === 0 || log.some((_, i) => h.at(i) > 0));
  const total = (i: number) => Math.max(1e-9, hosts.reduce((n, h) => n + h.at(i), 0));
  const x = (i: number) => PAD.l + (i / (log.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const base = log.map(() => 0);
  const layers = hosts.map((h) => {
    const low = [...base];
    log.forEach((_, i) => { base[i] += h.at(i) / total(i); });
    const top = log.map((_, i) => `${x(i).toFixed(1)},${y(base[i]).toFixed(1)}`), bottom = low.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse();
    return { ...h, points: [...top, ...bottom].join(" ") };
  });
  const shown = hover ?? log.length - 1, hourAt = (i: number) => hourOf(new Date(Date.UTC(START_YEAR, log[i].month, 1)));
  const move = (e: React.MouseEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const px = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x;
    setHover(Math.max(0, Math.min(log.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (log.length - 1)))));
  };
  return (
    <figure className="cus-chart mk-share">
      <figcaption><b>{t("misc1.market.shareNew")}</b><span className="num">{monthYear(hourAt(shown))}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("misc1.market.shareNew")} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        {layers.map((l, k) => <polygon key={l.id} points={l.points} fill={k === 0 ? "var(--accent)" : shade(k - 1)} />)}
        {[0, 0.5, 1].map((f) => <text key={f} className="num" x={PAD.l - 6} y={y(f)} textAnchor="end" dominantBaseline="middle">{pct(f)}</text>)}
        {log.map((e, i) => (e.month % 12 === 0 && i > 0 && x(i) < W - PAD.r - 14 ? <text key={e.month} className="num" x={x(i)} y={H - 4} textAnchor="middle">{START_YEAR + e.month / 12}</text> : null))}
        {hover !== null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />}
      </svg>
      <ul className="mk-legend">
        {hosts.map((h, k) => (
          <li key={h.id}><i style={{ background: k === 0 ? "var(--accent)" : shade(k - 1) }} />{h.name}<span className="num">{pct(h.at(shown) / total(shown))}</span></li>
        ))}
      </ul>
    </figure>
  );
}

function Competitors() {
  const game = useStore((s) => s.game);
  const [city, setCity] = useState(game.locations[0]?.city ?? CITIES[0].name);
  return (
    <>
      <div className="mk-bar-top">
        <div className="seg" role="group" aria-label={t("misc1.market.city")}>
          {CITIES.map((c) => <button key={c.name} aria-pressed={city === c.name} onClick={() => setCity(c.name)}>{c.name}</button>)}
        </div>
      </div>
      <div className="mk-pad"><ShareChart city={city} /></div>
      <table className="mkt-aware mk-rivals">
        <thead>
          <tr>
            <th>{t("misc1.market.competitor")}</th><th className="mkt-right">{t("misc1.market.performance")}</th><th className="mkt-right">{t("misc1.market.reliability")}</th>
            <th className="mkt-right">{t("misc1.market.convenience")}</th><th className="mkt-right">{t("misc1.market.price")}</th><th className="mkt-right">{t("misc1.market.customers")}</th><th className="mkt-right">{t("misc1.market.reviews")}</th>
          </tr>
        </thead>
        <tbody>
          {openRivals(game, city).map((c) => {
            return (
              <Fragment key={c.id}>
              <tr className="mk-main">
                <td><strong>{c.name}</strong>{c.outage && <span className="pill bad">{t("misc1.market.outage")}</span>}</td>
                <td className="num">{Math.round(c.P)}</td>
                <td className="num">{Math.round(c.R)}</td>
                <td className="num">{Math.round(c.C)}</td>
                <td className="num">{(c.priceFactor - 1).toLocaleString(LOCALE, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" })}</td>
                <td className="num">{(c.customers[city] ?? 0).toLocaleString(LOCALE)}</td>
                <td className="num">{rivalScore(c).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({reviewCount(c).toLocaleString(LOCALE)})</td>
              </tr>
              <tr className="mk-sub">
                <td colSpan={7}>
                  <div className="mkt-row"><span className="mkt-label">{t("misc1.market.sells")}</span><div className="mkt-chips">{c.sells.map((p) => <span key={p} className="mk-tag">{PRODUCT[p]}</span>)}</div></div>
                  <div className="mkt-row"><span className="mkt-label">{t("misc1.market.sellsTo")}</span><div className="mkt-chips">{segmentsOf(c).map((p) => <span key={p} className="mk-tag">{AUDIENCE[p]}</span>)}</div></div>
                </td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
