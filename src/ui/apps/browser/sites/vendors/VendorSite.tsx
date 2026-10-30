import type { ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { brandOnSale, priceOf, type DeviceKind, type Manufacturer } from "../../../../../sim/10-catalog/hardware";
import type { Look } from "../../../../../sim/10-catalog/sites";
import { vendorReleases, type Release } from "../../../../../sim/80-business/vendors";
import "./vendors.css";

// docs/design/software.md, 8.6: the pieces every manufacturer site lays out in its own look.
export type VendorPage = "home" | "products" | "news" | "support";
export interface VendorProps { m: Manufacturer; look: Look; page: VendorPage; year: number; month: number; go: (path: string) => void }

const PAGES: VendorPage[] = ["home", "products", "news", "support"];
export const pageOf = (path: string): VendorPage => PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
const pathOf = (page: VendorPage) => (page === "home" ? "/" : `/${page}`);

export function Nav({ page, go, className, labels }: Pick<VendorProps, "page" | "go"> & { className?: string; labels?: Partial<Record<VendorPage, string>> }) {
  const name: Record<VendorPage, string> = { home: "Home", products: "Products", news: "News", support: "Support", ...labels };
  return (
    <nav className={className}>
      {PAGES.map((x) => (
        <a key={x} href={`#${x}`} aria-current={x === page ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(pathOf(x)); }}>{name[x]}</a>
      ))}
    </nav>
  );
}

export const Link = ({ to, go, className, children }: { to: VendorPage; go: VendorProps["go"]; className?: string; children: ReactNode }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(pathOf(to)); }}>{children}</a>
);

const CLASS: Record<string, string> = {
  server: "Servers", chassis: "Multi-node chassis", switch: "Switches", firewall: "Firewalls", gateway: "Routers", patch: "Patch panels", ups: "UPS", pdu: "Power distribution",
};
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (month: number) => `${MONTH[month % 12]} ${Math.floor(month / 12)}`;
const classOf = (r: Release): DeviceKind => (r.model.server ? "server" : r.model.kind);

// The product classes this brand builds, in catalog order.
export const classesOf = (m: Manufacturer): string[] => m.kinds.filter((k) => CLASS[k]).map((k) => CLASS[k]);

// What the Shop sells from this brand this month, one table per class with the year each model came out.
export function Products({ m, month, className }: { m: Manufacturer; month: number; className?: string }) {
  const sold = vendorReleases(m, month).filter((r) => brandOnSale(r.model, m.name, month)).reverse();
  const kinds = [...new Set(sold.map(classOf))];
  return (
    <div className={className}>
      {kinds.map((k) => (
        <section key={k}>
          <h2>{CLASS[k]}</h2>
          <table>
            <thead><tr><th>Model</th><th className="num">Released</th><th className="num">Price</th></tr></thead>
            <tbody>
              {sold.filter((r) => classOf(r) === k).map((r) => (
                <tr key={r.model.id}><td>{r.model.name}</td><td className="num">{Math.floor(r.month / 12)}</td><td className="num">{euro(priceOf(r.model, m.name))}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {kinds.length === 0 && <p>{m.name} has no products on sale.</p>}
    </div>
  );
}

// The brand's releases up to this month, newest first.
export function News({ m, month, limit, className }: { m: Manufacturer; month: number; limit?: number; className?: string }) {
  const out = vendorReleases(m, month).slice(0, limit);
  return (
    <ul className={`vs-news ${className ?? ""}`}>
      {out.map((r) => <li key={r.model.id}><time>{monthLabel(r.month)}</time> <span>{t(r.key, r.params)}</span></li>)}
    </ul>
  );
}

// One paragraph and the support term the catalog gives the brand's models.
export function Support({ m, className }: { m: Manufacturer; className?: string }) {
  const years = Math.max(0, ...vendorReleases(m).map((r) => r.model.supportYears));
  return (
    <div className={className}>
      <p>{m.name} support answers by phone and by mail around the clock.</p>
      <p className="vs-warranty">{years > 0 ? `Every ${m.name} product gets spare parts and repairs for ${years} years after its last year on sale.` : `${m.name} products stay on sale and need no service contract.`}</p>
    </div>
  );
}

// The body of every page but home, which each site lays out itself.
export function Body(props: VendorProps & { className?: string }) {
  const { m, page, month, className } = props;
  if (page === "products") return <Products m={m} month={month} className={className} />;
  if (page === "news") return <News m={m} month={month} className={className} />;
  if (page === "support") return <Support m={m} className={className} />;
  return null;
}

export const TITLE: Record<VendorPage, string> = { home: "", products: "Products", news: "News", support: "Support" };
