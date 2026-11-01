import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./whmcache.css";

// WHMCache: dark blue with an orange wordmark, the busiest of the shop sites.
export const WHMCache = (p: VendorProps) => <VendorPage {...p} id="whmCache" className="sv-whmcache" mark={<><b>WHM</b>Cache</>} />;
