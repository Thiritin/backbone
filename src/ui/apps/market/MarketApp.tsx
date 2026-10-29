import { ChartColumn, Lock, Swords, TrendingDown, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { CITIES, COMPETITORS } from "../../../sim/10-catalog/economy";
import type { Profile } from "../../../sim/30-customers/customers";
import { yearOf } from "../../../sim/00-core/time";
import { cityMarket, needsOf, OFFER, SLA_ASKED } from "../../../sim/30-market/market";
import { BUDGET_RANGE } from "../../../sim/30-market/sales";
import { demand, lostReasons, segmentsOf, studied, studyCost } from "../../../sim/30-market/research";
import { profileStats } from "../../../sim/40-support/tickets";
import { PROFILE_IDS } from "../../../sim/80-business/marketing";
import { buyStudy } from "../../../sim/90-actions/market";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { AUDIENCE } from "../marketing/MarketingApp";
import { patience, PRODUCT } from "../support/labels";
import "../shop/shop.css";
import "../billing/billing.css";
import "../marketing/marketing.css";
import "./market.css";
import { noticesOutages } from "../customers/notice";

type Section = "demand" | "profiles" | "lost" | "competitors";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const perMonth = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString("en"));
const SLA_LABEL = { basic: "Basic", business: "Business", premium: "Premium" } as const;
const LOWER = { basic: "basic", business: "basic", premium: "business" } as const;
const PLAN_SIZE = { low: "Smallest plan", medium: "Second plan", high: "Largest plan" } as const;

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
    ["demand", "Demand", <ChartColumn />, null],
    ["profiles", "Profiles", <Users />, game.marketing.studies.length || null],
    ["lost", "Lost sales", <TrendingDown />, lostReasons(game, 3).reduce((n, g) => n + g.count, 0) || null],
    ["competitors", "Competitors", <Swords />, COMPETITORS.length],
  ];
  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Sections">
        <div className="side-h">Market</div>
        {items.map(([id, label, icon, count]) => (
          <button key={id} className={`side-item${section === id ? " active" : ""}`} aria-pressed={section === id} onClick={() => setSection(id)}>
            {icon}{label}{count !== null && <span className="side-count">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          <div><dt>Buyers a month</dt><dd className="num">{perMonth(CITIES.reduce((n, c) => n + cityMarket(c.name, game.hour), 0))}</dd></div>
          <div><dt>Lost sales, 3 months</dt><dd className="num">{lostReasons(game, 3).reduce((n, g) => n + g.count, 0)}</dd></div>
          <div><dt>Studies</dt><dd className="num">{game.marketing.studies.length} of {PROFILE_IDS.length}</dd></div>
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
        <div className="seg" role="group" aria-label="City">
          {CITIES.map((c) => <button key={c.name} aria-pressed={city === c.name} onClick={() => setCity(c.name)}>{c.name}</button>)}
        </div>
      </div>
      <div className="shop-grid mkt-flat">
        {rows.map((r) => (
          <div key={r.product} className="shop-card mk-card">
            <div className="mkt-head"><strong>{PRODUCT[r.product]}</strong></div>
            <dl className="shop-specs mkt-specs">
              <div><dt>Buyers a month</dt><dd className="num">{perMonth(r.buyers)}</dd></div>
              <div><dt>Your requests</dt><dd className="num">{perMonth(r.you)}</dd></div>
              <div><dt>Your share</dt><dd className="num">{pct(r.you / r.buyers)}</dd></div>
            </dl>
            <div className="mk-bars">
              <Bar label="You" value={r.you / r.buyers} accent />
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
          <div><dt>Share of buyers</dt><dd className="num">{pct(st.mix)}</dd></div>
          <div><dt>Study</dt><dd className="num">{euro(cost)}</dd></div>
        </dl>
        <div className="shop-buy">
          <span className="grow" />
          <button className="btn primary" disabled={game.cash < cost} onClick={() => act((s) => buyStudy(s, profile))}>Buy study</button>
        </div>
      </div>
    );
  }
  const offer = OFFER[st.budget];
  const needs = ["Location in their city"];
  if (sla !== "basic") needs.push("Datacenter in their city");
  if (sla === "premium") needs.push("Company at least 12 months old");
  if (st.budget === "high") needs.push("Review score of 3 stars");
  return (
    <div className="shop-card mk-card">
      <div className="mkt-head"><strong>{st.name}</strong></div>
      <dl className="shop-specs">
        <div className="mk-wide"><dt>Pays</dt><dd className="num">{pct(offer * BUDGET_RANGE[0])} to {pct(offer * BUDGET_RANGE[1])} of market price</dd></div>
        <div><dt>Share of buyers</dt><dd className="num">{pct(st.mix)}</dd></div>
        <div><dt>Plan</dt><dd>{PLAN_SIZE[st.budget]}</dd></div>
        <div><dt>SLA</dt><dd>{SLA_LABEL[sla]}{sla !== "basic" && ` or ${SLA_LABEL[LOWER[sla]]}`}</dd></div>
        <div><dt>Reply within</dt><dd>{patience(st.reply)}</dd></div>
        <div><dt>Notices outages</dt><dd>{noticesOutages(profile)}</dd></div>
        <div><dt>Price sensitivity</dt><dd>{st.lambda >= 1 ? "High" : st.lambda >= 0.6 ? "Medium" : "Low"}</dd></div>
      </dl>
      <div className="mk-bars">
        <Bar label="Performance" value={st.wP} accent />
        <Bar label="Reliability" value={st.wR} accent />
        <Bar label="Convenience" value={st.wC} accent />
      </div>
      <div className="mkt-row">
        <span className="mkt-label">Buys</span>
        <div className="mkt-chips">{needsOf(profile, yearOf(game.hour)).map(([p, w]) => <span key={p} className="mk-tag">{PRODUCT[p]} <span className="num">{pct(w)}</span></span>)}</div>
      </div>
      <div className="mkt-row">
        <span className="mkt-label">Demands</span>
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
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((m) => <button key={m} aria-pressed={months === m} onClick={() => setMonths(m)}>{m} months</button>)}
        </div>
      </div>
      <table className="mkt-aware">
        <thead><tr><th>Reason</th><th>Count</th><th className="mkt-right">Market value a month</th></tr></thead>
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
      {!groups.length && <div className="sup-none">No lost sales</div>}
    </>
  );
}

function Competitors() {
  return (
    <div className="shop-grid">
      {COMPETITORS.map((c) => {
        const diff = Math.round((c.priceFactor - 1) * 100);
        return (
          <div key={c.name} className="shop-card mk-card">
            <div className="mkt-head">
              <strong>{c.name}</strong>
              <span className="pill">{diff < 0 ? `${-diff}% under market` : `${diff}% over market`}</span>
            </div>
            <div className="mk-bars">
              <Bar label="Performance" value={c.P / 100} />
              <Bar label="Reliability" value={c.R / 100} />
              <Bar label="Convenience" value={c.C / 100} />
            </div>
            <div className="mkt-row">
              <span className="mkt-label">Sells</span>
              <div className="mkt-chips">{c.sells.map((p) => <span key={p} className="mk-tag">{PRODUCT[p]}</span>)}</div>
            </div>
            <div className="mkt-row">
              <span className="mkt-label">Sells to</span>
              <div className="mkt-chips">{segmentsOf(c).map((p) => <span key={p} className="mk-tag">{AUDIENCE[p]}</span>)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
