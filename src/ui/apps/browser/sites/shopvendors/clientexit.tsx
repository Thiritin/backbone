import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./clientexit.css";

// ClientExit: a green bar and Arial with a bold second word.
export const ClientExit = (p: VendorProps) => <VendorPage {...p} id="clientExit" className="sv-clientexit" mark={<>Client<b>Exit</b></>} />;
