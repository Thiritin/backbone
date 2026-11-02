import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euro, euroPrice } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { tiersOf } from "../../../../../../sim/10-catalog/licence-tiers";
import { hasModule, MODULES } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { shopEra, shopLicence } from "../../../../../../sim/10-catalog/shop-licences";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { nextMajor, versionAt } from "../../../../../../sim/10-catalog/software-versions";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import type { GameState, Licence } from "../../../../../../sim/50-state";
import { covers, keyExpired, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { displayHost } from "../../../../../../sim/80-business/browser";
import { bought } from "../../../../../../sim/80-business/licences";
import { shopUpdatesFee } from "../../../../../../sim/80-business/shop";
import { keysOf, offers, upgradeOffer, upgradeOffers } from "../../../../../../sim/80-business/vendor-shop";
import { renewShopUpdates, upgradeShop } from "../../../../../../sim/90-actions/shop";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { addToCart, cancelLicence } from "../../../../../../sim/90-actions/vendor-shop";
import { formatDay } from "../../../../billing/format";
import { feeText } from "../../../../marketing/payments";
import { usePageAct } from "../../../pageAct";
import { Cart, cartCount } from "../../shop/VendorShop";
import { Releases } from "../../software/Releases";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

const ID = "clientExit";
type Page = "home" | "pricing" | "releases" | "download" | "cart" | "account";
const PAGES: Page[] = ["home", "pricing", "releases", "download", "cart", "account"];
// The site's look by game year: a fixed-width table page, a glossy Web 2.0 page, a flat landing page, a current one.
const eraOf = (year: number) => (year >= 2026 ? "v4" : year >= 2016 ? "v3" : year >= 2011 ? "v2" : "v1");

const Mark = () => <span className="cxv-mark">Client<span className="cxv-exit">Exit</span></span>;

function CopyKey({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  // The clipboard API needs a secure page and permission; a selected textarea copies where it is refused.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setDone(true);
  };
  return <button type="button" className="cxv-btn quiet" onClick={copy}>{done ? t("cexit.v.copied") : t("cexit.v.copyKey")}</button>;
}

function Pricing({ game, cart }: { game: GameState; cart: () => void }) {
  const act = usePageAct(), hour = game.hour, era = shopEra(ID, hour), tiers = tiersOf(ID), major = versionAt(ID, hour).major;
  const buy = (edition: string | null, from?: string) => act(addToCart, ID, edition, from).ok && cart();
  const year = yearOf(hour), modules = MODULES.filter((m) => m.vendor === "shop" && m.year <= year);
  return (
    <>
      <h1>{t("cexit.v.navPricing")}</h1>
      <table className="cxv-table cxv-prices">
        <thead><tr><th>{t("vendor-shop.edition")}</th><th>{t("cexit.v.clients")}</th><th>{t("vendor-shop.price")}</th><th>{t("cexit.v.updates")}</th><th /></tr></thead>
        <tbody>
          {offers(ID, hour).map((o) => {
            const tier = tiers.find((x) => x.id === o.edition);
            return (
              <tr key={o.edition ?? "owned"}>
                <td className="cxv-ed">{tier ? tier.name : t("cexit.v.owned", { major })}</td>
                <td>{tier?.cap ? tier.cap : t("vendor-shop.unlimited")}</td>
                <td className="num cxv-amount">{o.kind === "once" ? t("cexit.v.once", { fee: euroPrice(o.fee) }) : t("cexit.v.perMonth", { fee: euroPrice(o.fee) })}</td>
                <td>{o.kind === "once" ? t("cexit.v.updatesTerm", { n: era.updates ?? 12, fee: euroPrice(era.updatesFee ?? 0) }) : t("cexit.v.leaseUpdates")}</td>
                <td><button type="button" className="cxv-btn" onClick={() => buy(o.edition)}>{t("vendor-shop.addToCart")}</button></td>
              </tr>
            );
          })}
          {upgradeOffers(game, ID).map((u) => (
            <tr key={`up.${u.from}`}>
              <td className="cxv-ed">{t("cexit.v.upgradeRow", { from: u.from, to: u.to })}</td><td />
              <td className="num cxv-amount">{t("cexit.v.once", { fee: euroPrice(u.fee) })}</td><td />
              <td><button type="button" className="cxv-btn" onClick={() => buy(null, u.from)}>{t("vendor-shop.addToCart")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {modules.length > 0 && (
        <>
          <h2>{t("cexit.v.addons")}</h2>
          <table className="cxv-table">
            <tbody>{modules.map((m) => (
              <tr key={m.id}>
                <td className="cxv-ed">{t(`vendor-sites.module.${m.id}`)}<p>{t(`vendor-sites.pitch.${m.id}`)}</p></td>
                <td className="num cxv-amount">{euro(m.price)}</td>
                <td className="num">{m.id !== "shop-link" && feeText(methodById(m.id as MethodId))}</td>
                <td>{hasModule(game, m.id) && game.shop.variant === ID ? t("vendor-sites.registered")
                  : bought(game, m.id) ? t("vendor-sites.bought")
                  : <button type="button" className="cxv-btn" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
    </>
  );
}

// The keys bought here: renew, upgrade and copy each; the installed one upgrades in place.
function Account({ game, host, cart }: { game: GameState; host: string; cart: () => void }) {
  const act = usePageAct(), keys = keysOf(game, host);
  const installed = game.shop.variant === ID ? game.shop.install?.version : undefined;
  const next = installed ? nextMajor(ID, installed, game.hour) : undefined;
  const actions = (k: Licence) => {
    const mine = k.machineId === SHOP_MACHINE && !!installed, out = [];
    const fee = mine && k.updatesUntil !== undefined ? shopUpdatesFee(game, k) : undefined;
    if (fee !== undefined) out.push(<button key="renew" type="button" className="cxv-btn" onClick={() => act(renewShopUpdates)}>{t("shop-admin.renewUpdates", { fee: euroPrice(fee) })}</button>);
    if (mine && next) {
      const price = covers(k, next.version) ? null : k.covers.kind === "version" ? upgradeOffer(game, ID, k.covers.major)?.fee : undefined;
      if (price !== undefined) out.push(<button key="up" type="button" className="cxv-btn" onClick={() => act(upgradeShop)}>{price === null ? t("cexit.v.upgradeFree", { major: next.major }) : t("cexit.v.upgradeTo", { major: next.major, fee: euroPrice(price) })}</button>);
    } else if (!mine && k.covers.kind === "version") {
      const from = k.covers.major, u = upgradeOffers(game, ID).find((x) => x.from === from);
      if (u) out.push(<button key="up" type="button" className="cxv-btn" onClick={() => act(addToCart, ID, null, from).ok && cart()}>{t("cexit.v.upgradeTo", { major: u.to, fee: euroPrice(u.fee) })}</button>);
    }
    out.push(<CopyKey key="copy" text={k.key} />);
    if (k.covers.kind === "term" && k.renewsAt !== null && !keyExpired(game, k)) out.push(<button key="cancel" type="button" className="cxv-btn quiet" onClick={() => act(cancelLicence, k.id)}>{t("vendor-shop.cancel")}</button>);
    return out;
  };
  return (
    <>
      <h1>{t("vendor-shop.myAccount")}</h1>
      {!keys.length ? <p>{t("vendor-shop.noLicences")}</p> : (
        <div className="cxv-keys">
          {keys.map((k) => (
            <section key={k.id} className="cxv-key">
              <dl>
                <dt>{t("vendor-shop.edition")}</dt><dd>{tiersOf(ID).find((x) => x.id === k.edition)?.name ?? t("cexit.v.ownedShort")}</dd>
                <dt>{t("cexit.v.covers")}</dt><dd>{keyExpired(game, k) ? t("vendor-shop.expired") : k.covers.kind === "version" ? t("cexit.v.version", { major: k.covers.major }) : t("cexit.v.whilePaid")}</dd>
                <dt>{t("cexit.v.installation")}</dt><dd>{k.machineId === SHOP_MACHINE ? `portal.${companyDomain(game)}` : t("vendor-shop.unassigned")}</dd>
                {k.updatesUntil !== undefined && <><dt>{t("shop-admin.updatesUntil")}</dt><dd className="num">{formatDay(k.updatesUntil)}</dd></>}
                <dt>{t("vendor-shop.key")}</dt><dd className="shop-key">{k.key}</dd>
              </dl>
              <div className="cxv-acts">{actions(k)}</div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export function ClientExit({ game, path = "/", go }: VendorProps) {
  const host = shopLicence(ID).site!.host, year = yearOf(game.hour), maker = shopById(ID).maker;
  const page = PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
  const to = (p: Page) => go?.(`${displayHost(host)}${p === "home" ? "/" : `/${p}`}`);
  const n = cartCount(game, host), trial = shopLicence(ID).trialDays;
  const label: Record<Page, string> = {
    home: t("cexit.v.navHome"), pricing: t("cexit.v.navPricing"), releases: t("cexit.v.navReleases"), download: t("cexit.v.navDownload"),
    cart: t("vendor-shop.cart", { n }), account: t("vendor-shop.myAccount"),
  };
  const link = (p: Page, cls?: string, text = label[p]) => (
    <a key={p} href={`#${p}`} className={cls} aria-current={p === page ? "page" : undefined} onClick={(e) => { e.preventDefault(); to(p); }}>{text}</a>
  );
  let body;
  if (page === "pricing") body = <Pricing game={game} cart={() => to("cart")} />;
  else if (page === "releases") body = <><h1>{label.releases}</h1><Releases p={{ id: ID, name: shopById(ID).name, site: shopLicence(ID).site! }} page="versions" hour={game.hour} /></>;
  else if (page === "download") body = (
    <>
      <h1>{label.download}</h1>
      <ol className="cxv-steps">
        <li>{trial ? t("cexit.v.step1Trial", { days: trial }) : t("cexit.v.step1")}</li>
        <li>{t("cexit.v.step2")}</li>
        <li>{t("cexit.v.step3")}</li>
        <li>{t("cexit.v.step4")}</li>
      </ol>
    </>
  );
  else if (page === "cart") body = <><h1>{t("vendor-shop.cart", { n })}</h1><Cart host={host} btn="cxv-btn" account={() => to("account")} /></>;
  else if (page === "account") body = <Account game={game} host={host} cart={() => to("cart")} />;
  else body = (
    <div className="cxv-home">
      <section className="cxv-hero">
        <h1>{t("cexit.v.headline")}</h1>
        <p>{t("cexit.v.pitch")}</p>
        <div className="cxv-cta">{link("pricing", "cxv-btn big", t("cexit.v.seePricing"))}{link("download", "cxv-btn big quiet", t("cexit.v.freeTrial"))}</div>
      </section>
      <ul className="cxv-features">{[0, 1, 2, 3].map((i) => <li key={i}><b>{t(`cexit.v.f${i}`)}</b><span>{t(`cexit.v.f${i}text`)}</span></li>)}</ul>
    </div>
  );
  return (
    <div className={`cxv cxv-${eraOf(year)}`}>
      <div className="cxv-page">
        <header className="cxv-head">
          <a href="#home" className="cxv-logo" onClick={(e) => { e.preventDefault(); to("home"); }}><Mark /></a>
          <nav className="cxv-nav">{PAGES.map((p) => link(p))}</nav>
        </header>
        <main className="cxv-main">{body}</main>
        <footer className="cxv-foot">{t("shop-link.footer", { year, maker })}</footer>
      </div>
    </div>
  );
}
