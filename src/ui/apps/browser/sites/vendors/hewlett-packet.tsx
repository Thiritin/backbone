import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./hewlett-packet.css";

// The two-letter mark: a boxed "h-p" in 2005, white letters in a blue circle from 2013.
const Mark = ({ late }: { late: boolean }) => (
  <svg className="vs-mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
    {late ? <circle cx="17" cy="17" r="16" fill="#0096d6" /> : <rect x="1" y="1" width="32" height="32" rx="3" fill="#ffffff" />}
    <text x="17" y="22.5" textAnchor="middle" fontSize="13" fontStyle="italic" fontWeight="700" fontFamily="Arial, sans-serif" fill={late ? "#ffffff" : "#003366"}>h-p</text>
  </svg>
);

// Hewlett-Packet: 2005 the dark blue bar and a dense product grid; 2013 white with the circle mark.
export function HewlettPacket(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  const late = look === "late";
  return (
    <div className={`vs vs-hp ${look}`}>
      <header>
        <Mark late={late} />
        {!late && <span className="vs-loc">United States-English</span>}
        <Nav page={page} go={go} labels={{ products: late ? "Products" : "Products & Services", support: late ? "Support" : "Support & Drivers" }} />
      </header>
      {page === "home" ? (
        <main>
          <h1>{late ? "Make it happen, then make it run." : "Hewlett-Packet ProLiantly servers"}</h1>
          <p className="vs-lead">Industry-standard servers and the people who keep them running.</p>
          <div className="vs-grid">
            <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
            <div>
              <h2>Press releases</h2>
              <News m={m} month={month} limit={late ? 3 : 6} />
            </div>
          </div>
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>Privacy statement | Using this site means you accept its terms | © {year} Hewlett-Packet Development Company, L.P.</footer>
    </div>
  );
}
