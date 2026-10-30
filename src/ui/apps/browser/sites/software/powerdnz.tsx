import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./powerdnz.css";

// PowerDNZ: white and orange with a left nav in Verdana; 2016 turns it into a documentation site under a dark header.
export function PowerDNZ(props: SiteProps) {
  const { p, look, page, year } = props;
  const mark = <span className="sw-wm"><SiteMark id="powerdnz" name={p.name} size={look === "late" ? 22 : 30} /> PowerDNZ</span>;
  if (look === "late") {
    return (
      <div className="sw sw-powerdnz late">
        <header>{mark}<span className="ver">Documentation, version 4.{year - 2016}</span></header>
        <div className="docs">
          <aside>
            <h3>Getting started</h3>
            <Nav {...props} labels={{ home: "Overview", download: "Installing" }} />
            <h3>Reference</h3>
            <p>Backends<br />HTTP API<br />DNSSEC<br />Settings</p>
          </aside>
          <main>
            <div className="crumbs">Docs / {page === "home" ? "Overview" : page[0].toUpperCase() + page.slice(1)}</div>
            {page === "home" && <h1>{p.site.tagline}</h1>}
            <Body {...props} />
          </main>
        </div>
      </div>
    );
  }
  return (
    <div className="sw sw-powerdnz early">
      <header>{mark}<span className="tag">{p.site.tagline}</span></header>
      <div className="cols">
        <aside><Nav {...props} /><p className="news"><b>News</b><br />PowerDNZ 2.{year - 2004} is released with a faster database backend.</p></aside>
        <main><Body {...props} /></main>
      </div>
      <footer>© {year} The PowerDNZ community</footer>
    </div>
  );
}
