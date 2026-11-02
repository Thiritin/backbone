import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { exchangeLabel } from "../../../locations/ui";
import { A, Body, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./borisnet.css";

// Boris Network: 2005 a small Nuremberg ISP with a lowercase wordmark, grey tabs, a quick-links box and a breadcrumb; 2016 a navy hero with a slanted edge and service tiles.
function BorisNet(props: ProviderProps) {
  const { p, look, route, go, year } = props, dc = dcsOf(p.id)[0];
  const labels = { home: t("providers.borisnet.navHome"), sites: t("providers.borisnet.navSites"), order: t("providers.borisnet.navOrder"), account: t("providers.borisnet.navPortal") };
  const tiles = [1, 2, 3].map((i) => <div key={i} className="bn-tile"><h3>{t(`providers.borisnet.tile${i}`)}</h3><p>{t(`providers.borisnet.tile${i}Text`)}</p></div>);
  return (
    <div className={`ps ps-borisnet ${look}`}>
      <div className="bn-top">
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="borisnet" size={look === "early" ? 26 : 22} /><span>boris <b>network</b></span></A>
        <span className="bn-claim">{t("providers.borisnet.claim")}</span>
      </header>
      <Nav route={route} go={go} className="bn-nav" labels={labels} />
      </div>
      {look === "early" && <div className="bn-crumb">{t("providers.borisnet.here")} <A to="/" go={go}>{labels.home}</A>{route.page !== "home" && <> &gt; {titleOf(route)}</>}</div>}
      <div className="bn-frame">
        {look === "early" && (
          <aside>
            <div className="bn-box"><h3>{t("providers.borisnet.quick")}</h3><Nav route={route} go={go} items={["sites", "order", "account"]} labels={labels} /></div>
            <div className="bn-box"><h3>{dc.name}</h3><p>{t("providers.borisnet.box", { city: dc.city, carriers: dc.carriers, exchange: exchangeLabel(dc) })}</p></div>
          </aside>
        )}
        <main>
          {route.page === "home" ? <>
            <section className="bn-hero">
              <h1>{look === "early" ? t("providers.borisnet.heroEarly") : t("providers.borisnet.heroLate")}</h1>
              <p>{t("providers.borisnet.text", { name: dc.name, city: dc.city })}</p>
              {look === "late" && <div className="ps-actions"><A to="/order" go={go} className="ps-btn pri">{t("providers.borisnet.cta")}</A><A to={`/sites/${dc.id}`} go={go} className="ps-btn">{labels.sites}</A></div>}
            </section>
            {look === "early" ? <><h2>{t("providers.borisnet.services")}</h2><div className="bn-tiles">{tiles}</div><p><A to="/order" go={go}>{t("providers.borisnet.cta")}</A></p></> : <div className="bn-tiles">{tiles}</div>}
            {dc.certified && <p className="bn-certs">{t("providers.borisnet.certs")}</p>}
          </> : <div className="bn-body">
            <h1>{titleOf(route)}</h1>
            <Body {...props} />
          </div>}
        </main>
      </div>
      <footer><span>{t("providers.borisnet.footer", { year })}</span><span>{t("providers.imprint")} · {t("providers.terms")} · {t("providers.privacy")}</span></footer>
    </div>
  );
}

export default { view: BorisNet, late: 2016 } satisfies Design;
