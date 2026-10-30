import { Body, Features, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./openveepeen.css";

// OpenVeePeeN: white and orange with the old download list; 2017 goes dark with orange cards.
export function OpenVeePeeN(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const mark = <span className="sw-wm"><SiteMark id="openveepeen" name={p.name} size={28} /> OpenVeePeeN</span>;
  if (look === "late") {
    return (
      <div className="sw sw-openveepeen late">
        <header>{mark}<Nav {...props} /><Link to="download" go={go} className="try">Get Access Server</Link></header>
        {page === "home" ? (
          <>
            <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>
            <Features p={p} className="cards" />
          </>
        ) : <main><Body {...props} /></main>}
        <footer>© {year} OpenVeePeeN Inc.</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-openveepeen early">
      <header>{mark}<span className="tag">{p.site.tagline}</span></header>
      <Nav {...props} className="bar" />
      <main>
        <Body {...props} />
        {page === "home" && (
          <table className="files">
            <thead><tr><th>File</th><th>Released</th></tr></thead>
            <tbody>
              <tr><td>openveepeen-2.0.{year - 2000}.tar.gz</td><td className="num">{year}-04-08</td></tr>
              <tr><td>openveepeen-2.0.{year - 2000}-install.exe</td><td className="num">{year}-04-08</td></tr>
              <tr><td>openveepeen-1.6.0.tar.gz</td><td className="num">2004-05-09</td></tr>
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
