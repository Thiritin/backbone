import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./cpanic.css";

const ICONS = ["Email Accounts", "File Manager", "Databases", "Domains", "Backups", "Statistics", "Security", "Software"];

// cPanic: the dark blue 2005 site with the grey side nav; from 2014 a flat hero with a code-drawn panel screenshot.
export function Cpanic(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const wm = <span className="sw-wm"><SiteMark id="cpanic" name={p.name} size={30} /><span>c<b>Panic</b></span></span>;
  if (look === "late") {
    return (
      <div className="sw sw-cpanic late">
        <header>{wm}<Nav {...props} /><Link to="pricing" go={go} className="buy">Buy Now</Link></header>
        {page === "home" ? (
          <div className="hero">
            <div>
              <h1>{p.site.tagline}</h1>
              <p>{p.site.blurb}</p>
              <Link to="download" go={go} className="sws-cta">Try it free</Link>
            </div>
            <div className="shot" aria-hidden>
              <div className="bar" />
              {ICONS.map((x) => <div key={x} className="ico"><i />{x}</div>)}
            </div>
          </div>
        ) : null}
        <main><Body {...props} /></main>
        <footer>© {year} cPanic, L.L.C. All rights reserved.</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-cpanic early">
      <header>{wm}<span className="tag">{p.site.tagline}!</span></header>
      <div className="cols">
        <Nav {...props} className="side" labels={{ download: "Install cPanic", pricing: "Licensing" }} />
        <main><h1>{page === "home" ? "Welcome to cPanic!" : p.name}</h1><Body {...props} /></main>
      </div>
      <footer>Copyright © 2000-{year} cPanic Inc. All Rights Reserved.</footer>
    </div>
  );
}
