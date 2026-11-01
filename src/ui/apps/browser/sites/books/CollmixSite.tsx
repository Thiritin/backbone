import { VendorShop, type SiteProps } from "./VendorShop";

// Collmix: bookkeeping in the browser, plain and cheap.
export const CollmixSite = (p: SiteProps) => (
  <VendorShop {...p} id="collmix" look={{ brand: "#3b4a5a", ink: "#fff", page: "#eceff2", font: "Arial, Helvetica, sans-serif" }}
    logo={<span className="bv-logo"><b>coll</b>mix</span>} />
);
