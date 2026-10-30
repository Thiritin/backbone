import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./microtick.css";

// MicroTick: a bare page from Riga, a dark blue bar over plain tables in 2005; 2017 the same bones in a lighter blue.
export function MicroTick(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-mtk ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="microtick" size={20} /><b>MicroTick</b></span>
        <Nav page={page} go={go} labels={{ home: "Home", products: "Hardware", news: "News", support: "Documentation" }} />
      </header>
      {page === "home" ? (
        <main>
          <h1>Routing for everyone, at a price everyone can afford.</h1>
          <p>RouterOSs runs on every board we make. Buy the hardware, get the software.</p>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>News</h2>
          <News m={m} month={month} limit={6} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>Copyright 1999-{year} MicroTick</footer>
    </div>
  );
}
