import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./hostbull.css";

// HostBull: a burnt orange bar in Trebuchet.
export const HostBull = (p: VendorProps) => <VendorPage {...p} id="hostBull" className="sv-hostbull" mark={<>Host<b>Bull</b></>} />;
