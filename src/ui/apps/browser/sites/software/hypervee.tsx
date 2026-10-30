import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./hypervee.css";

const CRUMB = { home: "Overview", features: "What's New", pricing: "Licensing", download: "Installing" } as const;

// HyperVee: the dense 2008 library page with breadcrumbs; from 2016 the flat docs page with a left tree.
export function HyperVee(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-hypervee ${look}`}>
      <header><span className="corp"><SiteMark id="hypervee" name={p.name} size={18} /> Macrosoft {look === "early" ? "TechNot" : "Docs"}</span></header>
      <div className="cols">
        <aside>
          {look === "late" && <p className="tree">Windoors Server<br />&nbsp;&nbsp;Virtualization<br />&nbsp;&nbsp;&nbsp;&nbsp;HyperVee</p>}
          <Nav {...props} labels={CRUMB} />
        </aside>
        <main>
          <p className="crumb">Library &gt; Windoors Server &gt; Virtualization &gt; HyperVee &gt; {CRUMB[page]}</p>
          <h1>HyperVee {CRUMB[page]}</h1>
          {page === "home" && <p><b>{p.site.tagline}.</b> Applies to: Windoors Server 2008 and later.</p>}
          <Body {...props} />
          <p className="foot">© {year} Macrosoft. All rights reserved. Was this page helpful? Yes No</p>
        </main>
      </div>
    </div>
  );
}
