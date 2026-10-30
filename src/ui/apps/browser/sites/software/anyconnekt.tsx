import { Body, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./anyconnekt.css";

// Sysko AnyConnekt: the corporate blue with product tabs and tiny type; 2016 turns white and teal with product tiles.
export function AnyConnekt(props: SiteProps) {
  const { p, look, page, year } = props;
  const late = look === "late";
  return (
    <div className={`sw sw-anyconnekt ${look}`}>
      <div className="util">Worldwide [change] | Log In | Account | Register | My Sysko</div>
      <header>
        <span className="sw-wm"><SiteMark id="anyconnekt" name={p.name} size={late ? 26 : 22} color={late ? "#00a3c4" : undefined} /> SYSKO</span>
        <span className="crumb">Products and Services &gt; Security &gt; {p.name}</span>
      </header>
      <Nav {...props} className="tabs" labels={{ home: "Overview", download: "Software Download" }} />
      {late && page === "home" ? (
        <>
          <div className="hero"><h1>{p.name}</h1><p>{p.site.blurb}</p></div>
          <Features p={p} className="tiles" />
        </>
      ) : (
        <main>{page === "home" && <h1>{p.name}: {p.site.tagline}</h1>}<Body {...props} /></main>
      )}
      <footer>Contacts | Feedback | Help | Site Map | Terms and Conditions | Privacy Statement · © 1992-{year} Sysko Systems, Inc.</footer>
    </div>
  );
}
