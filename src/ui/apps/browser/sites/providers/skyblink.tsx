import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { Logo } from "../../../../art/logos";
import { A, Body, dcsOf, fromPrice, Nav, SiteFacts, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./skyblink.css";

// SkyBlink: 2005 a narrow page under a cloudy sky banner with a pipe-separated menu; 2016 a full-width sky hero and a green quote button.
function SkyBlink(props: ProviderProps) {
  const { p, look, route, go, year } = props, dc = dcsOf(p.id)[0], price = euro(fromPrice(p.id));
  const labels = { sites: t("providers.skyblink.navSites"), order: t("providers.skyblink.navOrder"), account: t("providers.skyblink.navPortal") };
  const usps = [1, 2, 3].map((i) => <li key={i}><b>{t(`providers.skyblink.usp${i}`)}</b><span>{t(`providers.skyblink.usp${i}Text`, { carriers: dc.carriers, hours: dc.remoteHands.responseHours })}</span></li>);
  return (
    <div className={`ps ps-skyblink ${look}`}>
      <div className="sky-page">
        <header>
          <A to="/" go={go} className="ps-wm"><Logo provider="skyblink" size={look === "early" ? 30 : 24} /><span>Sky<b>Blink</b></span></A>
          {look === "early" && <span className="sky-claim">{t("providers.skyblink.claim")}</span>}
          <Nav route={route} go={go} labels={labels} />
          {look === "late" && <A to="/order" go={go} className="ps-btn pri sky-quote">{t("providers.skyblink.quote")}</A>}
        </header>
        <div className="sky-frame">
          {look === "early" && route.page !== "account" && (
            <aside>
              <h3>{t("providers.skyblink.side", { city: dc.city })}</h3>
              <SiteFacts dc={dc} className="sky-side" />
              <A to={`/sites/${dc.id}`} go={go}>{t("providers.skyblink.more")}</A>
            </aside>
          )}
          <main>
            {route.page === "home" ? <>
              <section className="sky-hero">
                <h1>{look === "early" ? t("providers.skyblink.heroEarly") : t("providers.skyblink.heroLate")}</h1>
                <p>{t("providers.skyblink.text", { name: dc.name, city: dc.city, price })}</p>
                {look === "late" && <A to={`/sites/${dc.id}`} go={go} className="ps-btn pri">{t("providers.skyblink.more")}</A>}
              </section>
              <ul className="sky-usps">{usps}</ul>
              {look === "early" && <p className="sky-from">{t("providers.skyblink.from", { price })} <A to="/order" go={go}>{t("providers.skyblink.quote")}</A></p>}
            </> : <div className="sky-body">
              <h1>{titleOf(route)}</h1>
              <Body {...props} />
            </div>}
          </main>
        </div>
        <footer><span>{t("providers.skyblink.footer", { year })}</span><span>{t("providers.terms")} | {t("providers.privacy")} | {t("providers.contactUs")}</span></footer>
      </div>
    </div>
  );
}

export default { view: SkyBlink, late: 2016 } satisfies Design;
