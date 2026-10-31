import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./dwell.css";

// Dwell: 2005 blue and white with product-category boxes; 2013 flat with a big hero.
export function Dwell(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-dwell ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="dwell" size={look === "early" ? 30 : 26} /><b>DWELL</b></span>
        <Nav page={page} go={go} labels={{ home: look === "early" ? t("browser-sites-2.dwellHomeOffice") : t("browser-sites-2.navHome"), products: t("browser-sites-2.dwellServers") }} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? t("browser-sites-2.dwellEarly") : t("browser-sites-2.dwellLate")}</h1>
            <p>{t("browser-sites-2.dwellText")}</p>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.dwellShop")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.dwellNews")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.dwellFooter", { year })}</footer>
    </div>
  );
}
