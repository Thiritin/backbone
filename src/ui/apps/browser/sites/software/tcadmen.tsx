import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./tcadmen.css";

// TCAdmen: a black and lime front page laid out like a forum; from 2016 flat dark tiles.
export function TCAdmen(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-tcadmen ${look}`}>
      <header><span className="sw-wm"><SiteMark id="tcadmen" name={p.name} size={30} /> TCAdmen</span><Nav {...props} labels={{ download: "Install" }} /></header>
      {page === "home" && look === "early" && (
        <table className="board">
          <thead><tr><th>Announcements</th><th>Posted</th><th>Replies</th></tr></thead>
          <tbody>
            {p.site.features.map((f, i) => <tr key={f}><td><b>{f}</b><br /><small>by TCAdmen Staff</small></td><td className="num">{year}-0{(i % 9) + 1}-1{i}</td><td className="num">{(i + 3) * 17}</td></tr>)}
          </tbody>
        </table>
      )}
      {page === "home" && look === "late" && (
        <>
          <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>
          <div className="tiles">{p.site.features.map((f, i) => <Link key={f} to={i % 2 ? "pricing" : "features"} go={go} className="tile">{f}</Link>)}</div>
        </>
      )}
      {page !== "home" && <main><Body {...props} /></main>}
      <footer>Powered by TCAdmen. © {year} TCAdmen Inc.</footer>
    </div>
  );
}
