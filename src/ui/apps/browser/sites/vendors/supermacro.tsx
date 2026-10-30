import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./supermacro.css";

// SuperMacro: green and grey with dense tables in Verdana, barely changing until the flat site of 2016.
export function SuperMacro(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  return (
    <div className={`vs vs-smc ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider="supermacro" size={24} /><b>Super</b>Macro</span>
        <span className="vs-slogan">{look === "early" ? "We Keep IT Greenish" : "Building Block Solutions"}</span>
      </header>
      <Nav page={page} go={go} className="vs-bar" />
      {page === "home" ? (
        <main>
          {look === "late" && <section className="vs-hero"><h1>Server building blocks, first to market.</h1><Link to="products" go={go} className="vs-cta">See every system</Link></section>}
          <table className="vs-lines">
            <thead><tr><th>Product line</th><th>Latest news</th></tr></thead>
            <tbody>
              <tr>
                <td><ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul></td>
                <td><News m={m} month={month} limit={look === "early" ? 8 : 4} /></td>
              </tr>
            </tbody>
          </table>
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>Copyright © 1993-{year} SuperMacro Computer, Inc. All rights reserved.</footer>
    </div>
  );
}
