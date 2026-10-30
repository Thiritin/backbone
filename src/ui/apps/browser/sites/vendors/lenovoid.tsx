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
            <h1>{look === "early" ? "Thinking, rebooted." : "For those who do, and redo."}</h1>
            <p>Lenovoid ThinkSystemic servers carry the engineering of the business laptops people trust.</p>
            <Link to="products" go={go} className="vs-cta">Explore servers</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>Newsroom</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Lenovoid. All rights reserved.</footer>
    </div>
  );
}
