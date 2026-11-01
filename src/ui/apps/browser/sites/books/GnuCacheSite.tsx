import { VendorShop, type SiteProps } from "./VendorShop";

// GnuCache: free software, a plain project page.
export const GnuCacheSite = (p: SiteProps) => (
  <VendorShop {...p} id="gnucache" look={{ brand: "#4e9a06", ink: "#fff", page: "#f3f3f1", font: "Verdana, \"DejaVu Sans\", sans-serif" }}
    logo={<span className="bv-logo"><b>Gnu</b>Cache</span>} />
);
