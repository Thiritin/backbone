import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euro } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { hasModule, MODULES } from "../../../../../../sim/10-catalog/modules";
import { methodById, type MethodId } from "../../../../../../sim/10-catalog/payments";
import { nextMajor, releasedAt, versionAt, versionInfo } from "../../../../../../sim/10-catalog/software-versions";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../../sim/50-state";
import { supportOn } from "../../../../../../sim/60-infra/lifecycle";
import { SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { displayHost } from "../../../../../../sim/80-business/browser";
import { bought } from "../../../../../../sim/80-business/licences";
import { portalPath } from "../../../../../../sim/80-business/portal";
import { shopUpdate } from "../../../../../../sim/80-business/shop";
import { hostOf } from "../../../../../../sim/80-business/vendor-shop";
import { updateShop, upgradeShop } from "../../../../../../sim/90-actions/shop";
import { buyShopLink } from "../../../../../../sim/90-actions/shoplink";
import { formatDay } from "../../../../billing/format";
import { feeText } from "../../../../marketing/payments";
import { usePageAct } from "../../../pageAct";
import { Cube, OpenBox } from "../../portal/boxbillin/marks";
import type { VendorProps } from "../ShopVendorSite";
import "./site.css";

const ID = "boxBillin";
type Page = "home" | "download" | "install" | "releases" | "extensions" | "account";
const PAGES: Page[] = ["home", "download", "install", "releases", "extensions", "account"];
// 2011 to 2013 glossy, 2014 on flat, and FOSSBillin' from its first release.
type Era = "cube" | "flat" | "foss";
const eraAt = (hour: number): Era => (versionAt(ID, hour).name ? "foss" : yearOf(hour) >= 2014 ? "flat" : "cube");

export function BoxBillin({ game, path = "/", go }: VendorProps) {
  const page = PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home", era = eraAt(game.hour);
  const brand = era === "foss" ? "FOSSBillin'" : "BoxBillin'", latest = versionAt(ID, game.hour);
  const to = (p: Page) => (e: { preventDefault: () => void }) => { e.preventDefault(); go?.(`${displayHost(hostOf(ID)!)}${p === "home" ? "/" : `/${p}`}`); };
  const nav = PAGES.filter((p) => p !== "home").map((p) => (
    <a key={p} href={`#${p}`} aria-current={p === page ? "page" : undefined} onClick={to(p)}>{t(`shop-boxBillin.site.nav.${p === "install" && era === "foss" ? "docs" : p}`)}</a>
  ));
  const body: Record<Page, () => ReactNode> = {
    home: () => <Home era={era} brand={brand} version={latest.version} download={to("download")} install={to("install")} />,
    download: () => <Download game={game} brand={brand} install={to("install")} />,
    install: () => <Install game={game} brand={brand} />,
    releases: () => <Releases game={game} />,
    extensions: () => <Extensions game={game} />,
    account: () => <Account game={game} />,
  };
  return (
    <div className={`bxs bxs-${era} bxs-${page}`}>
      <header className="bxs-head">
        <div className="bxs-wrap">
          <a href="#home" className="bxs-logo" onClick={to("home")}>{era === "foss" ? <OpenBox size={30} /> : <Cube size={34} />}<b>{brand}</b></a>
          <nav className="bxs-nav">{nav}</nav>
        </div>
      </header>
      {page === "home" ? body.home() : (
        <main className="bxs-wrap bxs-page">
          <h1>{t(`shop-boxBillin.site.nav.${page === "install" && era === "foss" ? "docs" : page}`)}</h1>
          {body[page]()}
        </main>
      )}
      <footer className="bxs-foot"><div className="bxs-wrap">{t("shop-boxBillin.site.footer", { year: yearOf(game.hour), name: brand })}</div></footer>
    </div>
  );
}

type Click = (e: { preventDefault: () => void }) => void;

function Home({ era, brand, version, download, install }: { era: Era; brand: string; version: string; download: Click; install: Click }) {
  return (
    <>
      <section className="bxs-hero">
        <div className="bxs-wrap">
          <div className="bxs-pitch">
            <h1>{t(`shop-boxBillin.site.headline.${era}`)}</h1>
            <p>{t("shop-boxBillin.site.pitch", { name: brand })}</p>
            <div className="bxs-cta">
              <a href="#download" className="bxs-btn" onClick={download}>{t("shop-boxBillin.site.downloadVersion", { name: brand, version })}</a>
              <a href="#install" className="bxs-btn ghost" onClick={install}>{t("shop-boxBillin.site.nav.install")}</a>
            </div>
          </div>
          {era !== "flat" && <Shot era={era} />}
          {era === "cube" && <span className="bxs-seal">{t("shop-boxBillin.site.free")}</span>}
        </div>
      </section>
      <section className="bxs-wrap bxs-features">
        {[0, 1, 2].map((i) => (
          <article key={i}><span className="bxs-num">{i + 1}</span><h2>{t(`shop-boxBillin.site.feature${i}`)}</h2><p>{t(`shop-boxBillin.site.feature${i}Text`)}</p></article>
        ))}
      </section>
    </>
  );
}

// A drawn screenshot of the admin of the era.
const Shot = ({ era }: { era: Era }) => (
  <div className={`bxs-shot bxs-shot-${era}`} aria-hidden="true">
    <i className="bar" /><div><i className="side" /><div className="rows">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div></div>
  </div>
);

function Download({ game, brand, install }: { game: GameState; brand: string; install: Click }) {
  const v = versionAt(ID, game.hour);
  return (
    <div className="bxs-card bxs-edition">
      <h2>{t("shop-boxBillin.site.edition", { name: brand })}</h2>
      <p className="bxs-price">{t("shop-boxBillin.site.free")}</p>
      <dl>
        <dt>{t("shop-boxBillin.site.latest")}</dt><dd className="num">{v.version}</dd>
        <dt>{t("shop-boxBillin.site.released")}</dt><dd className="num">{formatDay(v.release)}</dd>
        <dt>{t("shop-boxBillin.site.licence")}</dt><dd>{t("shop-boxBillin.site.apache")}</dd>
        <dt>{t("shop-boxBillin.site.updates")}</dt><dd>{t("shop-boxBillin.site.updatesFree")}</dd>
      </dl>
      <a href="#install" className="bxs-btn" onClick={install}>{t("shop-boxBillin.site.nav.install")}</a>
    </div>
  );
}

function Install({ game, brand }: { game: GameState; brand: string }) {
  const admin = `portal.${companyDomain(game)}${portalPath(ID, "admin")}`;
  return (
    <ol className="bxs-card bxs-steps">
      <li>{t("shop-boxBillin.site.step0")}</li>
      <li>{t("shop-boxBillin.site.step1", { section: t("host.shop"), button: t("host.installShop", { name: brand }) })}</li>
      <li>{t("shop-boxBillin.site.step2")} <code>{admin}</code></li>
    </ol>
  );
}

function Releases({ game }: { game: GameState }) {
  const out = releasedAt(ID, game.hour).reverse();
  return (
    <table className="bxs-card bxs-table">
      <thead><tr><th>{t("shop-boxBillin.site.version")}</th><th>{t("shop-boxBillin.site.released")}</th><th>{t("shop-boxBillin.site.securityUntil")}</th></tr></thead>
      <tbody>{out.map((v) => (
        <tr key={v.version}>
          <td><b className="num">{v.version}</b> {v.name || shopById(ID).name}</td>
          <td className="num">{formatDay(v.release)}</td>
          <td className="num">{v.securityUntil === null ? t("shop-boxBillin.site.current") : formatDay(v.securityUntil)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

// The shop modules every shop vendor sells: Shop link and the payment methods of the year.
function Extensions({ game }: { game: GameState }) {
  const act = usePageAct(), year = yearOf(game.hour);
  return (
    <div className="bxs-grid">
      {MODULES.filter((m) => m.vendor === "shop" && m.year <= year).map((m) => (
        <article key={m.id} className="bxs-card">
          <h2>{t(`vendor-sites.module.${m.id}`)}</h2>
          <p>{t(`vendor-sites.pitch.${m.id}`)}</p>
          <dl>
            <dt>{t("vendor-sites.price")}</dt><dd className="num">{euro(m.price)}</dd>
            {m.id !== "shop-link" && <><dt>{t("payment-methods.fee")}</dt><dd className="num">{feeText(methodById(m.id as MethodId))}</dd></>}
          </dl>
          {hasModule(game, m.id) && game.shop.variant === ID ? <span className="bxs-state">{t("vendor-sites.registered")}</span>
            : bought(game, m.id) ? <span className="bxs-state">{t("vendor-sites.bought")}</span>
            : <button type="button" className="bxs-btn" onClick={() => act(buyShopLink, ID, m.id)}>{t("vendor-sites.buy")}</button>}
        </article>
      ))}
    </div>
  );
}

// The player's installation: no key, so the account lists what runs where and what it may move to.
function Account({ game }: { game: GameState }) {
  const act = usePageAct(), at = game.shop.variant === ID ? game.shop.install : null;
  if (!at) return <p className="bxs-card">{t("shop-boxBillin.site.noInstall")}</p>;
  const host = game.clusters.find((c) => c.id === at.clusterId)?.name ?? at.clusterId, info = versionInfo(ID, at.version);
  const update = shopUpdate(game), next = nextMajor(ID, at.version, game.hour);
  return (
    <div className="bxs-card bxs-account">
      {supportOn(game, SHOP_MACHINE, ID) === "securityEnded" && <p className="bxs-alert" role="alert">{t("shop-admin.securityEnded")}</p>}
      <table className="bxs-table">
        <thead><tr><th>{t("shop-boxBillin.site.host")}</th><th>{t("shop-boxBillin.site.installed")}</th><th>{t("shop-boxBillin.site.newest")}</th><th>{t("shop-boxBillin.site.securityUntil")}</th><th>{t("shop-boxBillin.site.licence")}</th></tr></thead>
        <tbody><tr>
          <td>{host}</td><td className="num">{at.version}</td><td className="num">{update?.version ?? at.version}</td>
          <td className="num">{info?.securityUntil == null ? t("shop-boxBillin.site.current") : formatDay(info.securityUntil)}</td>
          <td>{t("shop-boxBillin.site.free")}</td>
        </tr></tbody>
      </table>
      <div className="bxs-cta">
        <button type="button" className="bxs-btn" disabled={!update} onClick={() => act(updateShop)}>{t("shop-admin.installUpdate")}</button>
        {next && <button type="button" className="bxs-btn" onClick={() => act(upgradeShop)}>{t("shop-boxBillin.site.upgradeTo", { version: next.version })}</button>}
      </div>
    </div>
  );
}
