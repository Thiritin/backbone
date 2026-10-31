import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./gigabutt.css";

// Gigabutt: a board maker that sells servers, orange on black with a spec table up front; 2018 a black hero and cards.
export function Gigabutt(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-gbt ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="gigabutt" size={22} />GIGABUTT</span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? t("browser-sites-2.gbtEarly") : t("browser-sites-2.gbtLate")}</h1>
            <p>{t("browser-sites-2.gbtText")}</p>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.gbtAll")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.vNews")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.gbtFooter", { year })}</footer>
    </div>
  );
}
