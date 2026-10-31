import { serviceHeld } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { workloadsUp } from "../60-infra/cluster";
import { gameCrashed } from "../60-infra/games";
import { netsvcBroken } from "../60-infra/netsvc";
import { dnsCovered } from "../60-infra/netsvc-dns";
import { takenDown } from "../60-infra/ops";
import { serviceById } from "../60-infra/status";
import { domainDown } from "../30-customers/registry";

// A service is online unless its customer is suspended, it is taken down, one of its workloads is down, its address is
// blackholed or its domain expired or a DNS, certificate or storage fault breaks it.
export function serviceOnline(s: GameState, serviceId: string): boolean {
  const v = serviceById(s, serviceId);
  return !v || (!serviceHeld(s, v) && !gameCrashed(s, v.id) && !takenDown(s, v.id) && (workloadsUp(s, v.id) || (v.product === "dns" && dnsCovered(s, v.id))) && !s.network.attacks.some((a) => a.serviceId === v.id && a.blackholed) && !domainDown(s, v) && !netsvcBroken(s, v.id));
}
