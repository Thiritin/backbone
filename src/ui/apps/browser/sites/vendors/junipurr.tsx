import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./junipurr.css";

// Junipurr: 2005 a carrier vendor in white and green with a left column of products; 2014 dark navy and green, flat.
export function Junipurr(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-jnp ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="junipurr" size={24} /><b>Junipurr</b><small>NETWORKS</small></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero"><h1>{look === "early" ? t("browser-sites-2.jnpEarly") : t("browser-sites-2.jnpLate")}</h1></section>
          <div className="vs-cols">
            <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
            <div><h2>{t("browser-sites-2.pressReleases")}</h2><News m={m} month={month} limit={5} /></div>
          </div>
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.jnpFooter", { year })}</footer>
    </div>
  );
}
