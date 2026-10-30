import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./plain.css";

// One plain layout for the smaller makers: the wordmark in the maker's colour, a pitch and the product classes.
const PITCH: Record<string, [early: string, late: string]> = {
  nettgear: ["Business switches without the business price.", "The network your small business runs on."],
  ubiquitea: ["Enterprise networking at a fraction of the cost.", "Rethinking IT."],
  "d-lunk": ["Building networks for people.", "Connect to more."],
  netgoat: ["Open source firewalls, factory built.", "pfSinse Plus on hardware we stand behind."],
  sophosphate: ["Security made simple.", "Cybersecurity evolved."],
  apcee: ["Legendary reliability.", "Certainty in a connected world."],
  vertivo: ["Power and cooling for the critical.", "Architects of continuity."],
};
export function Plain(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  const [early, late] = PITCH[m.id] ?? ["", ""];
  return (
    <div className={`vs vs-plain vs-${m.id} ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider={m.id} size={22} />{m.name}</span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? early : late}</h1>
            <Link to="products" go={go} className="vs-cta">Products</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>News</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} {m.name}</footer>
    </div>
  );
}
