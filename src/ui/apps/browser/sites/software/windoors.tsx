import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./windoors.css";

// Windoors Server: the 2005 gradient header with product boxes; flat tiles from 2012.
export function Windoors(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const tiles = look === "late" && page === "home";
  return (
    <div className={`sw sw-windoors ${look}`}>
      <header>
        <span className="corp"><SiteMark id="windoors" name={p.name} size={18} /> Macrosoft</span>
        <span className="sw-wm">Windoors Server</span>
        <Nav {...props} className="sw-tabs" labels={{ home: "Overview", download: "Evaluate" }} />
      </header>
      {tiles ? (
        <main className="metro">
          <h1>{p.site.tagline}</h1>
          <div className="grid">
            <Link to="features" go={go} className="tile t1">{p.site.features[0]}</Link>
            <Link to="pricing" go={go} className="tile t2">Pricing and licensing</Link>
            <Link to="download" go={go} className="tile t3">Get the installation media</Link>
            <span className="tile t4">{p.site.blurb}</span>
          </div>
        </main>
      ) : (
        <main>
          {page === "home" && <div className="boxes">{p.site.features.slice(0, 3).map((f) => <div key={f} className="box">{f}</div>)}</div>}
          <h1>{page === "home" ? p.site.tagline : p.name}</h1>
          <Body {...props} />
        </main>
      )}
      <footer>© {year} Macrosoft Corporation. All rights reserved. Terms of Use. Trademarks. Privacy Statement.</footer>
    </div>
  );
}
