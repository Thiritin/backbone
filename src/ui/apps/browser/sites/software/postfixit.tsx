import { Commands, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import "./postfixit.css";

// Postfixit: one look, the plain home page of a mailing-list project with Courier headings.
export function Postfixit(props: SiteProps) {
  const { p, page, year } = props;
  return (
    <div className="sw sw-postfixit">
      <table className="top"><tbody><tr><td><h1>The Postfixit Home Page</h1></td><td className="mirror">Mirror: postfixit.org</td></tr></tbody></table>
      <Nav {...props} labels={{ home: "Overview", pricing: "License" }} />
      {page === "home" && (
        <>
          <p>{p.site.blurb}</p>
          <h2>Mailing lists</h2>
          <p>postfixit-announce carries release announcements. postfixit-users answers questions; read the archive and the FAQ before you post.</p>
          <h2>Latest release</h2>
          <p>Postfixit 2.{year - 2003}.{year % 7} is the stable release of {year}.</p>
        </>
      )}
      {page === "features" && <><h2>Features</h2><Features p={p} /></>}
      {page === "pricing" && <><h2>License</h2><Pricing p={p} /></>}
      {page === "download" && <><h2>Download</h2><p>After the install, the server is a mail server that takes mail on ports 25 and 587.</p><Commands p={p} year={year} /></>}
      <address>Last changed: {year}. Send questions to the postfixit-users list.</address>
    </div>
  );
}
