// economy.md, Per-VM firewall: a switch and the allowed port macros of one of the player's Proxmocks VMs.
import { isOwnVm } from "../60-infra/cluster";
import { MACROS, type Firewall } from "../60-infra/exposure";
import { quorumBlock } from "../60-infra/quorum";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Sets the firewall of an own VM, or removes it with null.
export function setFirewall(s: GameState, vmId: string, firewall: Firewall | null): ActionResult {
  const vm = s.workloads.find((w) => w.id === vmId), c = s.clusters.find((x) => x.id === vm?.clusterId);
  if (!vm || !c || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (c.kind !== "cloud" || c.platform !== "proxmocks") return fail("error.noFirewall");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const next = firewall && { on: !!firewall.on, allow: MACROS.filter((m) => firewall.allow.includes(m)) };
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, firewall: next } : w));
  return { ok: true };
}
