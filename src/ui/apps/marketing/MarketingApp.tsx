import { Eye, HeartHandshake, Megaphone, Presentation, Star, Waypoints } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import type { Profile } from "../../../sim/30-customers/customers";
import {
  BUDGETS, CAMPAIGNS, costPerLead, DISCOUNTS, leadsThisMonth, monthlyMarketingCost, OWNED, owns, PLATFORMS, PROFILE_IDS, reach, reviewScore,
  type CampaignChannel, type OwnedChannel, type PlatformId, type Review,
} from "../../../sim/80-business/marketing";
import { bookFair, setCampaign, setReviewPlatform, setUpChannel, stopCampaign } from "../../../sim/90-actions/marketing";
import { hasMarketingManager } from "../../../sim/47-staff/staff";
import { fairCost, tradeFairBonus, upcomingFairs, type FairDate } from "../../../sim/80-business/fairs";
import { eventById, FAIL_AWARENESS, FAIL_REVIEWS, type Sponsorship } from "../../../sim/80-business/community";
import { metrics } from "../../../sim/metrics";
import { PRODUCT } from "../support/labels";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import "../shop/shop.css";
import "../billing/billing.css";
import "./marketing.css";

type Section = "channels" | "campaigns" | "awareness" | "reviews" | "fairs" | "community";

export const AUDIENCE: Record<Profile, string> = {
  private: "Private users", gamer: "Gamers", hobbyDev: "Developers", soleProp: "Sole traders", smallBiz: "Small businesses",
  agency: "Agencies", office: "Offices and practices", onlineShop: "Online shops", enterprise: "Enterprises",
};

const OWNED_INFO: { id: OwnedChannel | "email"; name: string; text: string }[] = [
  { id: "email", name: "Email", text: "Customers find you through friends and order by writing to your inbox." },
  { id: "website", name: "Web design", text: "Redesigns your website so search engines find it, which brings in a steady trickle of requests." },
  { id: "orderForm", name: "Order form", text: "Lets customers order standard products on their own." },
  { id: "searchAds", name: "Goggle Ads", text: "Sends people searching for hosting to your website." },
  { id: "aiAds", name: "AI ads", text: "Targets better than search ads and converts more visitors." },
];

const CAMPAIGN_INFO: Record<CampaignChannel, string> = {
  search: "Goggle Ads", ai: "AI ads", gaming: "Gaming communities", coldCall: "Cold calling", agency: "Agency outreach",
};
const CHANNEL_NAME: Record<OwnedChannel, string> = { website: "Web design", orderForm: "Order form", searchAds: "Goggle Ads", aiAds: "AI ads" };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const leads = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

export function MarketingApp() {
  const game = useStore((s) => s.game);
  const [section, setSection] = useState<Section>("channels");
  const total = leadsThisMonth(game).reduce((n, b) => n + b.count, 0);
  const items: [Section, string, ReactNode, number | null][] = [
    ["channels", "Channels", <Waypoints />, null],
    ["campaigns", "Campaigns", <Megaphone />, game.marketing.campaigns.length || null],
    ["awareness", "Awareness", <Eye />, null],
    ["reviews", "Reviews", <Star />, game.marketing.reviews.length || null],
    ["fairs", "Trade fairs", <Presentation />, upcomingFairs(game).filter((d) => d.booking).length || null],
    ["community", "Community", <HeartHandshake />, game.sponsorships.filter((x) => x.status === "running").length || null],
  ];

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Sections">
        <div className="side-h">Marketing</div>
        {items.map(([id, label, icon, count]) => (
          <button key={id} className={`side-item${section === id ? " active" : ""}`} aria-pressed={section === id} onClick={() => setSection(id)}>
            {icon}{label}{count !== null && <span className="side-count">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          <div><dt>Marketing per month</dt><dd className="num">{euro(monthlyMarketingCost(game))}</dd></div>
          <div><dt>Leads this month</dt><dd className="num">{leads(total)}</dd></div>
          <div><dt>Review score</dt><dd className="num">{reviewScore(game).toFixed(1)}</dd></div>
        </dl>
        <div className="fin-scroll">
          {section === "channels" && <Channels />}
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
  const year = yearOf(game.hour);
  return (
    <div className="shop-grid">
      {OWNED_INFO.map(({ id, name, text }) => {
        const def = id === "email" ? null : OWNED[id];
        const active = id === "email" || owns(game, id);
        let state: ReactNode;
        if (active) state = <span className="pill ok">Active</span>;
        else if (def!.needs && !owns(game, def!.needs)) state = <span className="pill">Needs {CHANNEL_NAME[def!.needs]}</span>;
        else if (year < def!.fromYear) state = <span className="pill">From <span className="num">{def!.fromYear}</span></span>;
        else state = <button className="btn primary" disabled={game.cash < def!.setup} onClick={() => act(setUpChannel, id as OwnedChannel)}>Set up</button>;
        return (
          <div key={id} className="shop-card">
            <div className="shop-name"><strong>{name}</strong><span>{text}</span></div>
            <dl className="shop-specs">
              <div><dt>Setup</dt><dd className="num">{euro(def?.setup ?? 0)}</dd></div>
              <div><dt>Upkeep</dt><dd className="num">{euro(def?.upkeep ?? 0)} / month</dd></div>
            </dl>
            <div className="shop-buy"><span className="grow" />{state}</div>
          </div>
        );
      })}
    </div>
  );
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
        {locked ? <span className="pill">Needs {CHANNEL_NAME[def.needs!]}</span> : running ? <span className="pill accent">Running</span> : <span className="pill">Off</span>}
      </div>
      <dl className="shop-specs mkt-specs">
        <div><dt>Cost per lead</dt><dd className="num">{Math.min(...costs) === Math.max(...costs) ? euro(costs[0]) : `${euro(Math.min(...costs))} to ${euro(Math.max(...costs))}`}</dd></div>
        <div><dt>Conversion</dt><dd>{def.conversion < 1 ? "Low" : def.conversion > 1 ? "High" : "Normal"}</dd></div>
        <div><dt>Leads this month</dt><dd className="num">{leads(expected)}</dd></div>
      </dl>
      {!locked && <>
        <div className="mkt-row">
          <span className="mkt-label">Audience</span>
          <div className="mkt-chips">
            {reach(channel).map((p) => (
              <button key={p} className="mkt-chip" aria-pressed={profiles.includes(p)} onClick={() => toggle(p)}>{AUDIENCE[p]}</button>
            ))}
          </div>
        </div>
        {def.discount && (
          <div className="mkt-row">
            <span className="mkt-label">Discount</span>
            <div className="seg" role="group" aria-label="Discount">
              {DISCOUNTS.map((d) => (
                <button key={d} aria-pressed={discount === d} onClick={() => apply({ discount: d })}>
                  {d ? pct(d) : "None"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mkt-row">
          <span className="mkt-label">Budget</span>
          <div className="seg" role="group" aria-label="Monthly budget">
            <button aria-pressed={!running} onClick={() => apply({ budget: null })}>Off</button>
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
      <thead><tr><th>Audience</th><th>Awareness</th><th className="mkt-right">Leads this month</th></tr></thead>
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
    <span className="mkt-stars" aria-label={`${n} of 5 stars`}>
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
        <span className="num">{game.marketing.reviews.length} {game.marketing.reviews.length === 1 ? "review" : "reviews"}</span>
      </div>
      <h3 className="mkt-h">Review platforms</h3>
      <div className="shop-grid mkt-flat">
        {(Object.keys(PLATFORMS) as PlatformId[]).map((id) => {
          const p = PLATFORMS[id], active = game.marketing.platform === id;
          return (
            <div key={id} className="shop-card">
              <div className="shop-name"><strong>{p.name}</strong></div>
              <dl className="shop-specs">
                <div><dt>Fee</dt><dd className="num">{euro(p.fee)} / month</dd></div>
                <div><dt>Review invites</dt><dd className="num">{p.invite ? `${pct(p.invite)} / month` : "None"}</dd></div>
                <div><dt>Trust bonus</dt><dd className="num">+{p.trust}</dd></div>
              </dl>
              <div className="shop-buy">
                {active && <span className="pill ok">Active</span>}
                <span className="grow" />
                {active
                  ? <button className="btn" onClick={() => act(setReviewPlatform, null)}>Cancel</button>
                  : p.fee > 0 && !manager ? <span className="pill">Needs a marketing manager</span>
                  : <button className="btn primary" onClick={() => act(setReviewPlatform, id)}>Sign up</button>}
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="mkt-h">Recent reviews</h3>
      {recent.length ? <ul className="mkt-review-list">{recent.map((r, i) => <ReviewRow key={`${r.hour}-${r.customerId}-${i}`} r={r} />)}</ul>
        : <div className="shop-none mkt-none">No reviews yet.</div>}
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
      <div className="mkt-score"><span>Network contacts</span><span className="num">{pct(tradeFairBonus(game))}</span></div>
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
  if (booking) state = <span className="pill accent">Booked · {game.staff.find((e) => e.id === booking.employeeId)?.name ?? "Nobody"}</span>;
  else if (d.start <= game.hour) state = <span className="pill">Under way</span>;
  else if (level < fair.level) state = <span className="pill">Needs level <span className="num">{fair.level}</span></span>;
  else if (!game.staff.length) state = <span className="pill">Needs an employee</span>;
  else state = <button className="btn primary" disabled={!who || game.cash < cost} onClick={() => who && act(bookFair, fair.id, who)}>Book</button>;
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{fair.name}</strong><span>{fair.city} · {formatDay(d.start)}{fair.days > 1 && <> to {formatDay(d.end - 24)}</>}</span></div>
      <dl className="shop-specs">
        <div><dt>Cost</dt><dd className="num">{euro(cost)}</dd></div>
        <div><dt>Company level</dt><dd className="num">{fair.level}</dd></div>
        <div><dt>Leads</dt><dd className="num">{fair.leads || "None"}</dd></div>
        <div><dt>Audience</dt><dd>{fair.profiles.length ? fair.profiles.map((p) => AUDIENCE[p]).join(", ") : "Networks"}</dd></div>
        <div><dt>Network contacts</dt><dd className="num">+{pct(fair.bonus)}</dd></div>
      </dl>
      {open && free.length > 0 && (
        <div className="mkt-row">
          <span className="mkt-label">Attendee</span>
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
      {list.length
        ? <div className="shop-grid mkt-flat">{list.map((x) => <SponsorCard key={x.id} sp={x} />)}</div>
        : <div className="shop-none mkt-none">No sponsorships yet.</div>}
    </div>
  );
}

function SponsorCard({ sp }: { sp: Sponsorship }) {
  const ev = eventById(sp.event)!, r = sp.reward;
  const down = Math.ceil(Math.max(0, ...Object.values(sp.down)));
  const state = sp.status === "running" ? <span className="pill accent">Running</span> : r ? <span className="pill ok">Rewarded</span> : <span className="pill bad">Failed</span>;
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{ev.name}</strong><span>{formatDay(sp.startedAt)} to {formatDay(sp.endedAt ?? sp.endsAt)}</span></div>
      <dl className="shop-specs">
        <div><dt>Services</dt><dd className="num">{ev.count} × {PRODUCT[ev.product]}</dd></div>
        <div><dt>Audience</dt><dd>{ev.audience.map((p) => AUDIENCE[p]).join(", ")}</dd></div>
        <div><dt>Hours down</dt><dd className="num">{down}</dd></div>
        {r && r.knowHow > 0 && <div><dt>Know-how</dt><dd className="num">+{r.knowHow}</dd></div>}
        {r && r.awareness > 0 && <div><dt>Awareness</dt><dd className="num">+{pct(r.awareness)}</dd></div>}
        {r && r.leads > 0 && <div><dt>Leads</dt><dd className="num">{r.leads}</dd></div>}
        {r?.stars && <div><dt>Review</dt><dd className="num">{r.stars} stars</dd></div>}
        {r?.recommendation && <div><dt>Recommendation</dt><dd>Candidate in the Staff market</dd></div>}
        {sp.status === "done" && !r && <div><dt>Reviews</dt><dd className="num">{FAIL_REVIEWS} × 1 star</dd></div>}
        {sp.status === "done" && !r && <div><dt>Awareness</dt><dd className="num">-{pct(1 - FAIL_AWARENESS)}</dd></div>}
      </dl>
      <div className="shop-buy"><span className="grow" />{state}</div>
    </div>
  );
}
