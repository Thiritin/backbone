import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { CSSProperties } from "react";
import { t } from "../../../i18n/en";
import { yearOf } from "../../../sim/00-core/time";
import { PRODUCTS } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { companyDomain } from "../../../sim/30-customers/domains";
import type { GameState } from "../../../sim/50-state";
import { euro } from "../../../sim/00-core/money";
import { hasOrderForm, OWNED, owns } from "../../../sim/80-business/marketing";
import { setUpChannel } from "../../../sim/90-actions/marketing";
import { lineBlocker, listed, SITE_LINES } from "../../../sim/80-business/website";
import { setLine } from "../../../sim/90-actions/website";
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
  domain: "", ssl: "",
};

export function WebsiteApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
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
      </nav>
      <div className="web-browser">
        <div className="web-bar">
          <ArrowLeft aria-hidden /><ArrowRight aria-hidden /><RotateCw aria-hidden />
          <div className="web-url">http://www.{companyDomain(game)}/</div>
        </div>
        <div className="web-view"><Site game={game} /></div>
      </div>
    </div>
  );
}

function Site({ game }: { game: GameState }) {
  const lines = SITE_LINES.filter((p) => listed(game, p));
  const form = hasOrderForm(game), domain = companyDomain(game);
  const city = game.locations[0]?.city ?? "Frankfurt";
  return (
    <div className={`site${owns(game, "website") ? " designed" : ""}`} style={{ "--brand": game.company.color } as CSSProperties}>
      <header className="site-head">
        <CompanyMark company={game.company} className="co-mark site-logo" />
        <h1>{game.company.name}</h1>
      </header>
      <p className="site-pitch">Web hosting and servers from {city}. Our machines run day and night, and so do we.</p>
      <h2>Products</h2>
      {lines.length ? (
        <div className="site-products">
          {lines.map((p) => (
            <section key={p} className="site-product">
              <h3>{PRODUCT[p]}</h3>
              <p>{BLURB[p]}</p>
              <p className="site-plans">{PRODUCTS[p].plans.map((x) => x.name).join(" | ")}</p>
              {form ? <span className="site-button">Order</span> : <span className="site-link">Order by email</span>}
            </section>
          ))}
        </div>
      ) : <p className="site-empty">This page is under construction.</p>}
      <footer className="site-foot">
        <span>Contact: <span className="site-link">sales@{domain}</span></span>
        <span>&copy; {yearOf(game.hour)} {game.company.name}</span>
      </footer>
    </div>
  );
}
