import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./ubersmyth.css";

// Ubersmyth: charcoal and steel blue with a spaced capital wordmark.
export const Ubersmyth = (p: VendorProps) => <VendorPage {...p} id="ubersmyth" className="sv-ubersmyth" mark={<>UBERSMYTH</>} />;
