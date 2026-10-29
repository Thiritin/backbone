import { yearOf } from "../00-core/time";
import { clustersIn, SOFTWARE, softwareById, type SoftwareKind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { clusterOf, hostOfVm, workloadsOn, type Cluster } from "../60-infra/cluster";
import { locationOf } from "../60-infra/status";
import { familyOf, openVulns } from "../60-infra/vulns";
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

const joinsAt = (s: GameState, c: Cluster): boolean => c.kind === "cloud" || (!c.vm && clustersIn(softwareById(c.panel ?? ""), yearOf(s.hour)));

// Empty servers of the zone in other clusters on the same installed software, which addNode joins to this one. A panel
// host takes them from the year its panel clusters.
export function joinableServers(s: GameState, clusterId: string): string[] {
  const c = s.clusters.find((x) => x.id === clusterId), id = c && (c.panel ?? c.platform);
  if (!c || !id || !joinsAt(s, c)) return [];
  return s.clusters.filter((x) => x.id !== c.id && x.kind === c.kind && x.az === c.az && (x.panel ?? x.platform) === id && !x.switching)
    .flatMap((x) => x.nodes.map((n) => n.deviceId)).filter((d) => !workloadsOn(s, d).length);
}

// The clusters an installed, empty server can join: the zone's other clusters on the same software.
export function joinableClusters(s: GameState, deviceId: string): Cluster[] {
  const own = clusterOf(s, deviceId), d = s.devices.find((x) => x.id === deviceId), id = own && (own.panel ?? own.platform);
  if (!own || !d || !id || own.switching || workloadsOn(s, deviceId).length) return [];
  const az = locationOf(s, d)?.az;
  return s.clusters.filter((c) => c.id !== own.id && c.kind === own.kind && c.az === az && (c.panel ?? c.platform) === id && joinsAt(s, c));
}

// Why the software cannot go on the machine next to what it runs, or null.
export function installBlock(s: GameState, machineId: string, softwareId: string): string | null {
  const sw = softwareById(softwareId), vm = !isServer(s, machineId), have = softwareOn(s, machineId)[0];
  if (yearOf(s.hour) < sw.from) return "error.softwareNotYet";
  if (vm && sw.kind === "cloud") return "error.nestedHypervisor";
  if (sw.kind === "mail") {
    if (!s.company.domain) return "error.needsDomain";
    if (s.clusters.some((c) => c.kind === "mail")) return "error.oneMailServer";
  }
  if (!have) return null;
  const on = softwareById(have.id).kind;
  if (on === "panel" || on === "game") return "error.onePanel";
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

// economy.md, Security advisories, Updating: minutes the customers on a cluster are down while its software updates. A
// hypervisor takes 2 hours per node, with every node down at once unless the software moves virtual machines live.
export const UPDATE_MINUTES: Record<SoftwareKind, number> = { panel: 30, game: 30, mail: 15, cloud: 120 };

export const updateDue = (s: GameState, c: Cluster): boolean =>
  !!familyOf(c) && !c.switching && (c.version < yearOf(s.hour) || openVulns(s, c.id).length > 0);

// Updates the cluster's software to this year's release, which closes every vulnerability patched so far. The workloads it
// takes down are busy for the update and count the time against their SLA.
export function updateSoftware(s: GameState, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), family = c && familyOf(c);
  if (!c || !family) return { ok: false, error: c ? "error.noSoftware" : "error.unknownCluster" };
  if (!updateDue(s, c)) return { ok: false, error: "error.upToDate" };
  const sw = softwareById(family), hours = UPDATE_MINUTES[sw.kind] / 60;
  const live = sw.kind === "cloud" && sw.live && c.nodes.length > 1;
  const down = live ? [] : s.workloads.filter((w) => w.clusterId === c.id);
  const ids = new Set(down.map((w) => w.id)), services = new Set(down.map((w) => w.serviceId).filter(Boolean));
  s.workloads = s.workloads.map((w) => (ids.has(w.id) ? { ...w, busyUntil: Math.max(w.busyUntil, s.hour + hours) } : w));
  // The hourly tick counts every whole hour a workload is busy; the rest is added here, as for a migration cutover.
  const rest = hours - (Math.ceil(hours) - 1);
  for (const id of services) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + rest };
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, version: yearOf(s.hour), updatedAt: s.hour } : x));
  return { ok: true };
}

// Uninstalls the machine's software once nothing it serves runs on the machine; a VM stays, empty.
export function uninstallSoftware(s: GameState, machineId: string): ActionResult {
  const c = clusterOn(s, machineId);
  if (!c) return { ok: false, error: "error.noSoftware" };
  const node = c.kind === "cloud" || (c.nodes.length > 1 && isServer(s, machineId));
  const busy = node ? workloadsOn(s, machineId).length > 0 : s.workloads.some((w) => w.clusterId === c.id);
  if (busy) return { ok: false, error: "error.softwareInUse" };
  if (node) return removeNode(s, machineId);
  dropCluster(s, c.id);
  return { ok: true };
}
