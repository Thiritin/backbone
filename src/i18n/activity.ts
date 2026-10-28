import { euroCents } from "../sim/00-core/money";

type Params = Record<string, string | number>;

const KIND: Record<string, string> = {
  howTo: "a how-to", billing: "a billing", outage: "an outage", upgrade: "an upgrade", cancellation: "a cancellation", abuse: "an abuse",
  appeal: "an appeal", notice: "a notice", legal: "a legal", refund: "a refund", order: "an order",
};
const RESOLVED: Record<string, string> = {
  credit: "Credited 10% of the monthly bill", retain: "Made a retention offer", cancel: "Processed the cancellation",
  unsuspend: "Unsuspended the services with a payment extension", keep: "Kept the services suspended", forward: "Forwarded the abuse report",
  takedown: "Took the content down", reject: "Rejected the request", comply: "Complied with the request", object: "Objected to the request",
  refund: "Refunded the payment", accept: "Accepted the order", account: "Created the customer account",
  invoice: "Confirmed the order and sent the invoice", domain: "Registered the domain", provision: "Set up the service",
};
const ticket = (p: Params) => `${KIND[p.kind] ?? "a"} ticket`;

export const ACTIVITY_EN: Record<string, (p: Params) => string> = {
  "activity.reply": (p) => `Answered ${ticket(p)}`,
  "activity.escalate": (p) => `Escalated ${ticket(p)}`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `Resolved ${ticket(p)}`,
  "activity.checkInvoice": (p) => `Checked invoice ${p.invoice}`,
  "activity.reminder": (p) => `Sent a payment reminder for invoice ${p.invoice}`,
  "activity.dunning": (p) => `Sent a dunning notice for invoice ${p.invoice}`,
  "activity.final": (p) => `Sent a final notice for invoice ${p.invoice}`,
  "activity.collections": (p) => `Handed invoice ${p.invoice} to collections`,
  "activity.suspend": (p) => `Suspended the services over invoice ${p.invoice}`,
  "activity.unsuspend": (p) => `Resumed the services over invoice ${p.invoice}`,
  "activity.writeOff": (p) => `Wrote off invoice ${p.invoice}`,
  "activity.price": (p) => `Changed the price to ${euroCents(Number(p.price))} a month`,
};
