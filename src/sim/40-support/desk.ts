import type { GameState } from "../50-state";
import { monthlyValue, profileStats, type Ticket } from "./tickets";

export type Priority = "low" | "normal" | "high" | "urgent";

// A cancelling customer paying at least this much a month is high priority (docs/design/economy.md, Support desks).
export const HIGH_VALUE_MONTHLY = 50;

// The priority a desk shows: the agent's override, else derived from the kind and the customer.
export function priorityOf(s: Pick<GameState, "customers" | "services">, t: Pick<Ticket, "kind" | "topic" | "customerId"> & { priority?: Priority }): Priority {
  if (t.priority) return t.priority;
  const c = s.customers.find((x) => x.id === t.customerId);
  if (t.kind === "outage") return c && profileStats(c.profile).budget === "high" ? "urgent" : "high";
  if (t.kind === "appeal" || t.kind === "notice" || (t.kind === "legal" && t.topic === "takedown")) return "high";
  if (t.kind === "cancellation" && monthlyValue(s.services, t.customerId) >= HIGH_VALUE_MONTHLY) return "high";
  return t.kind === "howTo" ? "low" : "normal";
}
