import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./blessta.css";

// Blessta: a plum bar and a lower-case Georgia wordmark.
export const Blessta = (p: VendorProps) => <VendorPage {...p} id="blessta" className="sv-blessta" mark={<>blessta</>} />;
