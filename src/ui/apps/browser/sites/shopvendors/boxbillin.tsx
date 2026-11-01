import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./boxbillin.css";

// BoxBillin': a lime community bar with a monospace wordmark.
export const BoxBillin = (p: VendorProps) => <VendorPage {...p} id="boxBillin" className="sv-boxbillin" mark={<>BoxBillin&apos;</>} />;
