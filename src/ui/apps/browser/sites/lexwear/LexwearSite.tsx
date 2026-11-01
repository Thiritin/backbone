import type { CSSProperties, MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { hasModule, moduleById, MODULES, type Module } from "../../../../../sim/10-catalog/modules";
import type { GameState } from "../../../../../sim/50-state";
import { bought, LEXWEAR, LEXWEAR_HOST, lexwearUrl } from "../../../../../sim/80-business/lexwear";
import { addToCart } from "../../../../../sim/90-actions/vendor-shop";
import { useStore } from "../../../../store";
import { Account, Cart, cartCount } from "../shop/VendorShop";
import "./lexwear.css";

const SUPPORT = `www.${LEXWEAR_HOST}/support`, CART = `www.${LEXWEAR_HOST}/cart`, ACCOUNT = `www.${LEXWEAR_HOST}/account`;
const name = (m: Module) => t(`vendor-sites.module.${m.id}`);

// A software box drawn in CSS, its spine in the module's colour.
const HUE: Record<string, number> = { "helpdesk-link": 250, "monthly-run": 150, "match-by-reference": 60, "auto-reminders": 20, hbci: 300 };
const Box = ({ m, big }: { m: Module; big?: boolean }) => (
  <div className={big ? "lx-box big" : "lx-box"} style={{ "--lx-hue": HUE[m.id] ?? 0 } as CSSProperties} aria-hidden="true">
    <span className="lx-box-brand">{LEXWEAR}</span>
    <span className="lx-box-name">{name(m)}</span>
  </div>
);

function Buy({ game, m }: { game: GameState; m: Module }) {
  const act = useStore((s) => s.act);
  if (hasModule(game, m.id)) return <span className="lx-state">{t("vendor-sites.registered")}</span>;
  if (bought(game, m.id)) return <span className="lx-state">{t("vendor-sites.bought")}</span>;
  if (game.cart.some((l) => l.product === m.id)) return <span className="lx-state">{t("vendor-shop.inCart")}</span>;
  return <button type="button" className="lx-buy" onClick={() => act(addToCart, m.id, null)}>{t("vendor-shop.addToCart")}</button>;
}

export function LexwearSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const year = yearOf(game.hour);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const id = /^\/module\/([\w-]+)/.exec(path)?.[1];
  const m = id ? moduleById(id) : undefined;
  const shown = MODULES.filter((x) => x.year <= year);
  const page = m && m.year <= year ? "module" : (["support", "cart", "account"].find((x) => path.startsWith(`/${x}`)) ?? "home");
  const nav: [string, string, string][] = [
    ["home", t("vendor-sites.navModules"), lexwearUrl()], ["cart", t("vendor-shop.cart", { n: cartCount(game, LEXWEAR_HOST) }), CART],
    ["account", t("vendor-shop.myAccount"), ACCOUNT], ["support", t("vendor-sites.navSupport"), SUPPORT],
  ];
  return (
    <div className="lx">
      <div className="lx-page">
        <header className="lx-head">
          <span className="lx-logo">lex<b>wear</b></span>
          <span className="lx-tag">{t("vendor-sites.tagline")}</span>
        </header>
        <nav className="lx-nav">
          {nav.map(([k, label, url]) => <a key={k} href={`#${k}`} aria-current={k === page || (k === "home" && page === "module") ? "page" : undefined} onClick={link(url)}>{label}</a>)}
        </nav>
        <main className="lx-main">
          {page === "module" && m && (
            <section className="lx-product">
              <Box m={m} big />
              <div>
                <h1>{name(m)}</h1>
                <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
                <table className="lx-price">
                  <tbody>
                    <tr><th>{t("vendor-sites.price")}</th><td><span className="num lx-amount">{euro(m.price)}</span> {t("vendor-sites.licence")}</td></tr>
                  </tbody>
                </table>
                <Buy game={game} m={m} />
              </div>
            </section>
          )}
          {page === "cart" && <><h1>{t("vendor-shop.cart", { n: 0 })}</h1><Cart host={LEXWEAR_HOST} btn="lx-buy" account={() => go(ACCOUNT)} /></>}
          {page === "account" && <><h1>{t("vendor-shop.myAccount")}</h1><Account host={LEXWEAR_HOST} btn="lx-buy" /></>}
          {page === "support" && <><h1>{t("vendor-sites.navSupport")}</h1><p>{t("vendor-sites.support")}</p></>}
          {page === "home" && (
            <>
              <h1>{t("vendor-sites.heading")}</h1>
              <p>{t("vendor-sites.intro")}</p>
              <ul className="lx-list">
                {shown.map((x) => (
                  <li key={x.id}>
                    <Box m={x} />
                    <div className="lx-item">
                      <h2><a href={`#${x.id}`} onClick={link(lexwearUrl(x.id))}>{name(x)}</a></h2>
                      <p>{t(`vendor-sites.pitch.${x.id}`)}</p>
                      <div className="lx-row">
                        <span className="num lx-amount">{euro(x.price)}</span>
                        <a href={`#${x.id}`} onClick={link(lexwearUrl(x.id))}>{t("vendor-sites.details")}</a>
                        <Buy game={game} m={x} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
        <footer className="lx-foot">{t("vendor-sites.footer", { year })}</footer>
      </div>
    </div>
  );
}
