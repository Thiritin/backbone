import { VendorShop, type SiteProps } from "./VendorShop";

// WIZO: the friendly blue box from the shelf at the electronics store.
export const WizoSite = (p: SiteProps) => (
  <VendorShop {...p} id="wizo" look={{ brand: "#1f5fa8", ink: "#fff", page: "#e6eef8", font: "Tahoma, Verdana, sans-serif" }}
    logo={<span className="bv-logo"><b>WIZO</b> Mein Büro</span>} />
);
