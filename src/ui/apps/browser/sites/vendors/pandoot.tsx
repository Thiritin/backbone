import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./pandoot.css";

// Pandoot: 2005 a navy and grey cabling catalogue with part tables; 2016 white with blue cards.
export function Pandoot(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-pdt ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="pandoot" size={24} /><b>PANDOOT</b></span>
        <Nav page={page} go={go} labels={{ products: "Online Catalog" }} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "Physical infrastructure, one jack at a time." : "Every cable has a place."}</h1>
            <p>Patch panels, labels and cable management for racks that someone will have to read again.</p>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>What's new</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Pandoot Corp. All rights reserved.</footer>
    </div>
  );
}
