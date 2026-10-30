import { Body, Features, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./mailpig.css";

// Mailpig: one look, dark and flat with a pink accent.
export function Mailpig(props: SiteProps) {
  const { p, page, go, year } = props;
  return (
    <div className="sw sw-mailpig">
      <header><span className="sw-wm"><SiteMark id="mailpig" name={p.name} size={28} /> mailpig</span><Nav {...props} /></header>
      {page === "home" ? (
        <>
          <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p><Link to="download" go={go} className="btn">Get Mailpig</Link></div>
          <Features p={p} className="flat" />
        </>
      ) : <main><Body {...props} /></main>}
      <footer>© {year} The Mailpig project</footer>
    </div>
  );
}
