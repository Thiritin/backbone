// Shop admin > Orders and a service's module commands: accept, cancel, mark as fraud and delete a storefront order, change a
// service's password (shop-books-split.md 5).
import type { GameState } from "../50-state";
import { isFinal } from "../40-support/tickets";
import { createError, createOrder } from "../30-market/orders";
import { cancelShopOrder, loseRequest } from "../30-market/sales";
import { editOrder, type ShopOrder } from "../80-business/shop-orders";
import type { ActionResult } from "./hardware";
import { seededPassword } from "../42-mail/new";

const fail = (error: string): ActionResult => ({ ok: false, error });

function pendingOrder(s: GameState, id: string): ShopOrder | ActionResult {
  const o = s.shop.orders.find((x) => x.id === id);
  return !o ? fail("error.unknownOrder") : o.status !== "pending" ? fail("error.orderNotPending") : o;
}
// The items still waiting for Create, as their open requests.
const waiting = (s: GameState, o: ShopOrder) =>
  o.items.filter((i) => !i.serviceId).map((i) => s.sales.requests.find((r) => r.id === i.requestId)).filter((r) => r && !["won", "lost", "declined"].includes(r.status)).map((r) => r!);

// Why Accept would fail now, or null.
export function acceptError(s: GameState, o: ShopOrder): string | null {
  if (o.status !== "pending") return "error.orderNotPending";
  for (const r of waiting(s, o)) {
    // An invoice written in Support means the order is being set up by hand there.
    const e = r.invoiceId ? "error.orderInvoiced" : createError(s, r);
    if (e) return e;
  }
  return null;
}

// Accept Order runs the module's Create for every item, then the order is active.
export function acceptOrder(s: GameState, id: string): ActionResult {
  const o = pendingOrder(s, id);
  if ("ok" in o) return o;
  const error = acceptError(s, o);
  if (error) return fail(error);
  for (const r of waiting(s, o)) {
    const done = createOrder(s, r);
    if (!done.ok) return done;
    const won = s.sales.requests.find((x) => x.id === r.id)!;
    s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "resolved", outcome: "accepted", updatedAt: s.hour, customerId: won.customerId ?? t.customerId, serviceId: won.serviceId, work: null } : t));
  }
  editOrder(s, id, { status: "active" });
  return { ok: true, id };
}

export function cancelOrder(s: GameState, id: string): ActionResult {
  const o = pendingOrder(s, id);
  if ("ok" in o) return o;
  for (const r of waiting(s, o)) cancelShopOrder(s, r);
  editOrder(s, id, { status: "cancelled" });
  return { ok: true, id };
}

export function fraudOrder(s: GameState, id: string): ActionResult {
  const o = pendingOrder(s, id);
  if ("ok" in o) return o;
  for (const r of waiting(s, o)) loseRequest(s, r, "declined", "lost.declined");
  editOrder(s, id, { status: "fraud" });
  return { ok: true, id };
}

// Deleting a pending order cancels it first; the services of an active one keep running.
export function deleteOrder(s: GameState, id: string): ActionResult {
  const o = s.shop.orders.find((x) => x.id === id);
  if (!o) return fail("error.unknownOrder");
  if (o.status === "pending") cancelOrder(s, id);
  s.shop = { ...s.shop, orders: s.shop.orders.filter((x) => x.id !== id) };
  return { ok: true };
}

// Change Password: a new login password for a running service.
export function changeServicePassword(s: GameState, id: string): ActionResult {
  const v = s.services.find((x) => x.id === id && x.endedAt === null);
  if (!v) return fail("error.unknownService");
  const password = seededPassword(s.seed, Number(v.id.slice(3)) || 0, s.hour, s.minute);
  s.services = s.services.map((x) => (x.id === id ? { ...x, password } : x));
  return { ok: true, id };
}
