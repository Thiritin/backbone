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
            <h1>{look === "early" ? "Upgrade your life. Rack it." : "Built for the cloud you run yourself."}</h1>
            <p>Gigabutt rack servers ship with the newest sockets first and more memory slots than the big brands.</p>
            <Link to="products" go={go} className="vs-cta">All servers</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>News</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Gigabutt Technology Co., Ltd.</footer>
    </div>
  );
}
