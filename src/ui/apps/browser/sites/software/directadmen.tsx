import { Body, Commands, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./directadmen.css";

// DirectAdmen: a plain page last touched in 2003; from 2018 one dark page that scrolls through everything.
export function DirectAdmen(props: SiteProps) {
  const { p, look, year } = props;
  if (look === "late") {
    return (
      <div className="sw sw-directadmen late">
        <header><span className="sw-wm"><SiteMark id="directadmen" name={p.name} size={26} /> DirectAdmen</span><Nav {...props} /></header>
        <div className="hero"><h1>{p.site.tagline}.</h1><p>{p.site.blurb}</p></div>
        <section><h2>Features</h2><Features p={p} className="grid" /></section>
        <section><h2>Pricing</h2><Pricing p={p} /></section>
        <section><h2>Install</h2><Commands p={p} year={year} /></section>
        <footer>© {year} JBMC Softwhere</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-directadmen early">
      <h1><SiteMark id="directadmen" name={p.name} size={20} /> DirectAdmen Web Control Panel</h1>
      <Nav {...props} className="links" />
      <hr />
      {props.page === "home" && <p><i>{p.site.tagline}!</i></p>}
      <Body {...props} />
      <hr />
      <p className="upd">Page last updated: June 12, 2003</p>
    </div>
  );
}
