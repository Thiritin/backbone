import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { CSSProperties } from "react";
import { t } from "../../../i18n/en";
import { yearOf } from "../../../sim/00-core/time";
import type { Product } from "../../../sim/30-customers/customers";
import { companyDomain } from "../../../sim/30-customers/domains";
import type { GameState } from "../../../sim/50-state";
import { euro, euroCents } from "../../../sim/00-core/money";
import { PRODUCTS } from "../../../sim/10-catalog/products";
import { hasOrderForm, OWNED, owns } from "../../../sim/80-business/marketing";
import { setUpChannel } from "../../../sim/90-actions/marketing";
import { generationOf, lineBlocker, listed, SITE_LINES, SITE_RENT, siteContent, siteRoom, siteStatus, type SiteStatus } from "../../../sim/80-business/website";
import { redesign, setEmailOrders, setLine, setSiteHost } from "../../../sim/90-actions/website";
import { useStore } from "../../store";
import { CompanyMark } from "../company";
import { PRODUCT } from "../support/labels";
import "./website.css";

// The company's own copy on its website.
const BLURB: Record<Product, string> = {
  webHosting: "Puts your website online with PHP and a MySQL database.",
  vps: "Gives you a virtual server of your own with full root access.",
  gameServer: "Keeps your game server running while you sleep, so your clan does not have to.",
  dns: "Answers the DNS queries for your domains.",
  vpn: "Connects your office to the internet through an encrypted tunnel.",
  storage: "Keeps your files on disks that we look after.",
  cloud: "Runs your servers on a cluster that moves them when a host fails.",
  dedicated: "Rents you a whole physical server by the month.",
  colocation: "Houses your own servers in our racks with power and network.",
  gpu: "Rents you virtual servers with graphics cards for training and rendering.",
  domain: "", ssl: "",
};

const STATUS: Record<SiteStatus, [string, string]> = { up: ["Up", "ok"], slow: ["Slow", "warn"], down: ["Down", "bad"] };

export function WebsiteApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const { siteHost, designYear } = game.marketing, status = siteStatus(game), [statusLabel, statusTone] = STATUS[status];
  const panels = game.clusters.filter((c) => c.kind === "panel" && c.panel);
  const hostName = siteHost.kind === "own" ? game.clusters.find((c) => c.id === siteHost.clusterId)?.name ?? "Missing host" : "Strateaux";
  const current = designYear >= generationOf(yearOf(game.hour));
  return (
    <div className="web">
      <nav className="sidebar web-side" aria-label="Products on the website">
        <div className="side-h">Products</div>
        {SITE_LINES.map((p) => {
          const on = listed(game, p), why = lineBlocker(game, p);
          return (
            <div key={p} className="web-line">
              <label className="web-line-row">
                <span>{PRODUCT[p]}</span>
                <input type="checkbox" role="switch" className="switch" aria-label={`List ${PRODUCT[p]}`} checked={on} disabled={!on && !!why}
                  onChange={(e) => act((s) => setLine(s, p, e.target.checked))} />
              </label>
              {why && <p className="web-why">{t(why)}</p>}
            </div>
          );
        })}
        <div className="side-h">Site</div>
        {(["website", "orderForm"] as const).map((c) => {
          const def = OWNED[c], blocked = def.needs && !owns(game, def.needs);
          return (
            <div key={c} className="web-line">
              <div className="web-line-row">
                <span>{c === "website" ? "Web design" : "Order form"}</span>
                {owns(game, c) ? <span className="pill ok">Active</span>
                  : <button className="btn" disabled={!!blocked || game.cash < def.setup} onClick={() => act((s) => setUpChannel(s, c))}>Set up</button>}
              </div>
              {!owns(game, c) && <p className="web-why"><span className="num">{euro(def.setup)}</span>, then <span className="num">{euro(def.upkeep)}</span> a month{blocked ? ", after Web design" : ""}</p>}
            </div>
          );
        })}
        {hasOrderForm(game) && (
          <div className="web-line">
            <label className="web-line-row">
              <span>Email orders</span>
              <input type="checkbox" role="switch" className="switch" aria-label="Take orders by email" checked={game.marketing.emailOrders && game.company.mail.kind !== "none"}
                onChange={(e) => act((s) => setEmailOrders(s, e.target.checked))} />
            </label>
          </div>
        )}
        {owns(game, "website") && (
          <div className="web-line">
            <div className="web-line-row">
              <span>Design <span className="num">{designYear}</span></span>
              <button className="btn" disabled={current || game.cash < OWNED.website.setup} onClick={() => act((s) => redesign(s))}>
                Redesign <span className="num">{euro(OWNED.website.setup)}</span>
              </button>
            </div>
          </div>
        )}
        <div className="side-h">Hosting</div>
        <div className="web-line web-host">
          <div className="web-line-row"><span>{hostName}</span><span className={`pill ${statusTone}`}>{statusLabel}</span></div>
          {siteHost.kind === "rented" && <p className="web-why"><span className="num">{euroCents(SITE_RENT)}</span> a month</p>}
          <div className="seg wrap" role="group" aria-label="Host">
            <button aria-pressed={siteHost.kind === "rented"} onClick={() => act((s) => setSiteHost(s, { kind: "rented" }))}>Rented</button>
            {panels.map((c) => (
              <button key={c.id} aria-pressed={siteHost.kind === "own" && siteHost.clusterId === c.id}
                disabled={!siteRoom(game, c).fits && !(siteHost.kind === "own" && siteHost.clusterId === c.id)}
                onClick={() => act((s) => setSiteHost(s, { kind: "own", clusterId: c.id }))}>{c.name}</button>
            ))}
          </div>
        </div>
      </nav>
      <div className="web-browser">
        <div className="web-bar">
          <ArrowLeft aria-hidden /><ArrowRight aria-hidden /><RotateCw aria-hidden />
          <div className="web-url">http://www.{companyDomain(game)}/</div>
        </div>
        {status === "slow" && <div className="web-load" aria-hidden />}
        <div className="web-view">{status === "down" ? <SiteError domain={companyDomain(game)} /> : <Site game={game} />}</div>
      </div>
    </div>
  );
}

function SiteError({ domain }: { domain: string }) {
  return (
    <div className="site-error">
      <h1>This site can't be reached</h1>
      <p>www.{domain} took too long to respond.</p>
    </div>
  );
}

function Site({ game }: { game: GameState }) {
  const { lines, email } = siteContent(game);
  const domain = companyDomain(game), city = game.locations[0]?.city ?? "Frankfurt";
  return (
    <div className={`site${owns(game, "website") ? ` designed g${Math.min(2025, game.marketing.designYear)}` : ""}`} style={{ "--brand": game.company.color } as CSSProperties}>
      <header className="site-head">
        <CompanyMark company={game.company} className="co-mark site-logo" />
        <h1>{game.company.name}</h1>
      </header>
      <p className="site-pitch">Web hosting and servers from {city}. Our machines run day and night, and so do we.</p>
      <h2>Products</h2>
      {lines.length ? (
        <div className="site-products">
          {lines.map(({ product: p, from }) => (
            <section key={p} className="site-product">
              <h3>{PRODUCT[p]}</h3>
              <p>{BLURB[p]}</p>
              {from !== null && (
                <div className="site-order">
                  <span>from <b className="num">{euroCents(from)}</b> {PRODUCTS[p].period === "year" ? "a year" : "a month"}</span>
                  <span className="site-button">Order</span>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : <p className="site-empty">This page is under construction.</p>}
      {email && lines.length > 0 && (
        <>
          <h2>Contact us</h2>
          <p className="site-contact">Tell us what you need and we will send you an offer: <span className="site-link">{email}</span></p>
        </>
      )}
      <footer className="site-foot">
        <span>Contact: <span className="site-link">sales@{domain}</span></span>
        <span>&copy; {yearOf(game.hour)} {game.company.name}</span>
        {owns(game, "website") && game.marketing.designYear === 2005 && <span className="site-counter">{String(1000 + Math.floor(game.hour / 24) * 3).padStart(6, "0")}</span>}
      </footer>
      {owns(game, "website") && game.marketing.designYear >= 2025 && <span className="site-chat" aria-hidden><i /><i /><i /></span>}
    </div>
  );
}
