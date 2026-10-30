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
        <Nav page={page} go={go} labels={{ home: look === "early" ? "Home & Home Office" : "Home", products: "Servers & Networking" }} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "Dwell PowerEdgy rack servers" : "The power to do a little more"}</h1>
            <p>Built to order, tested in the factory and shipped to your rack.</p>
            <Link to="products" go={go} className="vs-cta">Shop servers</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>Dwell news</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Dwell Inc. Terms of Sale | Privacy | Recycling</footer>
    </div>
  );
}
