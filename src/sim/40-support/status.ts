import { isSuspended } from "../45-billing/billing";
import type { GameState } from "../50-state";

// ponytail: only suspension takes a service offline until milestone 3 links services to devices and clusters.
// Scans services and invoices per call; index suspended customers if long games get slow.
export function serviceOnline(s: GameState, serviceId: string): boolean {
  const v = s.services.find((x) => x.id === serviceId);
  return !v || !isSuspended(s, v.customerId);
}
