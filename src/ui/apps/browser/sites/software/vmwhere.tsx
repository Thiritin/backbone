import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./vmwhere.css";

const EDITIONS = ["Standard", "Enterprise", "Enterprise Plus"];

// VMwhere: corporate grey with blue tabs and a product matrix; product tiles from 2015.
export function VMwhere(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-vmwhere ${look}`}>
      <header>
        <span className="sw-wm"><SiteMark id="vmwhere" name={p.name} size={22} /><b>vm</b>where</span>
        <Nav {...props} className="sw-tabs" labels={{ home: "Products", download: "Downloads" }} />
      </header>
      <main>
        <p className="crumb">Products &gt; Datacenter Virtualization &gt; vSphear</p>
        <h1>VMwhere vSphear: {p.site.tagline}</h1>
        {page === "home" && look === "early" && (
          <table className="matrix">
            <thead><tr><th>Capability</th>{EDITIONS.map((e) => <th key={e}>{e}</th>)}</tr></thead>
            <tbody>{p.site.features.map((f, i) => <tr key={f}><td>{f}</td>{EDITIONS.map((e, j) => <td key={e}>{j >= Math.min(i, 2) ? "●" : ""}</td>)}</tr>)}</tbody>
          </table>
        )}
        {page === "home" && look === "late" && (
          <div className="tiles">
            {p.site.features.map((f, i) => (
              <Link key={f} to={i === 3 ? "pricing" : "features"} go={go} className={i === 3 ? "tile suite" : "tile"}>{i === 3 && <b>App Suite</b>}{f}</Link>
            ))}
          </div>
        )}
        <Body {...props} />
      </main>
      <footer>Copyright © 1998-{year} VMwhere, Inc. All rights reserved. VMwhere and vSphear are registered trademarks or trademarks of VMwhere, Inc.</footer>
    </div>
  );
}
