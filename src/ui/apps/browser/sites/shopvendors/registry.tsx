import type { ComponentType } from "react";
import type { ShopId } from "../../../../../sim/10-catalog/shops";
import type { VendorProps } from "./ShopVendorSite";
import { ModemBill } from "./modembill";
import { ClientExit } from "./clientexit";
import { WHMCache } from "./whmcache";
import { Blessta } from "./blessta";
import { HostBull } from "./hostbull";
import { Ubersmyth } from "./ubersmyth";
import { OrderBocks } from "./orderbocks";
import { BoxBillin } from "./boxbillin";

const SITES: Partial<Record<ShopId, ComponentType<VendorProps>>> = { modemBill: ModemBill, clientExit: ClientExit, whmCache: WHMCache, blessta: Blessta, hostBull: HostBull, ubersmyth: Ubersmyth, orderBocks: OrderBocks, boxBillin: BoxBillin };

export function ShopVendorSite({ id, ...p }: VendorProps & { id: ShopId }) {
  const Site = SITES[id];
  return Site ? <Site {...p} /> : null;
}
