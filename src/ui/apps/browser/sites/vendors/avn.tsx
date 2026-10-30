import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./avn.css";

// AVN: a Berlin router maker, 2005 white with a grey left nav and the Impressum in the footer; 2014 a red header band.
export function Avn(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-avn ${look}`}>
      <header><span className="vs-wm"><Logo provider="avn" size={28} /><b>AVN</b></span><span className="vs-claim">Berlin</span></header>
      <div className="vs-frame">
        <Nav page={page} go={go} className="vs-side" labels={{ home: "Startseite", products: "Produkte", news: "Presse", support: "Service" }} />
        {page === "home" ? (
          <main>
            <h1>Fritz!Bocks: the home router of a nation</h1>
            <p>DSL, telephone and wireless in one red and silver box.</p>
            <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
            <h2>Presse</h2>
            <News m={m} month={month} limit={4} />
          </main>
        ) : (
          <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
        )}
      </div>
      <footer>© {year} AVN GmbH | Impressum | Datenschutz</footer>
    </div>
  );
}
