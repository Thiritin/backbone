import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./eatin.css";

// Eatin: 2005 a corporate blue power-management portal in Arial; 2015 white with a blue hero.
export function Eatin(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-etn ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="eatin" size={24} /><b>E·A·T·I·N</b></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "Powering business worldwide, one outage at a time." : "Power that keeps its promises."}</h1>
            <p>UPS systems and power distribution for the minutes between the grid and the generator.</p>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>News releases</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Eatin. All rights reserved.</footer>
    </div>
  );
}
