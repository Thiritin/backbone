import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro } from "../../../../../sim/00-core/money";
import { SPACE_SIZES, spacePrice } from "../../../../../sim/20-world/datacenters";
import { Logo } from "../../../../art/logos";
import { shareUnits, spaceSize } from "../../../locations/ui";
import { A, Body, dcsOf, fromPrice, Nav, orderPath, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./myloch.css";

// myLoch: 2005 a boxed hosting shop with rounded tabs, price boxes and orange order buttons; 2015 a flat page with a light hero price and tick-list tiles.
function MyLoch(props: ProviderProps) {
  const { p, look, route, go, year } = props, dc = dcsOf(p.id)[0];
  const labels = { home: t("providers.myloch.navHome"), sites: t("providers.myloch.navSites"), order: t("providers.myloch.navOrder"), account: t("providers.myloch.navPortal") };
  return (
    <div className={`ps ps-myloch ${look}`}>
      <div className="ml-shell">
        <header>
          <A to="/" go={go} className="ps-wm"><Logo provider="myloch" size={look === "early" ? 30 : 24} /><span><i>my</i>Loch</span></A>
          <span className="ml-claim">{t("providers.myloch.claim")}</span>
        </header>
        <Nav route={route} go={go} className="ml-nav" labels={labels} />
        <main>
          {route.page === "home" ? <>
            <section className="ml-hero">
              <h1>{look === "early" ? t("providers.myloch.heroEarly") : t("providers.myloch.heroLate")}</h1>
              <p>{t("providers.myloch.text", { name: dc.name, city: dc.city })}</p>
              <p className="ml-from">{t("providers.myloch.from", { price: euro(fromPrice(p.id)) })}</p>
            </section>
            <div className="ml-products">
              {SPACE_SIZES.share.map((n) => (
                <div key={n} className="ml-product">
                  <h3>{spaceSize("share", n)}</h3>
                  <ul>
                    <li>{t("providers.myloch.units", { n: shareUnits(n) })}</li>
                    <li>{t("providers.myloch.power", { kw: (dc.kwPerPosition / n).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) })}</li>
                    <li>{t("providers.myloch.hands", { hours: dc.remoteHands.responseHours })}</li>
                  </ul>
                  <p className="ml-price">{t("providers.myloch.perMonth", { price: euro(spacePrice(dc, "share", n)) })}</p>
                  <A to={orderPath(dc, "share", n)} go={go} className="ps-btn pri">{t("providers.myloch.order")}</A>
                </div>
              ))}
            </div>
            <p className="ml-vat">{t("providers.myloch.vat")}</p>
          </> : <div className="ml-body">
            <h1>{titleOf(route)}</h1>
            <Body {...props} />
          </div>}
        </main>
        <footer><span>{t("providers.myloch.footer", { year })}</span><span>{t("providers.imprint")} | {t("providers.terms")} | {t("providers.privacy")}</span></footer>
      </div>
    </div>
  );
}

export default { view: MyLoch, late: 2015 } satisfies Design;
