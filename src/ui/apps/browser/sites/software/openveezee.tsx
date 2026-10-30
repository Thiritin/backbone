import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./openveezee.css";

const TITLE = { home: "Main Page", features: "Features", pricing: "License", download: "Download" } as const;

// OpenVeeZee: a project wiki with a grey sidebar; 2016 adds a blue header band.
export function OpenVeeZee(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-openveezee ${look}`}>
      {look === "late" && <div className="band"><SiteMark id="openveezee" name={p.name} size={22} /> OpenVeeZee Wiki</div>}
      <div className="wiki">
        <aside>
          <div className="sw-logo"><SiteMark id="openveezee" name={p.name} size={64} /><span>OpenVeeZee</span></div>
          <h3>Navigation</h3>
          <Nav {...props} labels={{ home: "Main Page", pricing: "License" }} />
          <h3>Toolbox</h3>
          <p>What links here<br />Printable version</p>
        </aside>
        <main>
          <div className="sw-tabs"><span className="on">Page</span><span>Discussion</span><span>View source</span><span>History</span></div>
          <h1>{TITLE[page]}</h1>
          {page === "home" && <p className="lead"><b>{p.site.tagline}.</b></p>}
          <Body {...props} />
          <p className="mod">This page was last modified on 14 March {year}. Content is available under the GNU Free Documentation License.</p>
        </main>
      </div>
    </div>
  );
}
