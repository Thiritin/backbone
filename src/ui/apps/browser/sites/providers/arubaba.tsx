import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { SPACE_SIZES, spacePrice } from "../../../../../sim/20-world/datacenters";
import { Logo } from "../../../../art/logos";
import { spaceSize } from "../../../locations/ui";
import { A, Body, dcsOf, Nav, orderPath, SiteFacts, titleOf, type ProviderProps, type Rented } from "./ProviderSite";
import type { Design } from "./registry";
import "./arubaba.css";

// Arubaba: 2005 orange portal band with white tabs and boxed offers priced per month plus VAT; 2015 white bar, an orange pill and shadowed price cards.
function Arubaba(props: ProviderProps) {
  const { p, look, route, go, year } = props, dc = dcsOf(p.id)[0];
  const labels = { home: t("providers.arubaba.navHome"), sites: t("providers.arubaba.navSites"), order: t("providers.arubaba.navOrder"), account: t("providers.arubaba.clientArea") };
  const offers = (["share", "cage", "suite"] as Rented[]).filter((k) => k !== "cage" || dc.cages).flatMap((k) => (k === "share" ? SPACE_SIZES[k] : SPACE_SIZES[k].slice(0, 1)).map((n) => ({ k, n })));
  return (
    <div className={`ps ps-arubaba ${look}`}>
      {look === "early" && <div className="ar-top"><A to="/account" go={go}>{labels.account}</A></div>}
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="arubaba" size={look === "early" ? 30 : 26} /><span>arubaba<i>.it</i></span></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["home", "sites", "order"]} labels={labels} />
        {look === "late" && <A to="/account" go={go} className="ps-btn ar-area">{labels.account}</A>}
      </header>
      <main>
        {route.page === "home" ? <>
          <section className="ar-hero">
            <h1>{look === "early" ? t("providers.arubaba.heroEarly") : t("providers.arubaba.heroLate")}</h1>
            <p>{t("providers.arubaba.text", { city: dc.city, name: dc.name })}</p>
            {look === "late" && <A to="/sites" go={go} className="ps-btn pri">{t("providers.arubaba.discover")}</A>}
          </section>
          <div className="ar-offers">
            {offers.map(({ k, n }) => (
              <div key={`${k}-${n}`} className="ar-offer">
                <h3>{spaceSize(k, n)}</h3>
                <p className="ar-price">{t("providers.arubaba.from", { price: euro(spacePrice(dc, k, n)) })}</p>
                <p className="ar-vat">{t("providers.arubaba.perMonth")}</p>
                <A to={orderPath(dc, k, n)} go={go} className="ps-btn pri">{t("providers.arubaba.buy")}</A>
              </div>
            ))}
          </div>
          <p className="ar-note">{t("providers.arubaba.vat")}</p>
          {look === "early" && <div className="ar-dc"><h2>{dc.name}</h2><SiteFacts dc={dc} /></div>}
        </> : <div className="ar-body"><h1 className="ar-title">{titleOf(route)}</h1><Body {...props} /></div>}
      </main>
      <footer><span>{t("providers.arubaba.footer", { year })}</span><span>{t("providers.legal")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Arubaba, late: 2015 } satisfies Design;
