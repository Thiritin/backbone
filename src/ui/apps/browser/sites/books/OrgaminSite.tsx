import { VendorShop, type SiteProps } from "./VendorShop";

// orgaMIN: the small-firm favourite in orange.
export const OrgaminSite = (p: SiteProps) => (
  <VendorShop {...p} id="orgamin" look={{ brand: "#e8731c", ink: "#fff", page: "#f6ece2", font: "Verdana, Geneva, sans-serif" }}
    logo={<span className="bv-logo">orga<b>MIN</b></span>} />
);
