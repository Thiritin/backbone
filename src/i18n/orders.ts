import { euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Order emails, their outcomes and events; spread into en.
export const ORDERS_EN: Record<string, (p: Params) => string> = {
  "order.msg.webHosting.0": (p) => `Hello, I would like to order ${p.plan} for my website. Please set it up in ${p.city}.`,
  "order.msg.webHosting.1": (p) => `A friend recommended you. I would like to order ${p.plan}, with a mailbox if that is no trouble.`,
  "order.msg.vps.0": (p) => `I would like to order a ${p.plan} in ${p.city}. Root access, please. I know what I am doing.`,
  "order.msg.vps.1": (p) => `Please set up a ${p.plan} for me. Debian would be nice, and monthly billing.`,
  "order.msg.gameServer.0": (p) => `We would like to order a ${p.plan} for our clan. It has to be up by Friday night.`,
  "order.msg.gameServer.1": (p) => `Please set up a ${p.plan} in ${p.city}. Low ping matters more to us than anything.`,
  "ticket.order.webHosting.subject": () => "Order: web hosting",
  "ticket.order.vps.subject": () => "Order: VPS",
  "ticket.order.gameServer.subject": () => "Order: game server",
  "outcome.accepted": () => "Order accepted",
  "outcome.declined": () => "Order declined",
  "outcome.failed": () => "Setup failed",
  "error.orderNotOffered": () => "You do not offer this product in this city.",
  "event.order.title": () => "New order",
  "event.order.text": (p) => `${p.name} orders ${p.plan}.`,
  "event.orderPlaced.title": () => "New order",
  "event.orderPlaced.text": (p) => `${p.name} ordered ${p.plan} through the order form at ${euroCents(Number(p.price))} a month.`,
  "event.orderFailed.title": () => "Setup failed",
  "event.orderFailed.text": (p) => `${p.plan} for ${p.name} could not be set up. The customer went elsewhere.`,
};
