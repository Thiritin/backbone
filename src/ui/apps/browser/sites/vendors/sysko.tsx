import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./sysko.css";

// Sysko: 2005 the corporate blue with product tabs and tiny type; 2015 white and teal.
export function Sysko(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-sysko ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="sysko" size={look === "early" ? 28 : 24} /><b>SYSKO SYSTEMS</b></span>
        <Nav page={page} go={go} className="vs-tabs" labels={{ products: "Products & Solutions", support: "Technical Support" }} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? "The Network Is the Data Centre" : "Built for what connects next"}</h1>
            <p>Routing, switching and security for every network, from the branch office to the core.</p>
          </section>
          <div className="vs-cols">
            <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
            <div><h2>News@Sysko</h2><News m={m} month={month} limit={5} /></div>
          </div>
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>Contacts | Feedback | Site Map | Terms & Conditions | Privacy Statement | © 1992-{year} Sysko Systems, Inc.</footer>
    </div>
  );
}
