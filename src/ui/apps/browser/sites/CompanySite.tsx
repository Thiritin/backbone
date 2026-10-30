import type { CSSProperties } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { euroCents } from "../../../../sim/00-core/money";
import { PRODUCTS } from "../../../../sim/10-catalog/products";
import type { Product } from "../../../../sim/30-customers/customers";
import { companyDomain } from "../../../../sim/30-customers/domains";
import type { GameState } from "../../../../sim/50-state";
import { owns } from "../../../../sim/80-business/marketing";
import { siteContent } from "../../../../sim/80-business/website";
import { CompanyMark } from "../../company";
import { PRODUCT } from "../../support/labels";
import "./site.css";

// The company's own copy on its website.
export const BLURB: Record<Product, string> = {
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
  ssl: "Puts the padlock in your visitors' address bar with a certificate for your domain.",
  domain: "",
};

export function CompanySite({ game, onAdmin }: { game: GameState; onAdmin: () => void }) {
  const { lines, email } = siteContent(game);
  const domain = companyDomain(game), city = game.locations[0]?.city ?? "Frankfurt";
  return (
    <div className={`site${owns(game, "website") ? ` designed g${Math.min(2025, game.marketing.designYear)}` : ""}`} style={{ "--brand": game.company.color } as CSSProperties}>
      <header className="site-head">
        <CompanyMark company={game.company} className="co-mark site-logo" />
        <div className="site-name">
          <h1>{game.company.name}</h1>
          {game.company.tagline && <p className="site-tagline">{game.company.tagline}</p>}
        </div>
      </header>
      <button className="site-admin" onClick={onAdmin}>Admin</button>
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
