import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./modembill.css";

// ModemBill: a navy bar and Tahoma, the look of a 2005 billing package.
export const ModemBill = (p: VendorProps) => <VendorPage {...p} id="modemBill" className="sv-modembill" mark={<>Modem<b>Bill</b></>} />;
