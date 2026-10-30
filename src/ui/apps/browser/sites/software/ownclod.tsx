import { Body, Features, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./ownclod.css";

// OwnClod: white and blue with rounded buttons; 2016 puts a dark blue hero over feature cards.
export function OwnClod(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-ownclod ${look}`}>
      <header><span className="sw-wm"><SiteMark id="ownclod" name={p.name} size={28} /> ownClod</span><Nav {...props} /></header>
      {page === "home" ? (
        <>
          <div className="hero">
            <h1>{p.site.tagline}</h1>
            <p>{p.site.blurb}</p>
            <div className="btns"><Link to="download" go={go} className="btn">Download Server</Link><Link to="features" go={go} className="btn ghost">See the features</Link></div>
          </div>
          {look === "late" ? <Features p={p} className="cards" /> : <main><Features p={p} /></main>}
        </>
      ) : <main><Body {...props} /></main>}
      <footer>© {year} OwnClod, Inc.</footer>
    </div>
  );
}
