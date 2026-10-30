import { Commands, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./wireguarded.css";

// WireGuarded: one look, a manual page in monospace under a small red mark.
export function WireGuarded(props: SiteProps) {
  const { p, page, year } = props;
  return (
    <div className="sw sw-wireguarded">
      <header><span className="sw-wm"><SiteMark id="wireguarded" name={p.name} size={30} /> WireGuarded</span><Nav {...props} /></header>
      <main>
        <div className="man"><span>WG(8)</span><span>WireGuarded</span><span>WG(8)</span></div>
        {page === "home" && <><h2>NAME</h2><p>wireguarded - fast, modern, secure VPN tunnel</p><h2>DESCRIPTION</h2><p>{p.site.blurb}</p></>}
        {(page === "home" || page === "features") && <><h2>FEATURES</h2><Features p={p} /></>}
        {page === "pricing" && <><h2>LICENSE</h2><Pricing p={p} /></>}
        {page === "download" && <><h2>INSTALLATION</h2><p>After the install, the server is a VPN gateway that peers reach on UDP port 51820.</p><Commands p={p} year={year} /></>}
        <h2>SEE ALSO</h2><p>wg(8), wg-quick(8), ip(8)</p>
        <div className="man"><span>WireGuarded {year}</span><span /><span>WG(8)</span></div>
      </main>
    </div>
  );
}
