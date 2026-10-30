import { yearOf } from "../00-core/time";
import { softwareById } from "../10-catalog/platforms";
import { serverOsAt } from "../10-catalog/server-os";
import type { GameState, MachineState } from "../50-state";
import { isOwnVm } from "../60-infra/cluster";

// docs/design/software.md, section 3: machines of a save from before operating systems (the ids in bare) get them from
// their clusters, installed and booted. The OS is the first one the cluster's software runs on: Windoors for HyperVee
// and TCAdmen, Lunix for the rest. A machine in no cluster has an empty disk.
export function fillMachines(s: GameState, bare: Set<string>): GameState {
  const filled = new Map<string, MachineState>();
  for (const c of s.clusters) {
    const id = c.switching?.to ?? c.panel ?? c.platform;
    if (!id) continue;
    const sw = softwareById(id), at = c.updatedAt, os = sw.os[0];
    const state = (): MachineState => ({
      os: { id: os, version: serverOsAt(os, yearOf(at)).version, installedAt: at },
      software: [{ id, version: String(c.version), installedAt: at, doneAt: c.switching?.doneAt ?? null }],
    });
    for (const m of c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId)) filled.set(m, state());
  }
  const empty = (): MachineState => ({ os: null, software: [] });
  for (const d of s.devices) if (bare.has(d.id)) Object.assign(d, filled.get(d.id) ?? empty());
  s.workloads = s.workloads.map((w) => (bare.has(w.id) && isOwnVm(w) ? { ...w, ...(filled.get(w.id) ?? empty()) } : w));
  return s;
}
