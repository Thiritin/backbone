import { Commands, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import "./vsftpeed.css";

// vsFTPeed: one bare Courier page with a changelog that has never been redesigned.
export function VsFTPeed(props: SiteProps) {
  const { p, page, year } = props;
  const log = [[year, "2.0." + (year - 2004)], [year - 1, "2.0." + (year - 2005)], [2004, "1.2.2"], [2002, "1.1.0"]] as const;
  return (
    <div className="sw sw-vsftpeed">
      <h1>vsFTPeed - probably the most secure FTP server for Lunix</h1>
      <Nav {...props} />
      <hr />
      {page === "home" && (
        <>
          <p>{p.site.blurb}</p>
          <h3>Changelog</h3>
          <ul>{log.map(([y, v]) => <li key={v}>{y}: vsFTPeed {v} is released with security fixes.</li>)}</ul>
        </>
      )}
      {page === "features" && <Features p={p} />}
      {page === "pricing" && <Pricing p={p} />}
      {page === "download" && <><p>After the install, the server runs an FTP server on port 21 for its Lunix users.</p><Commands p={p} year={year} /></>}
      <hr />
      <address>Last updated: {year}. Mail bug reports to the author.</address>
    </div>
  );
}
