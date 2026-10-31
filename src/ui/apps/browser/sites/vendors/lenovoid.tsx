import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./lenovoid.css";

// Lenovoid: 2005 the new owner of a famous laptop line, white and grey with a red wordmark; 2014 a red band, flat and loud.
export function Lenovoid(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-lnv ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="lenovoid" size={22} /><b>lenovoid</b></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? t("browser-sites-2.lnvEarly") : t("browser-sites-2.lnvLate")}</h1>
            <p>{t("browser-sites-2.lnvText")}</p>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.lnvExplore")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.lnvNews")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.lnvFooter", { year })}</footer>
    </div>
  );
}
