// Shop orders (shop-books-split.md 5): one storefront checkout, its items and its invoice. An item is a sales request until
// Create sets it up, then the service it became.
import { CYCLE_MONTHS, type Cycle } from "../10-catalog/cycles";
import { LINE_NAME, setupFee } from "../30-market/spec";
import { requestName, type SalesRequest } from "../30-market/market";
import type { GameState } from "../50-state";

export type OrderStatus = "pending" | "active" | "fraud" | "cancelled";
// amount is the first term with the setup fee, as charged at checkout.
export interface OrderItem { requestId: string; serviceId: string | null; name: string; cycle: Cycle; amount: number }
export interface ShopOrder { id: string; customerId: string | null; contact: string; items: OrderItem[]; invoiceId: string | null; status: OrderStatus; placedAt: number }

// Orders past their year are dropped unless still pending.
const KEEP_HOURS = 365 * 24;

export const orderNumber = (o: ShopOrder): string => o.id.slice(3);
export const orderTotal = (o: ShopOrder): number => Math.round(o.items.reduce((n, i) => n + i.amount, 0) * 100) / 100;
export const pendingOrders = (s: GameState): number => s.shop.orders.filter((o) => o.status === "pending").length;
export const orderFor = (s: GameState, requestId: string): ShopOrder | undefined => s.shop.orders.find((o) => o.items.some((i) => i.requestId === requestId));

// The order of a storefront checkout, numbered after its request so ids elsewhere stay as they were.
export function addShopOrder(s: GameState, r: SalesRequest, status: OrderStatus): void {
  const cycle = r.cycle ?? "monthly", name = s.shop.products.find((p) => p.id === r.productId)?.name ?? LINE_NAME[r.product];
  const amount = Math.round(((r.quote ?? 0) * CYCLE_MONTHS[cycle] + (r.setup ?? setupFee(s, r.product))) * 100) / 100;
  const o: ShopOrder = { id: `ord${r.id.slice(3)}`, customerId: r.customerId, contact: requestName(r), items: [{ requestId: r.id, serviceId: null, name, cycle, amount }], invoiceId: null, status, placedAt: s.hour };
  s.shop = { ...s.shop, orders: [...s.shop.orders, o] };
}

export function editOrder(s: GameState, id: string, fields: Partial<ShopOrder>): void {
  s.shop = { ...s.shop, orders: s.shop.orders.map((o) => (o.id === id ? { ...o, ...fields } : o)) };
}

// Follows a request of a pending order: its service, customer and invoice; the order is active once every item is set up and
// cancelled when its request is lost before that.
export function syncOrder(s: GameState, r: SalesRequest): void {
  const o = orderFor(s, r.id);
  if (!o || o.status !== "pending") return;
  const items = o.items.map((i) => (i.requestId === r.id ? { ...i, serviceId: r.serviceId ?? i.serviceId } : i));
  const lost = (r.status === "lost" || r.status === "declined") && !items.some((i) => i.serviceId);
  const status = items.every((i) => i.serviceId) ? "active" : lost ? "cancelled" : "pending";
  editOrder(s, o.id, { items, status, customerId: o.customerId ?? r.customerId, invoiceId: o.invoiceId ?? r.invoiceId ?? null });
}

export function pruneOrders(s: GameState): void {
  s.shop = { ...s.shop, orders: s.shop.orders.filter((o) => o.status === "pending" || s.hour - o.placedAt < KEEP_HOURS) };
}
