import { Body, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./freepanel.css";

// FreePanel: a grey project page with a left list of links; from 2016 a README on a code host.
export function FreePanel(props: SiteProps) {
  const { p, look, page, year } = props;
  if (look === "late") {
    return (
      <div className="sw sw-freepanel late">
        <header><span className="repo"><SiteMark id="freepanel" name={p.name} size={20} /> freepanel / <b>freepanel</b></span><Nav {...props} className="sw-tabs" labels={{ home: "Code", features: "Wiki", pricing: "License", download: "Releases" }} /></header>
        <article>
          <div className="file">README.md</div>
          {page === "home" ? (
            <div className="md">
              <h1># FreePanel</h1>
              <p>{p.site.tagline}. {p.site.blurb}</p>
              <h2>## Features</h2>
              <Features p={p} />
            </div>
          ) : <div className="md"><Body {...props} /></div>}
        </article>
      </div>
    );
  }
  return (
    <div className="sw sw-freepanel early">
      <header><SiteMark id="freepanel" name={p.name} size={32} /><span>FreePanel</span><small>Hosted by SourceFurge.net</small></header>
      <div className="cols">
        <aside><b>Project</b><Nav {...props} labels={{ download: "Download" }} /><b>Support</b><p>Mailing lists<br />Bug tracker<br />CVS</p></aside>
        <main><h1>{p.site.tagline}</h1><Body {...props} /><p className="foot">Last release: {year}. Licensed under the GPL.</p></main>
      </div>
    </div>
  );
}
