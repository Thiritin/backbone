import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./pablo-alto.css";

// Pablo Alto: 2005 a charcoal start-up page with an orange accent; 2015 white with a big orange hero.
export function PabloAlto(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-pan ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="pablo-alto" size={24} /><b>pablo alto</b><small>networks</small></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? t("browser-sites-2.panEarly") : t("browser-sites-2.panLate")}</h1>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.panSee")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.panPress")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.panFooter", { year })}</footer>
    </div>
  );
}
