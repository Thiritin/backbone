import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./aristotle.css";

// Aristotle: 2005 a young switch maker, navy and sober with a serif wordmark; 2015 white, dark navy and flat.
export function Aristotle(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-ari ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="aristotle" size={24} /><b>ARISTOTLE</b></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? t("browser-sites-2.ariEarly") : t("browser-sites-2.ariLate")}</h1>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.ariSwitches")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.vNews")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>{t("browser-sites-2.ariFooter", { year })}</footer>
    </div>
  );
}
