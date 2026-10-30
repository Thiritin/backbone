import { Body, Features, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./minnio.css";

// MinnIO: dark with a red accent and a terminal block in the hero; 2021 turns white with red cards.
export function MinnIO(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-minnio ${look}`}>
      <header><span className="sw-wm"><SiteMark id="minnio" name={p.name} size={26} /> MINNIO</span><Nav {...props} /></header>
      {page === "home" ? (
        <>
          <div className="hero">
            <div><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p><Link to="download" go={go} className="btn">Download</Link></div>
            {look === "early" && <pre className="term">{"$ ./minnio server /data\nAPI: http://10.0.0.5:9000\nConsole: http://10.0.0.5:9001\n\nStatus: 1 Online, 0 Offline."}</pre>}
          </div>
          <Features p={p} className="cards" />
        </>
      ) : <main><Body {...props} /></main>}
      <footer>© {year} MinnIO, Inc.</footer>
    </div>
  );
}
