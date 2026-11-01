import { useState, type ReactNode } from "react";
import { Boxes, CalendarClock, Network, Server } from "lucide-react";
import { t } from "../../../../../../i18n/en";
import { euro, euroPrice } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { tiersOf } from "../../../../../../sim/10-catalog/licence-tiers";
import { hasModule, MODULES, type Module } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { shopLicence } from "../../../../../../sim/10-catalog/shop-licences";
import { versionAt } from "../../../../../../sim/10-catalog/software-versions";
import type { GameState, Licence } from "../../../../../../sim/50-state";
import { keyExpired, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { bought } from "../../../../../../sim/80-business/licences";
import { portalPath } from "../../../../../../sim/80-business/portal";
import { shopUpdatesFee } from "../../../../../../sim/80-business/shop";
import { shopHost } from "../../../../../../sim/80-business/shoplink";
import { keysOf, offers, upgradeOffers } from "../../../../../../sim/80-business/vendor-shop";
import { renewShopUpdates } from "../../../../../../sim/90-actions/shop";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { addToCart, cancelLicence } from "../../../../../../sim/90-actions/vendor-shop";
import { formatDay } from "../../../../billing/format";
import { feeText } from "../../../../marketing/payments";
import { useStore } from "../../../../../store";
import { usePageAct } from "../../../pageAct";
import { Releases } from "../../software/Releases";
import { Cart, cartCount } from "../../shop/VendorShop";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

// The vendor site follows the game year: 2006 table layout, 2012 gloss, 2016 flat, 2021 dark product site.
const ID = "ubersmyth", HOST = shopHost(ID), NAME = "Ubersmyth";
type Era = 2006 | 2012 | 2016 | 2021;
const eraOf = (year: number): Era => (year >= 2021 ? 2021 : year >= 2016 ? 2016 : year >= 2012 ? 2012 : 2006);
const PAGES = ["", "pricing", "releases", "install", "addons", "cart", "account"] as const;
type Page = (typeof PAGES)[number];
const FEATURES = [CalendarClock, Boxes, Server, Network];

const Anvil = () => (
  <svg className="ubv-anvil" viewBox="0 0 24 16" aria-hidden="true">
    <path d="M1 2h17c2.5 0 4.5 1.3 5 3h-6c-1 0-2 .8-2 2v1c0 1.2.9 2 2 2h1v2h-3l-1.5 2H5.5L4 12H1v-2h2c1.1 0 2-.8 2-2V7C5 4.8 3.3 3.4 1 3.2z" />
  </svg>
);

export function Ubersmyth({ game, path = "/", go = () => {} }: VendorProps) {
  const year = yearOf(game.hour), era = eraOf(year);
  const page: Page = PAGES.find((x) => x && x === path.split(/[/?#]/)[1]) ?? "";
  const to = (p: Page) => go(`${HOST}/${p}`);
  const n = useStore((s) => cartCount(s.game, HOST));
  const label = (p: Page) => p === "cart" ? t("vendor-shop.cart", { n }) : p === "account" ? t("vendor-shop.myAccount") : t(`ubersmyth.site.nav.${p || "home"}`);
  const link = (p: Page, className?: string, children?: ReactNode) => (
    <a key={p} href={`#${p}`} className={className} aria-current={p === page ? "page" : undefined} onClick={(e) => { e.preventDefault(); to(p); }}>{children ?? label(p)}</a>
  );
  const latest = versionAt(ID, game.hour).version;
  const body: Record<Page, () => ReactNode> = {
    "": () => <Features era={era} />,
    pricing: () => <Pricing game={game} cards={era >= 2016} />,
    releases: () => <Releases p={{ id: ID, name: NAME, site: shopLicence(ID).site! }} page="versions" hour={game.hour} />,
    install: () => <Install game={game} />,
    addons: () => <Addons game={game} />,
    cart: () => <Cart host={HOST} btn="ubv-btn" account={() => to("account")} />,
    account: () => <Account game={game} cart={() => to("cart")} />,
  };
  return (
    <div className={`ubv ubv-${era} ubv-page-${page || "home"}`}>
      <header className="ubv-head">
        <div className="ubv-in">
          {link("", "ubv-mark", <><span className="ubv-tile"><Anvil /></span><span className="ubv-word">ubersmyth</span></>)}
          {era === 2006 && <span className="ubv-tag">{t("ubersmyth.site.tagline")}</span>}
          {era !== 2006 && <nav className="ubv-nav">{PAGES.map((p) => link(p))}</nav>}
        </div>
      </header>
      {era === 2006 && <nav className="ubv-nav ubv-bar">{PAGES.map((p) => link(p))}</nav>}
      {!page && <Hero era={era} latest={latest} pricing={link("pricing", "ubv-cta", t("ubersmyth.site.seePricing"))} />}
      <div className="ubv-in ubv-body">
        <main className="ubv-main">
          {page && <h1 className="ubv-h1">{label(page)}</h1>}
          {body[page]()}
        </main>
        {era === 2006 && (
          <aside className="ubv-side">
            <section><h3>{t("ubersmyth.site.latest")}</h3><p>{link("releases", undefined, `${NAME} ${latest}`)}</p></section>
            <section><h3>{t("ubersmyth.site.editions")}</h3><ul>{offers(ID, game.hour).map((o) => <li key={o.edition}>{tiersOf(ID).find((x) => x.id === o.edition)?.name}</li>)}</ul>{link("pricing", undefined, t("ubersmyth.site.seePricing"))}</section>
          </aside>
        )}
      </div>
      <footer className="ubv-foot"><div className="ubv-in">{t("ubersmyth.site.footer", { year })}</div></footer>
    </div>
  );
}

function Hero({ era, latest, pricing }: { era: Era; latest: string; pricing: ReactNode }) {
  return (
    <section className="ubv-hero">
      <div className="ubv-in">
        <h2>{t(`ubersmyth.site.hero.${era}`)}</h2>
        <p>{t("ubersmyth.site.pitch")}</p>
        <p className="ubv-hero-cta">{pricing}{era === 2021 && <span className="ubv-meta">{t("ubersmyth.site.latest")} <b className="num">{latest}</b></span>}</p>
      </div>
    </section>
  );
}

const Features = ({ era }: { era: Era }) => (
  <ul className="ubv-features">
    {FEATURES.map((Icon, i) => <li key={i}>{era >= 2016 && <Icon size={22} strokeWidth={1.75} aria-hidden="true" />}<span>{t(`ubersmyth.site.f${i}`)}</span></li>)}
  </ul>
);

function Pricing({ game, cards }: { game: GameState; cards: boolean }) {
  const act = usePageAct(), list = offers(ID, game.hour);
  if (!list.length) return <p>{t("ubersmyth.site.noneOnSale")}</p>;
  const rows = list.map((o) => {
    const tier = tiersOf(ID).find((x) => x.id === o.edition);
    return {
      key: o.edition ?? ID, name: tier?.name ?? NAME,
      cap: tier?.cap == null ? t("ubersmyth.site.anyServers") : t("ubersmyth.site.upTo", { n: tier.cap }),
      price: t("ubersmyth.site.perMonth", { fee: euroPrice(o.fee) }),
      buy: <button type="button" className="ubv-btn" onClick={() => act(addToCart, ID, o.edition)}>{t("vendor-shop.addToCart")}</button>,
    };
  });
  if (cards) {
    return (
      <div className="ubv-cards">
        {rows.map((r) => <section key={r.key}><h3>{r.name}</h3><p className="ubv-cap">{r.cap}</p><p className="ubv-price num">{r.price}</p>{r.buy}</section>)}
      </div>
    );
  }
  return (
    <table className="ubv-table">
      <thead><tr><th>{t("vendor-shop.edition")}</th><th>{t("shop-admin.capServers")}</th><th>{t("ubersmyth.site.lease")}</th><th /></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td>{r.name}</td><td>{r.cap}</td><td className="num">{r.price}</td><td>{r.buy}</td></tr>)}</tbody>
    </table>
  );
}

const portalAdmin = (game: GameState) => game.company.domain ? `portal.${game.company.domain}${portalPath(ID, "admin")}` : "";

function Install({ game }: { game: GameState }) {
  const url = portalAdmin(game);
  return (
    <ol className="ubv-steps">
      <li>{t("ubersmyth.site.install1")}</li>
      <li>{t("ubersmyth.site.install2")}</li>
      <li>{t("ubersmyth.site.install3", { name: NAME })}</li>
      {url && <li>{t("ubersmyth.site.install4", { url })}</li>}
    </ol>
  );
}

// The modules every shop vendor sells: Shop link and the payment methods of the year.
function Addons({ game }: { game: GameState }) {
  const act = usePageAct(), year = yearOf(game.hour);
  const state = (m: Module) => hasModule(game, m.id) && game.shop.variant === ID ? <span className="ubv-ok">{t("vendor-sites.registered")}</span>
    : bought(game, m.id) ? <span className="ubv-ok">{t("vendor-sites.bought")}</span>
    : <button type="button" className="ubv-btn" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>;
  return (
    <div className="ubv-addons">
      {MODULES.filter((m) => m.vendor === "shop" && m.year <= year).map((m) => (
        <section key={m.id}>
          <h3>{t(`vendor-sites.module.${m.id}`)}</h3>
          <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
          <dl>
            <dt>{t("vendor-sites.price")}</dt><dd className="num">{euro(m.price)} {t("vendor-sites.licence")}</dd>
            {m.id !== "shop-link" && <><dt>{t("payment-methods.fee")}</dt><dd className="num">{feeText(methodById(m.id as MethodId))}</dd></>}
          </dl>
          {state(m)}
        </section>
      ))}
    </div>
  );
}

const editionName = (k: Licence) => tiersOf(k.product).find((x) => x.id === k.edition)?.name ?? "";

function status(game: GameState, k: Licence): string {
  if (keyExpired(game, k)) return t("vendor-shop.expired");
  if (k.covers.kind === "version") return t("vendor-shop.version", { major: k.covers.major });
  return k.renewsAt === null ? t("vendor-shop.endsOn", { date: formatDay(k.covers.until) }) : t("vendor-shop.renewsOn", { date: formatDay(k.renewsAt) });
}

// My account: every Ubersmyth key with what it covers, where it runs and what can be bought for it.
function Account({ game, cart }: { game: GameState; cart: () => void }) {
  const act = usePageAct(), [copied, setCopied] = useState<string | null>(null);
  const keys = keysOf(game, HOST);
  if (!keys.length) return <p>{t("vendor-shop.noLicences")}</p>;
  const copy = (k: Licence) => navigator.clipboard?.writeText(k.key).then(() => setCopied(k.id), () => setCopied(null));
  return (
    <table className="ubv-table ubv-keys">
      <thead><tr>{["vendor-shop.edition", "vendor-shop.key", "ubersmyth.site.version", "ubersmyth.site.installation", "ubersmyth.site.updatesUntil", "vendor-shop.status"].map((x) => <th key={x}>{t(x)}</th>)}<th /></tr></thead>
      <tbody>{keys.map((k) => {
        const installed = k.machineId === SHOP_MACHINE && game.shop.variant === k.product;
        const until = k.updatesUntil ?? (k.covers.kind === "term" ? k.covers.until : undefined);
        const fee = installed && k.updatesUntil !== undefined ? shopUpdatesFee(game, k) : undefined;
        const major = k.covers.kind === "version" ? k.covers.major : null;
        const up = major !== null ? upgradeOffers(game, k.product).find((o) => o.from === major) : undefined;
        return (
          <tr key={k.id}>
            <td>{editionName(k)}</td>
            <td className="ubv-key num">{k.key}</td>
            <td className="num">{major ?? versionAt(k.product, game.hour).version}</td>
            <td>{installed ? portalAdmin(game) || NAME : k.machineId === null ? t("vendor-shop.unassigned") : k.machineId}</td>
            <td className="num">{until !== undefined ? formatDay(until) : ""}</td>
            <td>{status(game, k)}</td>
            <td className="ubv-acts">
              <button type="button" className="ubv-btn ubv-quiet" onClick={() => copy(k)}>{copied === k.id ? t("ubersmyth.site.copied") : t("ubersmyth.site.copyKey")}</button>
              {fee !== undefined && <button type="button" className="ubv-btn" onClick={() => act(renewShopUpdates)}>{t("ubersmyth.site.renewUpdates", { fee: euroPrice(fee) })}</button>}
              {up && <button type="button" className="ubv-btn" onClick={() => { if (act(addToCart, k.product, null, up.from).ok) cart(); }}>{t("ubersmyth.site.upgradeTo", { major: up.to, fee: euroPrice(up.fee) })}</button>}
              {k.covers.kind === "term" && k.renewsAt !== null && !keyExpired(game, k) && <button type="button" className="ubv-btn ubv-quiet" onClick={() => act(cancelLicence, k.id)}>{t("vendor-shop.cancel")}</button>}
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
