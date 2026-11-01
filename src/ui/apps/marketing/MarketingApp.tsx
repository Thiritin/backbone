import { Eye, HeartHandshake, Megaphone, Package, Presentation, ShoppingCart, Star, Tags, Waypoints } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import type { Profile } from "../../../sim/30-customers/customers";
import { isAvailable } from "../../../sim/10-catalog/research";
import {
  BUDGETS, CAMPAIGNS, costPerLead, DISCOUNTS, leadsThisMonth, monthlyMarketingCost, OWNED, owns, PLATFORMS, PROFILE_IDS, reach, reviewScore,
  type CampaignChannel, type OwnedChannel, type PlatformId, type Review,
} from "../../../sim/80-business/marketing";
import { bookFair, setCampaign, setReviewPlatform, setUpChannel, stopCampaign } from "../../../sim/90-actions/marketing";
import { hasMarketingManager } from "../../../sim/47-staff/staff";
import { fairCost, tradeFairBonus, upcomingFairs, type FairDate } from "../../../sim/80-business/fairs";
import { eventOf, FAIL_AWARENESS, FAIL_REVIEWS, type Sponsorship } from "../../../sim/80-business/community";
import { metrics } from "../../../sim/metrics";
import { PRODUCT } from "../support/labels";
import { t } from "../../../i18n/en";
import { useFocus, useStore } from "../../store";
import { formatDay } from "../billing/format";
import "../shop/shop.css";
import "../billing/billing.css";
import "./marketing.css";
import { Products, SiteCard } from "./Website";
import { Rates } from "./Rates";
import { Shop } from "./Shop";

type Section = "channels" | "products" | "shop" | "pricing" | "campaigns" | "awareness" | "reviews" | "fairs" | "community";

export const AUDIENCE: Record<Profile, string> = {
  reseller: t("web.reseller.audience"),
  private: t("marketing.audPrivate"), gamer: t("marketing.audGamer"), hobbyDev: t("marketing.audHobbyDev"), soleProp: t("marketing.audSoleProp"), smallBiz: t("marketing.audSmallBiz"), agency: t("marketing.audAgency"), office: t("marketing.audOffice"), onlineShop: t("marketing.audOnlineShop"), enterprise: t("marketing.audEnterprise"),
};

const OWNED_INFO: { id: OwnedChannel | "email"; name: string; text: string }[] = [
  { id: "email", name: t("marketing.email"), text: t("marketing.emailChannelText") },
  { id: "searchAds", name: "Goggle Ads", text: t("marketing.searchAdsText") },
  { id: "aiAds", name: t("marketing.aiAds"), text: t("marketing.aiAdsText") },
];

const CAMPAIGN_INFO: Record<CampaignChannel, string> = {
  search: "Goggle Ads", ai: t("marketing.aiAds"), gaming: t("marketing.campGaming"), coldCall: t("marketing.campColdCall"), agency: t("marketing.campAgency"),
};
const CHANNEL_NAME: Record<OwnedChannel, string> = { website: t("marketing.webDesign"), searchAds: "Goggle Ads", aiAds: t("marketing.aiAds") };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const leads = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

export function MarketingApp() {
  const game = useStore((s) => s.game);
  // Channels is always open, Products once the site is online, Pricing with Product management, Reviews and Community with
  // Marketing basics, the rest with Marketing campaigns.
  const full = isAvailable("Marketing", game.unlocks), basics = game.unlocks.includes("marketingBasics");
  const open = (id: Section) => id === "channels" || (id === "shop" ? owns(game, "website") : id === "products" ? game.marketing.launched : id === "pricing" ? game.unlocks.includes("products") : full || (basics && (id === "reviews" || id === "community")));
  const [picked, setSection] = useState<Section | null>(null);
  const section = picked && open(picked) ? picked : "channels";
  useFocus("Marketing", (f) => { if (f.kind === "page") setSection(f.id as Section); });
  const total = leadsThisMonth(game).reduce((n, b) => n + b.count, 0);
  const items: [Section, string, ReactNode, number | null][] = [
    ["channels", t("marketing.secChannels"), <Waypoints />, null],
    ["products", t("marketing.secProducts"), <Package />, game.marketing.lines.length || null],
    ["shop", t("marketing.secShop"), <ShoppingCart />, null],
    ["pricing", t("marketing.pricing"), <Tags />, null],
    ["campaigns", t("marketing.secCampaigns"), <Megaphone />, game.marketing.campaigns.length || null],
    ["awareness", t("marketing.secAwareness"), <Eye />, null],
    ["reviews", t("marketing.secReviews"), <Star />, game.marketing.reviews.length || null],
    ["fairs", t("marketing.secFairs"), <Presentation />, upcomingFairs(game).filter((d) => d.booking).length || null],
    ["community", t("marketing.secCommunity"), <HeartHandshake />, game.sponsorships.filter((x) => x.status === "running").length || null],
  ];

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label={t("marketing.sections")}>
        <div className="side-h">{t("marketing.marketing")}</div>
        {items.filter(([id]) => open(id)).map(([id, label, icon, count]) => (
          <button key={id} className={`side-item${section === id ? " active" : ""}`} aria-pressed={section === id} onClick={() => setSection(id)}>
            {icon}{label}{count !== null && <span className="side-count">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="fin-main">
        {full && <dl className="fin-totals">
          <div><dt>{t("marketing.marketingPerMonth")}</dt><dd className="num">{euro(monthlyMarketingCost(game))}</dd></div>
          <div><dt>{t("marketing.leadsThisMonth")}</dt><dd className="num">{leads(total)}</dd></div>
          <div><dt>{t("marketing.reviewScore")}</dt><dd className="num">{reviewScore(game).toFixed(1)}</dd></div>
        </dl>}
        <div className="fin-scroll">
          {section === "channels" && <Channels />}
          {section === "products" && <Products />}
          {section === "shop" && <Shop game={game} />}
          {section === "pricing" && <Rates game={game} />}
          {section === "campaigns" && <Campaigns />}
          {section === "awareness" && <Awareness />}
          {section === "reviews" && <Reviews />}
          {section === "fairs" && <Fairs />}
          {section === "community" && <Community />}
        </div>
      </div>
    </div>
  );
}

function Channels() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [managing, setManaging] = useState(false);
  const year = yearOf(game.hour), full = isAvailable("Marketing", game.unlocks);
  if (managing) return <>
    <div className="mkt-list"><button className="btn" onClick={() => setManaging(false)}>Back</button></div>
    <div className="mkt-list"><SiteCard /></div>
  </>;
  return <>
    <div className="shop-grid mkt-flat">
      <div className="shop-card">
        <div className="shop-name"><strong>Website</strong><span>Your company site where visitors browse products and order.</span></div>
        <div className="shop-buy"><span className="grow" />{game.marketing.launched && <span className="pill ok">Active</span>}<button className="btn" onClick={() => setManaging(true)}>Manage</button></div>
      </div>
      {OWNED_INFO.filter(({ id }) => full || id === "email").map(({ id, name, text }) => {
        const def = id === "email" ? null : OWNED[id];
        const active = id === "email" || owns(game, id);
        let state: ReactNode;
        if (active) state = <span className="pill ok">{t("marketing.active")}</span>;
        else if (def!.needs && !owns(game, def!.needs)) state = <span className="pill">{t("marketing.needs", { name: CHANNEL_NAME[def!.needs!] })}</span>;
        else if (year < def!.fromYear) state = <span className="pill">{t("marketing.fromYear", { year: def!.fromYear })}</span>;
        else state = <button className="btn primary" disabled={game.cash < def!.setup} onClick={() => act(setUpChannel, id as OwnedChannel)}>{t("marketing.setUp")}</button>;
        return (
          <div key={id} className="shop-card">
            <div className="shop-name"><strong>{name}</strong><span>{text}</span></div>
            <dl className="shop-specs">
              <div><dt>{t("marketing.setup")}</dt><dd className="num">{euro(def?.setup ?? 0)}</dd></div>
              <div><dt>{t("marketing.upkeep")}</dt><dd className="num">{t("marketing.slashMonth", { price: euro(def?.upkeep ?? 0) })}</dd></div>
            </dl>
            <div className="shop-buy"><span className="grow" />{state}</div>
          </div>
        );
      })}
    </div>
  </>;
}

function Campaigns() {
  return (
    <div className="mkt-list">
      {(Object.keys(CAMPAIGNS) as CampaignChannel[]).map((c) => <CampaignCard key={c} channel={c} />)}
    </div>
  );
}

function CampaignCard({ channel }: { channel: CampaignChannel }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const def = CAMPAIGNS[channel];
  const running = game.marketing.campaigns.find((c) => c.channel === channel);
  const [draft, setDraft] = useState({ profiles: reach(channel), discount: 0 });
  const { profiles, discount } = running ?? draft;
  const year = yearOf(game.hour);
  const locked = def.needs && !owns(game, def.needs);
  const costs = reach(channel).map((p) => costPerLead(channel, p, year));
  const expected = leadsThisMonth(game).filter((b) => b.source === channel).reduce((n, b) => n + b.count, 0);

  // Changes the running campaign, or the draft while it is off; a null budget stops it.
  const apply = (next: { profiles?: Profile[]; budget?: number | null; discount?: number }) => {
    const p = next.profiles ?? profiles, d = next.discount ?? discount;
    const b = next.budget === undefined ? running?.budget ?? null : next.budget;
    if (b === null) {
      if (running) act(stopCampaign, channel);
      setDraft({ profiles: p, discount: d });
    } else if (p.length) act(setCampaign, channel, p, b, d);
  };
  const toggle = (p: Profile) => apply({ profiles: profiles.includes(p) ? profiles.filter((x) => x !== p) : [...profiles, p] });

  return (
    <div className={`shop-card mkt-campaign${locked ? " mkt-locked" : ""}`}>
      <div className="mkt-head">
        <strong>{CAMPAIGN_INFO[channel]}</strong>
        {locked ? <span className="pill">{t("marketing.needs", { name: CHANNEL_NAME[def.needs!] })}</span> : running ? <span className="pill accent">{t("marketing.running")}</span> : <span className="pill">{t("marketing.off")}</span>}
      </div>
      <dl className="shop-specs mkt-specs">
        <div><dt>{t("marketing.costPerLead")}</dt><dd className="num">{Math.min(...costs) === Math.max(...costs) ? euro(costs[0]) : t("marketing.range", { a: euro(Math.min(...costs)), b: euro(Math.max(...costs)) })}</dd></div>
        <div><dt>{t("marketing.conversion")}</dt><dd>{def.conversion < 1 ? t("marketing.low") : def.conversion > 1 ? t("marketing.high") : t("marketing.normal")}</dd></div>
        <div><dt>{t("marketing.leadsThisMonth")}</dt><dd className="num">{leads(expected)}</dd></div>
      </dl>
      {!locked && <>
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.audience")}</span>
          <div className="mkt-chips">
            {reach(channel).map((p) => (
              <button key={p} className="mkt-chip" aria-pressed={profiles.includes(p)} onClick={() => toggle(p)}>{AUDIENCE[p]}</button>
            ))}
          </div>
        </div>
        {def.discount && (
          <div className="mkt-row">
            <span className="mkt-label">{t("marketing.discount")}</span>
            <div className="seg" role="group" aria-label={t("marketing.discount")}>
              {DISCOUNTS.map((d) => (
                <button key={d} aria-pressed={discount === d} onClick={() => apply({ discount: d })}>
                  {d ? pct(d) : t("marketing.none")}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.budget")}</span>
          <div className="seg" role="group" aria-label={t("marketing.monthlyBudget")}>
            <button aria-pressed={!running} onClick={() => apply({ budget: null })}>{t("marketing.off")}</button>
            {BUDGETS.map((b) => <button key={b} className="num" aria-pressed={running?.budget === b} disabled={!profiles.length} onClick={() => apply({ budget: b })}>{euro(b)}</button>)}
          </div>
        </div>
      </>}
    </div>
  );
}

function Awareness() {
  const game = useStore((s) => s.game);
  const batches = leadsThisMonth(game);
  return (
    <table className="mkt-aware">
      <thead><tr><th>{t("marketing.audience")}</th><th>{t("marketing.awareness")}</th><th className="mkt-right">{t("marketing.leadsThisMonth")}</th></tr></thead>
      <tbody>
        {PROFILE_IDS.map((p) => {
          const a = game.marketing.awareness[p];
          return (
            <tr key={p}>
              <td>{AUDIENCE[p]}</td>
              <td>
                <div className="mkt-bar"><span className="mkt-track"><span style={{ width: pct(a) }} /></span><span className="num">{pct(a)}</span></div>
              </td>
              <td className="num">{leads(batches.filter((b) => b.profile === p).reduce((n, b) => n + b.count, 0))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="mkt-stars" aria-label={t("marketing.starsOf5", { n })}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={i <= Math.round(n) ? "on" : ""} />)}
    </span>
  );
}

const band = (stars: number) => (stars <= 2 ? "bad" : stars === 3 ? "ok" : "good");

function Reviews() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const recent = [...game.marketing.reviews].reverse().slice(0, 30);
  const manager = hasMarketingManager(game);
  return (
    <div className="mkt-reviews">
      <div className="mkt-score">
        <Stars n={reviewScore(game)} />
        <span className="num">{t("marketing.nReviews", { n: game.marketing.reviews.length })}</span>
      </div>
      <h3 className="mkt-h">{t("marketing.reviewPlatforms")}</h3>
      <div className="shop-grid mkt-flat">
        {(Object.keys(PLATFORMS) as PlatformId[]).map((id) => {
          const p = PLATFORMS[id], active = game.marketing.platform === id;
          return (
            <div key={id} className="shop-card">
              <div className="shop-name"><strong>{p.name}</strong></div>
              <dl className="shop-specs">
                <div><dt>{t("marketing.fee")}</dt><dd className="num">{t("marketing.slashMonth", { price: euro(p.fee) })}</dd></div>
                <div><dt>{t("marketing.reviewInvites")}</dt><dd className="num">{p.invite ? t("marketing.pctMonth", { pct: pct(p.invite) }) : t("marketing.none")}</dd></div>
                <div><dt>{t("marketing.trustBonus")}</dt><dd className="num">+{p.trust}</dd></div>
              </dl>
              <div className="shop-buy">
                {active && <span className="pill ok">{t("marketing.active")}</span>}
                <span className="grow" />
                {active
                  ? <button className="btn" onClick={() => act(setReviewPlatform, null)}>{t("marketing.cancel")}</button>
                  : p.fee > 0 && !manager ? <span className="pill">{t("marketing.needsManager")}</span>
                  : <button className="btn primary" onClick={() => act(setReviewPlatform, id)}>{t("marketing.signUp")}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="mkt-h">{t("marketing.recentReviews")}</h3>
      {recent.length ? <ul className="mkt-review-list">{recent.map((r, i) => <ReviewRow key={`${r.hour}-${r.customerId}-${i}`} r={r} />)}</ul>
        : <div className="shop-none mkt-none">{t("marketing.noReviews")}</div>}
    </div>
  );
}

function ReviewRow({ r }: { r: Review }) {
  return (
    <li>
      <div className="mkt-review-head"><Stars n={r.stars} /><strong>{r.name}</strong><span className="grow" /><span className="num">{formatDay(r.hour)}</span></div>
      <p>{t(`review.${r.reason}.${band(r.stars)}`)}</p>
    </li>
  );
}

function Fairs() {
  const game = useStore((s) => s.game);
  return (
    <div className="mkt-reviews">
      <div className="mkt-score"><span>{t("marketing.networkContacts")}</span><span className="num">{pct(tradeFairBonus(game))}</span></div>
      <div className="shop-grid mkt-flat">
        {upcomingFairs(game).map((d) => <FairCard key={d.fair.id} d={d} />)}
      </div>
    </div>
  );
}

function FairCard({ d }: { d: FairDate }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [who, setWho] = useState<string | null>(null);
  const { fair, booking } = d;
  const cost = fairCost(fair, d.year);
  const level = metrics(game).level.level;
  const free = game.staff.filter((e) => !game.fairs.some((b) => b.employeeId === e.id && b.start < d.end && d.start < b.end));
  const open = !booking && d.start > game.hour && level >= fair.level;
  let state: ReactNode;
  if (booking) state = <span className="pill accent">{t("marketing.booked", { name: game.staff.find((e) => e.id === booking.employeeId)?.name ?? t("marketing.nobody") })}</span>;
  else if (d.start <= game.hour) state = <span className="pill">{t("marketing.underWay")}</span>;
  else if (level < fair.level) state = <span className="pill">{t("marketing.needsLevel", { level: fair.level })}</span>;
  else if (!game.staff.length) state = <span className="pill">{t("marketing.needsEmployee")}</span>;
  else state = <button className="btn primary" disabled={!who || game.cash < cost} onClick={() => who && act(bookFair, fair.id, who)}>{t("marketing.book")}</button>;
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{fair.name}</strong><span>{fair.city} · {fair.days > 1 ? t("marketing.dateRange", { from: formatDay(d.start), to: formatDay(d.end - 24) }) : formatDay(d.start)}</span></div>
      <dl className="shop-specs">
        <div><dt>{t("marketing.cost")}</dt><dd className="num">{euro(cost)}</dd></div>
        <div><dt>{t("marketing.companyLevel")}</dt><dd className="num">{fair.level}</dd></div>
        <div><dt>{t("marketing.leads")}</dt><dd className="num">{fair.leads || t("marketing.none")}</dd></div>
        <div><dt>{t("marketing.audience")}</dt><dd>{fair.profiles.length ? fair.profiles.map((p) => AUDIENCE[p]).join(", ") : t("marketing.networks")}</dd></div>
        <div><dt>{t("marketing.networkContacts")}</dt><dd className="num">+{pct(fair.bonus)}</dd></div>
      </dl>
      {open && free.length > 0 && (
        <div className="mkt-row">
          <span className="mkt-label">{t("marketing.attendee")}</span>
          <div className="mkt-chips">
            {free.map((e) => <button key={e.id} className="mkt-chip" aria-pressed={who === e.id} onClick={() => setWho(e.id)}>{e.name}</button>)}
          </div>
        </div>
      )}
      <div className="shop-buy"><span className="grow" />{state}</div>
    </div>
  );
}

function Community() {
  const game = useStore((s) => s.game);
  const list = game.sponsorships.filter((x) => x.status === "running" || x.status === "done").reverse();
  return (
    <div className="mkt-reviews">
      <div className="mkt-score"><span>{t("marketing.sponsorships")}</span><span className="num">{list.length}</span></div>
      {list.length
        ? <div className="shop-grid mkt-flat">{list.map((x) => <SponsorCard key={x.id} sp={x} />)}</div>
        : <div className="shop-none mkt-none">{t("marketing.noSponsorships")}</div>}
    </div>
  );
}

function SponsorCard({ sp }: { sp: Sponsorship }) {
  const ev = eventOf(sp), r = sp.reward;
  const down = Math.ceil(Math.max(0, ...Object.values(sp.down)));
  const state = sp.status === "running" ? <span className="pill accent">{t("marketing.running")}</span> : r ? <span className="pill ok">{t("marketing.rewarded")}</span> : <span className="pill bad">{t("marketing.failed")}</span>;
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{ev.name}</strong><span>{t("marketing.dateRange", { from: formatDay(sp.startedAt), to: formatDay(sp.endedAt ?? sp.endsAt) })}</span></div>
      <dl className="shop-specs">
        <div><dt>{t("marketing.services")}</dt><dd className="num">{ev.count} × {PRODUCT[ev.product]}</dd></div>
        <div><dt>{t("marketing.audience")}</dt><dd>{ev.audience.map((p) => AUDIENCE[p]).join(", ")}</dd></div>
        {sp.board && <div><dt>{t("marketing.awareness")}</dt><dd className="num">+{(sp.board.granted * 100).toFixed(1)}%</dd></div>}
        {sp.board?.dropped && <div><dt>{t("marketing.banner")}</dt><dd>{t("marketing.dropped")}</dd></div>}
        <div><dt>{t("marketing.hoursDown")}</dt><dd className="num">{down}</dd></div>
        {r && r.knowHow > 0 && <div><dt>{t("marketing.knowHow")}</dt><dd className="num">+{r.knowHow}</dd></div>}
        {r && r.awareness > 0 && <div><dt>{t("marketing.awareness")}</dt><dd className="num">+{pct(r.awareness)}</dd></div>}
        {r && r.leads > 0 && <div><dt>{t("marketing.leads")}</dt><dd className="num">{r.leads}</dd></div>}
        {r?.stars && <div><dt>{t("marketing.review")}</dt><dd className="num">{t("marketing.nStars", { n: r.stars })}</dd></div>}
        {r?.recommendation && <div><dt>{t("marketing.recommendation")}</dt><dd>{t("marketing.candidateStaff")}</dd></div>}
        {sp.status === "done" && !r && <div><dt>{t("marketing.reviews")}</dt><dd className="num">{t("marketing.failReviews", { n: FAIL_REVIEWS })}</dd></div>}
        {sp.status === "done" && !r && <div><dt>{t("marketing.awareness")}</dt><dd className="num">-{pct(1 - FAIL_AWARENESS)}</dd></div>}
      </dl>
      <div className="shop-buy"><span className="grow" />{state}</div>
    </div>
  );
}
