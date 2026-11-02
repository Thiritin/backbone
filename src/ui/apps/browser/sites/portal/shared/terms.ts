import { t } from "../../../../../../i18n/en";
import type { ShopId } from "../../../../../../sim/10-catalog/shops";
import type { OrderStatus, ServiceStatus } from "../../../../../../sim/80-business/shop-orders";

// The service commands each shop system shows, under its own names (shop-books-split.md 9); an absent command is not offered.
export type Command = "suspend" | "unsuspend" | "terminate" | "changePackage" | "changePassword";
interface Terms { services: string; accept: string; commands: Partial<Record<Command, string>>; order?: Partial<Record<OrderStatus, string>>; service?: Partial<Record<ServiceStatus, string>> }

const FULL: Terms["commands"] = { suspend: "suspend", unsuspend: "unsuspend", terminate: "terminate", changePackage: "changePackage", changePassword: "changePassword" };
const TERMS: Record<ShopId, Terms> = {
  whmCache: { services: "productsServices", accept: "acceptOrder", commands: FULL },
  hostBull: { services: "accounts", accept: "acceptOrder", commands: FULL },
  blessta: { services: "services", accept: "accept", commands: { suspend: "suspend", unsuspend: "unsuspend", terminate: "cancel", changePackage: "changePackage" }, order: { active: "accepted" }, service: { terminated: "canceled", cancelled: "canceled" } },
  boxBillin: { services: "orders", accept: "activate", commands: { suspend: "suspend", unsuspend: "unsuspend", terminate: "cancel" }, order: { pending: "pendingSetup" }, service: { terminated: "canceled", cancelled: "canceled" } },
  clientExit: { services: "packages", accept: "activate", commands: { suspend: "suspend", unsuspend: "activate", terminate: "cancel" } },
  modemBill: { services: "clientPackages", accept: "approve", commands: { suspend: "suspend", unsuspend: "activate", terminate: "cancel" } },
  ubersmyth: { services: "services", accept: "approve", commands: { suspend: "suspend", unsuspend: "activate", terminate: "cancel" } },
  orderBocks: { services: "orders", accept: "activate", commands: { suspend: "suspend", unsuspend: "unsuspend", terminate: "delete" }, order: { pending: "inactive" } },
};

const of = (v: ShopId | null): Terms => TERMS[v ?? "whmCache"];
export const servicesLabel = (v: ShopId | null): string => t(`shop-terms.list.${of(v).services}`);
export const acceptLabel = (v: ShopId | null): string => t(`shop-terms.cmd.${of(v).accept}`);
export const commandLabel = (v: ShopId | null, c: Command): string | null => { const k = of(v).commands[c]; return k ? t(`shop-terms.cmd.${k}`) : null; };
export const orderStatusLabel = (v: ShopId | null, x: OrderStatus): string => t(`shop-terms.status.${of(v).order?.[x] ?? x}`);
export const serviceStatusLabel = (v: ShopId | null, x: ServiceStatus): string => t(`shop-terms.status.${of(v).service?.[x] ?? x}`);
