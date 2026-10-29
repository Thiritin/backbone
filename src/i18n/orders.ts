import { euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Order emails, their outcomes and events; spread into en.
export const ORDERS_EN: Record<string, (p: Params) => string> = {
  "ticket.order.webHosting.subject": (p) => (p.domain ? `Order: hosting for ${p.domain}` : "Order: web hosting"),
  "ticket.order.vps.subject": () => "Order: VPS",
  "ticket.order.gameServer.subject": () => "Order: game server",
  "outcome.accepted": () => "Order accepted",
  "outcome.declined": () => "Order declined",
  "outcome.failed": () => "Setup failed",
  "error.orderNotOffered": () => "You do not offer this product in this city.",
  "event.order.title": () => "New order",
  "event.order.text": (p) => `${p.name} orders ${p.spec}.`,
  "event.orderPlaced.title": () => "New order",
  "event.orderPlaced.text": (p) => `${p.name} ordered through the order form at ${euroCents(Number(p.price))} a month: ${p.spec}.`,
  "event.orderFailed.title": () => "Setup failed",
  "event.orderFailed.text": (p) => `The order of ${p.name} could not be set up, and the customer went elsewhere. It was for ${p.spec}.`,
};
