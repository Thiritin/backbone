import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euro } from "../../../../../../sim/00-core/money";
import { dateOf, yearOf } from "../../../../../../sim/00-core/time";
import { hasModule, MODULES, type Module } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { shopEra } from "../../../../../../sim/10-catalog/shop-licences";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { nextMajor, releasedAt, versionAt, versionInfo } from "../../../../../../sim/10-catalog/software-versions";
import { displayHost } from "../../../../../../sim/80-business/browser";
import { portalPath } from "../../../../../../sim/80-business/portal";
import { bought } from "../../../../../../sim/80-business/licences";
import { shopHost } from "../../../../../../sim/80-business/shoplink";
import { upgradeShop } from "../../../../../../sim/90-actions/shop";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { useStore } from "../../../../../store";
import { feeText } from "../../../../marketing/payments";
import { usePageAct } from "../../../pageAct";
import { Account, Cart, cartCount } from "../../shop/VendorShop";
import { eraOfMajor, Mark } from "../../portal/orderbocks";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

// orderbocks.com, ResellerKlub's site for OrderBocks; its look follows the newest release of the game month.
const ID = "orderBocks", HOST = shopHost(ID);
const PAGES = ["home", "pricing", "releases", "install", "cart", "account"] as const;
type Page = (typeof PAGES)[number];
const pageOf = (path = ""): Page => PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
const month = (hour: number | null) => (hour === null ? t("releases.notSet") : dateOf(hour).toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" }));

function Home({ link }: { link: (to: Page, text: string) => ReactNode }) {
  return (
    <>
      <section className="obv-hero">
        <h1><Mark /></h1>
        <p>{t("orderbocks.v.pitch")}</p>
        {link("pricing", t("orderbocks.v.seePricing"))}
      </section>
      <ul className="obv-features">{[0, 1, 2].map((i) => <li key={i}><h3>{t(`orderbocks.v.f${i}`)}</h3><p>{t(`orderbocks.v.f${i}.text`)}</p></li>)}</ul>
    </>
  );
}

// OrderBocks itself costs nothing and keeps a share of the orders; the add-on modules are sold here as before.
function Pricing({ game }: VendorProps) {
  const act = usePageAct(), era = shopEra(ID, game.hour), year = yearOf(game.hour);
  const modules = MODULES.filter((m) => m.vendor === "shop" && m.year <= year);
  const state = (m: Module) => hasModule(game, m.id) && game.shop.variant === ID ? <span className="obv-state">{t("vendor-sites.registered")}</span>
    : bought(game, m.id) ? <span className="obv-state">{t("vendor-sites.bought")}</span>
    : <button type="button" className="obv-btn" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>;
  return (
    <>
      <h1>{t("orderbocks.v.pricing")}</h1>
      <table className="obv-table">
        <thead><tr><th>{t("vendor-shop.edition")}</th><th>{t("vendor-shop.price")}</th><th>{t("orderbocks.v.share")}</th></tr></thead>
        <tbody><tr>
          <td>{shopById(ID).name} {versionAt(ID, game.hour).major}</td><td>{t("orderbocks.v.free")}</td>
          <td className="num">{t("orderbocks.v.shareValue", { pct: Math.round((era.cut ?? 0) * 100) })}</td>
        </tr></tbody>
      </table>
      {modules.length > 0 && <h2>{t("orderbocks.v.addons")}</h2>}
      <table className="obv-table">
        <tbody>{modules.map((m) => (
          <tr key={m.id}>
            <td><b>{t(`vendor-sites.module.${m.id}`)}</b><p>{t(`vendor-sites.pitch.${m.id}`)}</p></td>
            <td className="num">{euro(m.price)}<br />{m.id !== "shop-link" && feeText(methodById(m.id as MethodId))}</td>
            <td>{state(m)}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

function Releases({ game }: VendorProps) {
  return (
    <>
      <h1>{t("orderbocks.v.releases")}</h1>
      <table className="obv-table">
        <thead><tr><th>{t("releases.version")}</th><th>{t("releases.released")}</th><th>{t("orderbocks.v.whatsNew")}</th></tr></thead>
        <tbody>{releasedAt(ID, game.hour).reverse().map((v) => (
          <tr key={v.version}><td className="num">{v.version}</td><td className="num">{month(v.release)}</td><td>{t(`orderbocks.v.notes.${v.major}`)}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

function Install({ game }: VendorProps) {
  const url = `portal.${game.company.domain ?? ""}${portalPath(ID, "admin")}`;
  return (
    <>
      <h1>{t("orderbocks.v.install")}</h1>
      <ol className="obv-steps">{[0, 1, 2].map((i) => <li key={i}>{t(`orderbocks.v.step${i}`, { name: shopById(ID).name, url })}</li>)}</ol>
    </>
  );
}

// The installation the account runs, with the free move to the next major; keys bought elsewhere show below it.
function MyAccount({ game }: VendorProps) {
  const act = usePageAct(), at = game.shop.variant === ID ? game.shop.install : null;
  const info = at ? versionInfo(ID, at.version) : undefined, next = at ? nextMajor(ID, at.version, game.hour) : null;
  return (
    <>
      <h1>{t("vendor-shop.myAccount")}</h1>
      {!at ? <p>{t("orderbocks.v.noInstall")}</p> : (
        <table className="obv-table">
          <thead><tr><th>{t("vendor-shop.product")}</th><th>{t("vendor-shop.edition")}</th><th>{t("releases.version")}</th><th>{t("orderbocks.v.installation")}</th><th>{t("releases.updatesUntil")}</th><th /></tr></thead>
          <tbody><tr>
            <td>{shopById(ID).name}</td><td>{t("orderbocks.v.free")}</td><td className="num">{at.version}</td>
            <td>{game.clusters.find((c) => c.id === at.clusterId)?.name ?? at.clusterId}</td><td className="num">{month(info?.updatesUntil ?? null)}</td>
            <td>{next && <button type="button" className="obv-btn" onClick={() => act(upgradeShop)}>{t("orderbocks.v.upgradeTo", { major: next.major })}</button>}</td>
          </tr></tbody>
        </table>
      )}
      <Account host={HOST} btn="obv-btn" />
    </>
  );
}

export function OrderBocks({ game, path, go }: VendorProps) {
  const page = pageOf(path), era = eraOfMajor(versionAt(ID, game.hour).major);
  const n = useStore((s) => cartCount(s.game, HOST));
  const to = (p: Page) => go?.(`${displayHost(HOST)}${p === "home" ? "/" : `/${p}`}`);
  const link = (p: Page, text: string, cls = "obv-cta") => <a href="#" className={cls} onClick={(e) => { e.preventDefault(); to(p); }}>{text}</a>;
  const labels: Record<Page, string> = {
    home: t("orderbocks.v.home"), pricing: t("orderbocks.v.pricing"), releases: t("orderbocks.v.releases"), install: t("orderbocks.v.install"),
    cart: t("vendor-shop.cart", { n }), account: t("vendor-shop.myAccount"),
  };
  const body = page === "pricing" ? <Pricing game={game} /> : page === "releases" ? <Releases game={game} /> : page === "install" ? <Install game={game} />
    : page === "cart" ? <><h1>{t("vendor-shop.cart", { n: 0 })}</h1><Cart host={HOST} btn="obv-btn" account={() => to("account")} /></>
    : page === "account" ? <MyAccount game={game} /> : <Home link={link} />;
  return (
    <div className={`obv obv-${era}`}>
      <header className="obv-head">
        <a href="#" className="obv-logo" onClick={(e) => { e.preventDefault(); to("home"); }}><Mark /></a>
        <span className="obv-maker">{shopById(ID).maker}</span>
      </header>
      <nav className="obv-nav">{PAGES.map((p) => <a key={p} href="#" className={p === page ? "on" : ""} onClick={(e) => { e.preventDefault(); to(p); }}>{labels[p]}</a>)}</nav>
      <main className={`obv-main obv-${page}`}>{body}</main>
      <footer className="obv-foot">{t("shop-link.footer", { year: yearOf(game.hour), maker: shopById(ID).maker })}</footer>
    </div>
  );
}
