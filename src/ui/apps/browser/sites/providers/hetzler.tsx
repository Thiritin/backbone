import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { spacePrice } from "../../../../../sim/20-world/datacenters";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, fromPrice, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./hetzler.css";

// Hetzler: 2005 red bar, grey side menu and Verdana tables; 2017 white bar, a grey price hero and one card per data center.
function Hetzler(props: ProviderProps) {
  const { p, look, route, go, year } = props, price = euro(fromPrice(p.id)), cities = citiesOf(p.id).join(", ");
  const labels = { home: t("providers.hetzler.overview"), account: t("providers.hetzler.robot") };
  return (
    <div className={`ps ps-hetzler ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm">{look === "late" && <Logo provider="hetzler" size={22} />}HETZLER</A>
        {look === "early" ? <span className="hz-tab">{t("providers.hetzler.colocation")}</span> : <Nav route={route} go={go} labels={labels} />}
        {look === "early" && <A to="/account" go={go} className="hz-robot">{t("providers.hetzler.robot")}</A>}
      </header>
      <div className="hz-frame">
        {look === "early" && <Nav route={route} go={go} className="hz-menu" labels={labels} />}
        <main>
          {route.page === "home" ? (look === "early" ? <>
            <h2>{t("providers.hetzler.heroEarly")}</h2>
            <p>{t("providers.hetzler.textEarly", { cities, price })}</p>
            <SitesList p={p} go={go} />
            <p>{t("providers.hetzler.vat")}</p>
          </> : <>
            <section className="hz-hero">
              <h1>{t("providers.hetzler.heroLate")}</h1>
              <p>{t("providers.hetzler.textLate", { cities })}</p>
              <p className="hz-from">{t("providers.hetzler.from", { price })}</p>
              <A to="/order" go={go} className="ps-btn pri">{t("providers.hetzler.orderNow")}</A>
            </section>
            <div className="hz-cards">
              {dcsOf(p.id).map((d) => (
                <A key={d.id} to={`/sites/${d.id}`} go={go} className="hz-card">
                  <strong>{d.name}</strong><span>{d.city}</span>
                  <span className="hz-price">{t("providers.hetzler.from", { price: euro(spacePrice(d, "share", 8)) })}</span>
                </A>
              ))}
            </div>
          </>) : <>
            <h2 className="hz-title">{titleOf(route)}</h2>
            <Body {...props} />
          </>}
        </main>
      </div>
      <footer>{t("providers.hetzler.footer", { year })} · {t("providers.imprint")} · {t("providers.terms")} · {t("providers.privacy")}</footer>
    </div>
  );
}

export default { view: Hetzler, late: 2017 } satisfies Design;
