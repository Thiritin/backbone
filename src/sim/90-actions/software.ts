import { yearOf } from "../00-core/time";
import { SOFTWARE, softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { clusterOf, hostOfVm, workloadsOn, type Cluster } from "../60-infra/cluster";
import { dropCluster, installHypervisor, installPanel, installPanelInVm, removeNode } from "./clusters";
import type { ActionResult } from "./hardware";

// A machine is a server or one of the player's own VMs. It runs one hypervisor or one panel: a panel next to a hypervisor
// goes into a VM on it, and VMs take no hypervisor. The software is the control plane of the machine's cluster.
export interface Installed { id: string; doneAt: number | null; cluster: Cluster }

const isServer = (s: GameState, id: string) => s.devices.some((d) => d.id === id);
const clusterOn = (s: GameState, id: string): Cluster | undefined => (isServer(s, id) ? clusterOf(s, id) : hostOfVm(s, id));

export function softwareOn(s: GameState, machineId: string): Installed[] {
  const c = clusterOn(s, machineId), id = c && (c.switching?.to ?? c.panel ?? c.platform);
  return c && id ? [{ id, doneAt: c.switching?.doneAt ?? null, cluster: c }] : [];
}

// Empty servers of the zone in other clusters on the same installed hypervisor, which addNode joins to this one.
export function joinableServers(s: GameState, clusterId: string): string[] {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || c.kind !== "cloud" || !c.platform) return [];
  return s.clusters.filter((x) => x.id !== c.id && x.kind === "cloud" && x.az === c.az && x.platform === c.platform && !x.switching)
    .flatMap((x) => x.nodes.map((n) => n.deviceId)).filter((id) => !workloadsOn(s, id).length);
}

// Why the software cannot go on the machine next to what it runs, or null.
export function installBlock(s: GameState, machineId: string, softwareId: string): string | null {
  const sw = softwareById(softwareId), vm = !isServer(s, machineId), have = softwareOn(s, machineId)[0];
  if (sw.from && yearOf(s.hour) < sw.from) return "error.softwareLater";
  if (vm && sw.kind === "cloud") return "error.nestedHypervisor";
  if (sw.kind === "mail") {
    if (!s.company.domain) return "error.needsDomain";
    if (s.clusters.some((c) => c.kind === "mail")) return "error.oneMailServer";
  }
  if (!have) return null;
  const on = softwareById(have.id).kind;
  if (on === "panel") return "error.onePanel";
  if (on === "mail") return "error.mailHost";
  return sw.kind === "cloud" ? "error.oneHypervisor" : sw.kind === "mail" ? "error.mailInVm" : "error.panelInVm";
}

// Installs catalog software on a server or one of the player's VMs; it runs after its install hours.
export function installSoftware(s: GameState, machineId: string, softwareId: string): ActionResult {
  const sw = SOFTWARE.find((x) => x.id === softwareId);
  if (!sw) return { ok: false, error: "error.unknownSoftware" };
  const block = installBlock(s, machineId, sw.id);
  if (block) return { ok: false, error: block };
  const done = !isServer(s, machineId) ? installPanelInVm(s, machineId, sw.id) : sw.kind === "cloud" ? installHypervisor(s, machineId, sw.id) : installPanel(s, machineId, sw.id);
  if (done.ok && sw.kind === "mail") s.company = { ...s.company, mail: { kind: "self", software: sw.id as "postfixit" | "mailpig", clusterId: done.id! } };
  return done;
}

// Uninstalls the machine's software once nothing it serves runs on the machine; a VM stays, empty.
export function uninstallSoftware(s: GameState, machineId: string): ActionResult {
  const c = clusterOn(s, machineId);
  if (!c) return { ok: false, error: "error.noSoftware" };
  const busy = c.kind === "cloud" ? workloadsOn(s, machineId).length > 0 : s.workloads.some((w) => w.clusterId === c.id);
  if (busy) return { ok: false, error: "error.softwareInUse" };
  if (c.kind === "cloud") return removeNode(s, machineId);
  dropCluster(s, c.id);
  return { ok: true };
}
