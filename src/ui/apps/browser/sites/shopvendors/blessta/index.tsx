import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euro, euroPrice } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { tiersOf } from "../../../../../../sim/10-catalog/licence-tiers";
import { hasModule, MODULES } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { shopEra, shopLicence } from "../../../../../../sim/10-catalog/shop-licences";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { releasedAt } from "../../../../../../sim/10-catalog/software-versions";
import type { GameState, Licence } from "../../../../../../sim/50-state";
import { keyExpired, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { displayHost } from "../../../../../../sim/80-business/browser";
import { bought } from "../../../../../../sim/80-business/licences";
import { shopUpdatesFee } from "../../../../../../sim/80-business/shop";
import { keysOf, upgradeOffers } from "../../../../../../sim/80-business/vendor-shop";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { renewShopUpdates } from "../../../../../../sim/90-actions/shop";
import { addToCart, cancelLicence } from "../../../../../../sim/90-actions/vendor-shop";
import { formatDay } from "../../../../billing/format";
import { feeText } from "../../../../marketing/payments";
import { usePageAct } from "../../../pageAct";
import { Cart, cartCount, Editions } from "../../shop/VendorShop";
import { Releases } from "../../software/Releases";
import { Mark } from "../../portal/blessta";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

const ID = "blessta", HOST = shopLicence(ID).site!.host;
type Page = "home" | "pricing" | "extensions" | "releases" | "download" | "account" | "cart";
const PAGES: Page[] = ["home", "pricing", "extensions", "releases", "download", "account", "cart"];
// The site of 2007 to 2012 is a fixed page with a sidebar, 2013 to 2020 flat full-width bands, 2021 on dark and rounded.
type Era = "classic" | "flat" | "modern";
const eraOf = (year: number): Era => (year < 2013 ? "classic" : year < 2021 ? "flat" : "modern");

export function Blessta({ game, path = "/", go }: VendorProps) {
  const year = yearOf(game.hour), era = eraOf(year), name = shopById(ID).name;
  const page = PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
  const to = (p: Page) => go?.(`${displayHost(HOST)}${p === "home" ? "/" : `/${p}`}`);
  const link = (p: Page, label: string, cls?: string) =>
    <a key={p} href={`#${p}`} className={cls} aria-current={p === page ? "page" : undefined} onClick={(e) => { e.preventDefault(); to(p); }}>{label}</a>;
  const latest = releasedAt(ID, game.hour).at(-1);
  const nav: [Page, string][] = [
    ["pricing", t("blessta.v.pricing")], ["extensions", t("blessta.v.extensions")], ["releases", t("blessta.v.releases")], ["download", t("blessta.v.download")],
    ["account", t("vendor-shop.myAccount")], ["cart", t("vendor-shop.cart", { n: cartCount(game, HOST) })],
  ];
  const body: Record<Page, () => ReactNode> = {
    home: () => <Home era={era} link={link} />,
    pricing: () => <Pricing game={game} />,
    extensions: () => <Extensions game={game} />,
    releases: () => <Releases p={{ id: ID, name, site: shopLicence(ID).site! }} page="versions" hour={game.hour} />,
    download: () => <Download game={game} />,
    account: () => <Account game={game} to={to} />,
    cart: () => <Cart host={HOST} btn="bv-btn" account={() => to("account")} />,
  };
  return (
    <div className={`bv bv-${era}`}>
      <header className="bv-head">
        <div className="bv-wrap">
          <a href="#home" className="bv-logo" onClick={(e) => { e.preventDefault(); to("home"); }}><Mark />{name.toLowerCase()}</a>
          <nav className="bv-nav">{nav.map(([p, label]) => link(p, label))}</nav>
        </div>
      </header>
      {page === "home" && (
        <section className="bv-hero">
          <div className="bv-wrap">
            <p className="bv-tagline">{t("blessta.v.tagline")}</p>
            <h1>{t("blessta.v.headline")}</h1>
            <p className="bv-pitch">{t("blessta.v.pitch")}</p>
            <p className="bv-ctas">{link("pricing", t("blessta.v.seePricing"), "bv-btn")}{link("download", t("blessta.v.download"), "bv-btn bv-ghost")}</p>
            {latest && era !== "classic" && <p className="bv-latest">{t("blessta.v.latest")}: <strong>{name} {latest.version}</strong></p>}
          </div>
        </section>
      )}
      <div className="bv-wrap bv-body">
        <main className="bv-main">
          {page !== "home" && <h1 className="bv-title">{page === "cart" ? t("vendor-shop.cart", { n: 0 }) : nav.find(([p]) => p === page)![1]}</h1>}
          {body[page]()}
        </main>
        {era === "classic" && (
          <aside className="bv-side">
            {latest && <section><h2>{t("blessta.v.latest")}</h2><p><strong>{name} {latest.version}</strong><br />{formatDay(latest.release)}</p>{link("download", t("blessta.v.download"))}</section>}
          </aside>
        )}
      </div>
      <footer className="bv-foot"><div className="bv-wrap">{t("shop-link.footer", { year, maker: shopById(ID).maker })}</div></footer>
    </div>
  );
}

const FEATURES = [0, 1, 2, 3];
function Home({ era, link }: { era: Era; link: (p: Page, label: string, cls?: string) => ReactNode }) {
  return (
    <>
      <ul className="bv-features">{FEATURES.map((i) => <li key={i}><h3>{t(`blessta.v.f${i}`)}</h3><p>{t(`blessta.v.f${i}Text`)}</p></li>)}</ul>
      {era !== "classic" && <p className="bv-cta-row">{link("pricing", t("blessta.v.seePricing"), "bv-btn")}</p>}
    </>
  );
}

// Editions with the Add to cart buttons, then what a perpetual key includes.
function Pricing({ game }: { game: GameState }) {
  const era = shopEra(ID, game.hour), once = era.kind === "once";
  return (
    <>
      <Editions product={ID} btn="bv-btn" />
      {once && (
        <table className="bv-terms">
          <tbody>
            <tr><th>{t("blessta.v.updatesIncluded")}</th><td className="num">{t("blessta.v.months", { n: era.updates ?? 12 })}</td></tr>
            <tr><th>{t("blessta.v.updatesYearly")}</th><td className="num">{era.updatesFee ? euroPrice(era.updatesFee) : t("blessta.v.free")}</td></tr>
            {era.upgrade !== undefined && <tr><th>{t("blessta.v.upgradePrice")}</th><td className="num">{euroPrice(era.upgrade)}</td></tr>}
          </tbody>
        </table>
      )}
    </>
  );
}

// The shop modules every vendor sells: Shop link and the payment methods of the year.
function Extensions({ game }: { game: GameState }) {
  const act = usePageAct(), year = yearOf(game.hour);
  return (
    <ul className="bv-modules">
      {MODULES.filter((m) => m.vendor === "shop" && m.year <= year).map((m) => (
        <li key={m.id}>
          <h3>{t(`vendor-sites.module.${m.id}`)}</h3>
          <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
          <p className="num"><strong>{euro(m.price)}</strong> {t("vendor-sites.licence")}{m.id !== "shop-link" && <> · {t("payment-methods.fee")} {feeText(methodById(m.id as MethodId))}</>}</p>
          {hasModule(game, m.id) && game.shop.variant === ID ? <span className="bv-state">{t("vendor-sites.registered")}</span>
            : bought(game, m.id) ? <span className="bv-state">{t("vendor-sites.bought")}</span>
            : <button type="button" className="bv-btn" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>}
        </li>
      ))}
    </ul>
  );
}

function Download({ game }: { game: GameState }) {
  const name = shopById(ID).name, latest = releasedAt(ID, game.hour).at(-1);
  return (
    <>
      {latest && <p className="bv-version">{t("blessta.v.current")}: <strong className="num">{name} {latest.version}</strong></p>}
      <ol className="bv-steps">
        <li>{t("blessta.v.step0")}</li>
        <li>{t("blessta.v.step1")}</li>
        <li>{t("blessta.v.step2", { name, section: t("host.shop"), button: t("host.installShop", { name }) })}</li>
        <li>{t("blessta.v.step3", { name, days: shopLicence(ID).trialDays ?? 0 })}</li>
      </ol>
    </>
  );
}

function CopyKey({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => setDone(true), () => {});
  return <button type="button" className="bv-btn bv-ghost bv-small" onClick={copy}>{done ? t("blessta.v.copied") : t("blessta.v.copy")}</button>;
}

const installation = (s: GameState, k: Licence) => (k.machineId === SHOP_MACHINE ? `portal.${companyDomain(s)}` : t("vendor-shop.unassigned"));

// The player's Blessta keys: what each covers and where it runs, with renewal, upgrade and copy.
function Account({ game, to }: { game: GameState; to: (p: Page) => void }) {
  const act = usePageAct(), keys = keysOf(game, HOST), ups = upgradeOffers(game, ID);
  if (!keys.length) return <p>{t("vendor-shop.noLicences")}</p>;
  const edition = (k: Licence) => tiersOf(ID).find((x) => x.id === k.edition)?.name ?? t(k.covers.kind === "version" ? "shop-admin.owned" : "shop-admin.leased");
  const covered = (k: Licence) => keyExpired(game, k) ? t("vendor-shop.expired")
    : k.covers.kind === "version" ? t("vendor-shop.version", { major: k.covers.major })
    : k.renewsAt === null ? t("vendor-shop.endsOn", { date: formatDay(k.covers.until) }) : t("vendor-shop.renewsOn", { date: formatDay(k.renewsAt) });
  const actions = (k: Licence) => {
    const fee = k.machineId === SHOP_MACHINE && game.shop.variant === ID && k.updatesUntil !== undefined ? shopUpdatesFee(game, k) : undefined;
    const c = k.covers, up = c.kind === "version" ? ups.find((o) => o.from === c.major) : undefined;
    return (
      <>
        {fee !== undefined && <button type="button" className="bv-btn bv-small" onClick={() => act(renewShopUpdates)}>{t("blessta.v.renew", { fee: euroPrice(fee) })}</button>}
        {up && <button type="button" className="bv-btn bv-small" onClick={() => { if (act(addToCart, ID, null, up.from).ok) to("cart"); }}>{t("blessta.v.upgrade", { major: up.to, fee: euroPrice(up.fee) })}</button>}
        {k.covers.kind === "term" && k.renewsAt !== null && !keyExpired(game, k) && <button type="button" className="bv-btn bv-ghost bv-small" onClick={() => act(cancelLicence, k.id)}>{t("vendor-shop.cancel")}</button>}
      </>
    );
  };
  return (
    <div className="bv-keys">
      {keys.map((k) => (
        <article key={k.id} className="bv-key">
          <dl>
            <dt>{t("vendor-shop.edition")}</dt><dd>{edition(k)}</dd>
            <dt>{t(k.covers.kind === "version" ? "blessta.v.covers" : "vendor-shop.status")}</dt><dd>{covered(k)}</dd>
            <dt>{t("blessta.v.installation")}</dt><dd>{installation(game, k)}</dd>
            {k.updatesUntil !== undefined && <><dt>{t("shop-admin.updatesUntil")}</dt><dd className="num">{formatDay(k.updatesUntil)}</dd></>}
            <dt>{t("vendor-shop.key")}</dt><dd><code className="shop-key">{k.key}</code><CopyKey text={k.key} /></dd>
          </dl>
          <div className="bv-actions">{actions(k)}</div>
        </article>
      ))}
    </div>
  );
}
