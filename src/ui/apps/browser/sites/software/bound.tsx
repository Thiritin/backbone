import { Body, Commands, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./bound.css";

const GETS = "After the install, the server answers DNS on port 53 for every zone you add to Bound.";

// Bound: a dense blue and white page in Times with a release column; 2019 keeps the blue and lays features out in cards.
export function Bound(props: SiteProps) {
  const { p, look, page, year } = props;
  const body = page === "download"
    ? <section><h2>Download</h2><p>{GETS}</p><Commands p={p} year={year} /></section>
    : look === "late" && page === "home" ? <Features p={p} className="cards" /> : <Body {...props} />;
  return (
    <div className={`sw sw-bound ${look}`}>
      {look === "early" && <div className="org">Internet Software Collective</div>}
      <header><span className="sw-wm"><SiteMark id="bound" name={p.name} size={look === "late" ? 26 : 20} /> Bound 9</span><Nav {...props} /></header>
      {look === "late" && page === "home" && <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>}
      <div className="cols">
        <main>{look === "early" && page === "home" && <h1>{p.site.tagline}</h1>}{body}</main>
        {look === "early" && (
          <aside>
            <h3>Current releases</h3>
            <p>Bound 9.{year - 2002}.2 (stable)<br />Bound 9.{year - 2001}.0 (beta)</p>
            <h3>Security advisories</h3>
            <p>Read the advisories before you upgrade a production name server.</p>
          </aside>
        )}
      </div>
      <footer>© {year} Internet Software Collective</footer>
    </div>
  );
}
