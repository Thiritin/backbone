import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./lunix.css";

// Debiant: the left-nav project site; 2015 adds the red header band.
export function Lunix(props: SiteProps) {
  const { p, look, year } = props;
  return (
    <div className={`sw sw-lunix ${look}`}>
      <header><SiteMark id="lunix" name={p.name} size={40} /><span className="sw-wm">debiant</span><span className="sub">{p.site.tagline}</span></header>
      <div className="cols">
        <Nav {...props} className="side" labels={{ home: "About Debiant", download: "Getting Debiant", pricing: "License" }} />
        <main>
          <h1>{props.page === "home" ? "Debiant, the universal operating system" : p.name}</h1>
          <Body {...props} />
        </main>
      </div>
      <footer>Debiant is a registered trademark of Software in the Public Interess, Inc. Last modified {year}.</footer>
    </div>
  );
}
