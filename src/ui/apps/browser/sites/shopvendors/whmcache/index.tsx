import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euro, euroPrice } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { tiersOf } from "../../../../../../sim/10-catalog/licence-tiers";
import { hasModule, MODULES, type Module } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { shopEra, shopLicence } from "../../../../../../sim/10-catalog/shop-licences";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { releasedAt } from "../../../../../../sim/10-catalog/software-versions";
import type { GameState, Licence } from "../../../../../../sim/50-state";
import { keyExpired, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { displayHost } from "../../../../../../sim/80-business/browser";
import { bought } from "../../../../../../sim/80-business/licences";
import { shopUpdatesFee } from "../../../../../../sim/80-business/shop";
import { keysOf, offers, upgradeOffers, type Offer } from "../../../../../../sim/80-business/vendor-shop";
import { renewShopUpdates } from "../../../../../../sim/90-actions/shop";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { addToCart, cancelLicence } from "../../../../../../sim/90-actions/vendor-shop";
import { formatDay } from "../../../../billing/format";
import { feeText } from "../../../../marketing/payments";
import { usePageAct } from "../../../pageAct";
import { Releases } from "../../software/Releases";
import { Cart, cartCount } from "../../shop/VendorShop";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

const ID = "whmCache", HOST = "whmcache.com";
type Page = "home" | "pricing" | "download" | "releases" | "marketplace" | "cart" | "account";
const PAGES: Page[] = ["home", "pricing", "download", "releases", "marketplace", "cart", "account"];
const pageOf = (path = "/"): Page => PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
// The site was rebuilt in 2011 and again in 2018.
const lookAt = (year: number) => (year >= 2018 ? "flat" : year >= 2011 ? "gloss" : "boxed");

type Go = (page: Page) => void;
const link = (on: () => void) => (e: { preventDefault: () => void }) => { e.preventDefault(); on(); };
const A = ({ to, go, className, children }: { to: Page; go: Go; className?: string; children: ReactNode }) =>
  <a href={`#${to}`} className={className} onClick={link(() => go(to))}>{children}</a>;

const Mark = () => <span className="wcv-mark"><b>WHM</b>Cache</span>;

export function WHMCache({ game, path, go: browse }: VendorProps) {
  const year = yearOf(game.hour), look = lookAt(year), page = pageOf(path);
  const go: Go = (p) => browse?.(`${displayHost(HOST)}${p === "home" ? "/" : `/${p}`}`);
  const n = cartCount(game, HOST);
  const label: Record<Page, string> = {
    home: t("shop-whmCache.navHome"), pricing: t("shop-whmCache.navPricing"), download: t("shop-whmCache.navDownload"),
    releases: t("shop-whmCache.navReleases"), marketplace: t("shop-whmCache.navMarketplace"),
    cart: t("vendor-shop.cart", { n }), account: t("vendor-shop.myAccount"),
  };
  const nav = (
    <nav className="wcv-nav">
      {PAGES.map((p) => <A key={p} to={p} go={go} className={`${p === page ? "on" : ""} wcv-n-${p}`}>{label[p]}</A>)}
    </nav>
  );
  const body = page === "home" ? <Home game={game} go={go} look={look} />
    : page === "pricing" ? <Pricing game={game} />
    : page === "download" ? <Download game={game} />
    : page === "releases" ? <Releases p={{ id: ID, name: shopById(ID).name, site: shopLicence(ID).site! }} page="versions" hour={game.hour} />
    : page === "marketplace" ? <Marketplace game={game} />
    : page === "cart" ? <Cart host={HOST} btn="wcv-btn" account={() => go("account")} />
    : <Account game={game} go={go} />;
  return (
    <div className={`wcv wcv-${look}`}>
      <div className="wcv-page">
        <header className="wcv-head"><A to="home" go={go} className="wcv-logo"><Mark /></A>{look !== "boxed" && nav}</header>
        {look === "boxed" && nav}
        <div className="wcv-body">
          {look === "boxed" && <Side game={game} go={go} />}
          <main className={`wcv-main wcv-p-${page}`}>
            {page !== "home" && <h1 className="wcv-h1">{page === "cart" ? t("shop-store.cart") : label[page]}</h1>}
            {body}
          </main>
        </div>
        <footer className="wcv-foot">{t("shop-link.footer", { year, maker: shopById(ID).maker })}</footer>
      </div>
    </div>
  );
}

// The left column of the 2005 site: the buy box and the newest release.
function Side({ game, go }: { game: GameState; go: Go }) {
  const latest = releasedAt(ID, game.hour).at(-1), era = shopEra(ID, game.hour);
  return (
    <aside className="wcv-side">
      <section>
        <h3>{t("shop-whmCache.buyNow")}</h3>
        {era.kind === "once" && <p className="wcv-big num">{euro(era.fee)}</p>}
        <A to="pricing" go={go} className="wcv-btn">{t("shop-whmCache.seePricing")}</A>
      </section>
      {latest && (
        <section>
          <h3>{t("shop-whmCache.latest")}</h3>
          <p><A to="releases" go={go}>{`${shopById(ID).name} ${latest.version}`}</A></p>
        </section>
      )}
    </aside>
  );
}

const FEATURES = [0, 1, 2, 3];

function Home({ game, go, look }: { game: GameState; go: Go; look: string }) {
  const latest = releasedAt(ID, game.hour).at(-1);
  return (
    <>
      <section className="wcv-hero">
        <div>
          {latest && look !== "boxed" && <p className="wcv-badge">{t("shop-whmCache.versionOut", { version: latest.version })}</p>}
          <h1>{t("shop-whmCache.headline")}</h1>
          <p>{t("shop-whmCache.pitch")}</p>
          <p className="wcv-cta"><A to="pricing" go={go} className="wcv-btn wcv-primary">{t("shop-whmCache.seePricing")}</A> <A to="download" go={go} className="wcv-btn">{t("shop-whmCache.navDownload")}</A></p>
        </div>
        {look !== "boxed" && <Shot />}
      </section>
      <section className="wcv-features">
        {FEATURES.map((i) => (
          <article key={i}><span className="wcv-dot" aria-hidden="true">{i + 1}</span><h3>{t(`shop-whmCache.f${i}`)}</h3><p>{t(`shop-whmCache.f${i}Text`)}</p></article>
        ))}
      </section>
    </>
  );
}

// A drawing of the admin for the hero.
const Shot = () => (
  <div className="wcv-shot" aria-hidden="true">
    <div className="wcv-shot-bar"><i /><i /><i /></div>
    <div className="wcv-shot-body"><span /><span /><span /><em /><em /><em /><em /></div>
  </div>
);

const priceOf = (o: Offer) => (o.kind === "once" ? t("shop-whmCache.once", { fee: euroPrice(o.fee) }) : t("shop-whmCache.perMonth", { fee: euroPrice(o.fee) }));

function Pricing({ game }: { game: GameState }) {
  const act = usePageAct(), era = shopEra(ID, game.hour), tiers = tiersOf(ID);
  const sold = offers(ID, game.hour), ups = upgradeOffers(game, ID);
  if (!sold.length && !ups.length) return <p>{t("shop-whmCache.notSold")}</p>;
  return (
    <div className="wcv-plans">
      {sold.map((o) => {
        const tier = tiers.find((x) => x.id === o.edition);
        return (
          <article key={o.edition ?? "own"} className={`wcv-plan${o.kind === "once" ? " wcv-own" : ""}`}>
            <h3>{tier?.name ?? t("shop-whmCache.owned")}</h3>
            <p className="wcv-price num">{priceOf(o)}</p>
            <ul>
              <li>{tier?.cap ? t("shop-whmCache.clients", { n: tier.cap.toLocaleString() }) : t("shop-whmCache.unlimitedClients")}</li>
              {o.kind === "once" && era.updates !== undefined && <li>{t("shop-whmCache.updatesIncl", { n: era.updates })}</li>}
              {o.kind === "once" && era.updatesFee !== undefined && <li>{t("shop-whmCache.updatesThen", { fee: euroPrice(era.updatesFee) })}</li>}
              {o.kind !== "once" && <li>{t("shop-whmCache.allUpdates")}</li>}
            </ul>
            <button type="button" className="wcv-btn wcv-primary" onClick={() => act(addToCart, ID, o.edition)}>{t("vendor-shop.addToCart")}</button>
          </article>
        );
      })}
      {ups.map((u) => (
        <article key={`up.${u.from}`} className="wcv-plan wcv-up">
          <h3>{t("shop-whmCache.upgradeTo", { from: u.from, to: u.to })}</h3>
          <p className="wcv-price num">{t("shop-whmCache.once", { fee: euroPrice(u.fee) })}</p>
          <button type="button" className="wcv-btn wcv-primary" onClick={() => act(addToCart, ID, null, u.from)}>{t("vendor-shop.addToCart")}</button>
        </article>
      ))}
    </div>
  );
}

function Download({ game }: { game: GameState }) {
  const latest = releasedAt(ID, game.hour).at(-1);
  return (
    <div className="wcv-doc">
      {latest && <p className="wcv-big num">{`${shopById(ID).name} ${latest.version}`}</p>}
      <ol>{[0, 1, 2, 3].map((i) => <li key={i}>{t(`shop-whmCache.install${i}`, { page: t("browser-consoles-1.cpSoftwareUpdates"), domain: game.company.domain ? `portal.${game.company.domain}/admin` : "portal" })}</li>)}</ol>
    </div>
  );
}

// The shop modules the vendor sells next to its keys: Shop link and the payment gateways of the year.
function Marketplace({ game }: { game: GameState }) {
  const act = usePageAct(), year = yearOf(game.hour);
  const state = (m: Module) => hasModule(game, m.id) && game.shop.variant === ID ? <span className="wcv-state">{t("vendor-sites.registered")}</span>
    : bought(game, m.id) ? <span className="wcv-state">{t("vendor-sites.bought")}</span>
    : <button type="button" className="wcv-btn wcv-primary" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>;
  return (
    <div className="wcv-mods">
      {MODULES.filter((m) => m.vendor === "shop" && m.year <= year).map((m) => (
        <article key={m.id}>
          <h3>{t(`vendor-sites.module.${m.id}`)}</h3>
          <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
          <dl>
            <dt>{t("vendor-sites.price")}</dt><dd className="num">{euro(m.price)}</dd>
            {m.id !== "shop-link" && <><dt>{t("payment-methods.fee")}</dt><dd className="num">{feeText(methodById(m.id as MethodId))}</dd></>}
          </dl>
          {state(m)}
        </article>
      ))}
    </div>
  );
}

function Account({ game, go }: { game: GameState; go: Go }) {
  const act = usePageAct(), [copied, setCopied] = useState<string | null>(null);
  const keys = keysOf(game, HOST), ups = upgradeOffers(game, ID), tiers = tiersOf(ID);
  if (!keys.length) return <p>{t("vendor-shop.noLicences")}</p>;
  const installed = (k: Licence) => k.machineId === SHOP_MACHINE && game.shop.variant === ID;
  const copy = (k: Licence) => { void navigator.clipboard?.writeText(k.key).catch(() => undefined); setCopied(k.id); };
  return (
    <table className="wcv-table">
      <thead><tr>{["vendor-shop.edition", "shop-whmCache.version", "shop-whmCache.installation", "shop-admin.updatesUntil", "vendor-shop.key", "vendor-shop.status"].map((k) => <th key={k}>{t(k)}</th>)}<th /></tr></thead>
      <tbody>{keys.map((k) => {
        const up = k.covers.kind === "version" ? ups.find((u) => u.from === (k.covers as { major: string }).major) : undefined;
        const fee = k.updatesUntil !== undefined ? shopUpdatesFee(game, k) : undefined, expired = keyExpired(game, k);
        return (
          <tr key={k.id}>
            <td>{tiers.find((x) => x.id === k.edition)?.name ?? t("shop-whmCache.owned")}</td>
            <td className="num">{k.covers.kind === "version" ? k.covers.major : t("shop-whmCache.current")}</td>
            <td>{k.machineId === SHOP_MACHINE && game.company.domain ? `portal.${game.company.domain}` : k.machineId ?? t("vendor-shop.unassigned")}</td>
            <td className="num">{k.updatesUntil !== undefined ? formatDay(k.updatesUntil) : k.covers.kind === "term" ? formatDay(k.renewsAt ?? k.covers.until) : ""}</td>
            <td className="wcv-key">{k.key}</td>
            <td>{expired ? t("vendor-shop.expired") : t("shop-whmCache.active")}</td>
            <td className="wcv-acts">
              {fee !== undefined && <button type="button" className="wcv-btn" disabled={!installed(k)} onClick={() => act(renewShopUpdates)}>{t("shop-admin.renewUpdates", { fee: euroPrice(fee) })}</button>}
              {up && <button type="button" className="wcv-btn wcv-primary" onClick={() => { if (act(addToCart, ID, null, up.from).ok) go("cart"); }}>{t("shop-whmCache.upgradeFor", { to: up.to, fee: euroPrice(up.fee) })}</button>}
              {k.covers.kind === "term" && k.renewsAt !== null && !expired && <button type="button" className="wcv-btn" onClick={() => act(cancelLicence, k.id)}>{t("vendor-shop.cancel")}</button>}
              <button type="button" className="wcv-btn" onClick={() => copy(k)}>{copied === k.id ? t("shop-whmCache.copied") : t("shop-whmCache.copyKey")}</button>
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
