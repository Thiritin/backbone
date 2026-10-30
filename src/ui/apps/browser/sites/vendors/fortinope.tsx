import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./fortinope.css";

// Fortinope: 2005 a grey gradient header with red accents in Tahoma; 2014 white, red and flat cards.
export function Fortinope(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-ftn ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="fortinope" size={24} /><b>FORTI</b>NOPE</span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "Unified Threat Mismanagement, solved." : "Security fabric for the whole rack."}</h1>
            <p>Every packet asks permission. Most of the time the answer is nope.</p>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>Threat news</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>Copyright © 2000-{year} Fortinope, Inc. All rights reserved.</footer>
    </div>
  );
}
