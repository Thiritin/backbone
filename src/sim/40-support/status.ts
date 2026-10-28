import { isSuspended } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { workloadsUp } from "../60-infra/cluster";
import { takenDown } from "../60-infra/ops";

// A service is online unless its customer is suspended, it is taken down, one of its workloads is down or its address is blackholed.
// ponytail: walks every workload's cable path per call; cache linkStatus per tick if large fleets get slow.
export function serviceOnline(s: GameState, serviceId: string): boolean {
  const v = s.services.find((x) => x.id === serviceId);
  return !v || (!isSuspended(s, v.customerId) && !takenDown(s, v.id) && workloadsUp(s, v.id) && !s.network.attacks.some((a) => a.serviceId === v.id && a.blackholed));
}
