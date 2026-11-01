import { VendorPage, type VendorProps } from "./ShopVendorSite";
import "./orderbocks.css";

// OrderBocks: a teal bar in Arial, ResellerKlub's house style.
export const OrderBocks = (p: VendorProps) => <VendorPage {...p} id="orderBocks" className="sv-orderbocks" mark={<>Order<b>Bocks</b></>} />;
