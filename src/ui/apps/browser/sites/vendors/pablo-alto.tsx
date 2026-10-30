import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./pablo-alto.css";

// Pablo Alto: 2005 a charcoal start-up page with an orange accent; 2015 white with a big orange hero.
export function PabloAlto(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-pan ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="pablo-alto" size={24} /><b>pablo alto</b><small>networks</small></span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "The firewall that knows which app is talking." : "Prevent the breach. Paint the perimeter."}</h1>
            <Link to="products" go={go} className="vs-cta">See the firewalls</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>Press</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} Pablo Alto Networks. All rights reserved.</footer>
    </div>
  );
}
