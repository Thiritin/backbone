import { dateOf, yearOf } from "../00-core/time";
import { licenceExpired } from "../60-infra/licence";
import { autoUpdates, clustersIn, conflict, phpAt, runsOn, SOFTWARE, softwareById, type SoftwareKind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { anchorOf, clustersOf, clustersOn, dropCluster, machineOf, workloadsOn, type Cluster } from "../60-infra/cluster";
import { osUp } from "../60-infra/oob";
import { locationOf } from "../60-infra/status";
import { familyOf, openVulns } from "../60-infra/vulns";
import type { Resources } from "../10-catalog/products";
import { createVm, freeServer, installHypervisor, installPanel, installPanelInVm, PANEL_VM_SIZE, phpDue, removeNode, templateOs, upgradeNodePhp } from "./clusters";
import type { ActionResult } from "./hardware";
import { buyLicenses, licenseDue } from "../85-products/products";

// A machine is a server or one of the player's own VMs, with the software on its disk; VMs take no hypervisor. Each
// software is the control plane of one of the machine's clusters. doneAt is null once installed.
export interface Installed { id: string; doneAt: number | null; cluster?: Cluster }

const isServer = (s: GameState, id: string) => s.devices.some((d) => d.id === id);
const runs = (c: Cluster, id: string): boolean => [c.panel, c.platform, c.switching?.to].includes(id);
// The machine's cluster of the software, or its first (the hypervisor on a server) without one.
const clusterOn = (s: GameState, id: string, softwareId?: string): Cluster | undefined =>
  clustersOn(s, id).find((c) => !softwareId || runs(c, softwareId));

export function softwareOn(s: GameState, machineId: string): Installed[] {
  return (machineOf(s, machineId)?.software ?? []).map((x) => ({ id: x.id, doneAt: x.doneAt !== null && x.doneAt > s.hour ? x.doneAt : null, cluster: clusterOn(s, machineId, x.id) }));
}

const joinsAt = (s: GameState, c: Cluster): boolean => c.kind === "cloud" || (!c.vm && clustersIn(softwareById(c.panel ?? ""), yearOf(s.hour)));

// Whether nothing of the cluster runs on the server.
const emptyOf = (s: GameState, c: Cluster, deviceId: string): boolean => !workloadsOn(s, deviceId).some((w) => w.clusterId === c.id);

// Empty servers of the zone in other clusters on the same installed software, which addNode joins to this one. A panel
// host takes them from the year its panel clusters.
export function joinableServers(s: GameState, clusterId: string): string[] {
  const c = s.clusters.find((x) => x.id === clusterId), id = c && (c.panel ?? c.platform);
  if (!c || !id || !joinsAt(s, c)) return [];
  return s.clusters.filter((x) => x.id !== c.id && x.kind === c.kind && x.az === c.az && (x.panel ?? x.platform) === id && !x.switching)
    .flatMap((x) => x.nodes.map((n) => n.deviceId).filter((d) => emptyOf(s, x, d)));
}

// The clusters an installed server can join with each of its software it runs nothing of: the zone's other clusters on it.
export function joinableClusters(s: GameState, deviceId: string): Cluster[] {
  const d = s.devices.find((x) => x.id === deviceId), az = d && locationOf(s, d)?.az;
  if (!d) return [];
  return clustersOf(s, deviceId).flatMap((own) => {
    const id = own.panel ?? own.platform;
    if (!id || own.switching || !emptyOf(s, own, deviceId)) return [];
    return s.clusters.filter((c) => c.id !== own.id && c.kind === own.kind && c.az === az && (c.panel ?? c.platform) === id && joinsAt(s, c));
  });
}

// Why the software cannot go on the machine next to what it runs, or null; the installer erases the disk first.
export function installBlock(s: GameState, machineId: string, softwareId: string, replacing = false): string | null {
  const sw = softwareById(softwareId), vm = !isServer(s, machineId);
  if (yearOf(s.hour) < sw.from) return "error.softwareNotYet";
  if (sw.skill && !s.unlocks.includes(sw.skill)) return "error.missingSkill";
  if (vm && sw.kind === "cloud") return "error.nestedHypervisor";
  if (sw.kind === "mail") {
    if (!s.company.domain) return "error.needsDomain";
    if (s.clusters.some((c) => c.kind === "mail")) return "error.oneMailServer";
  }
  if (replacing) return null;
  return canInstall(s, machineId, sw.id) ?? (s.cash < licenseDue(s, machineId, null, sw.id) ? "error.noCash" : null);
}

// Why the machine does not take the software: another OS, a conflict with what is installed, a server that is rented
// whole, burning in or already runs it, or an OS that is not up. Every other software gets a cluster of its own next to it.
export function canInstall(s: GameState, machineId: string, softwareId: string): string | null {
  const sw = softwareById(softwareId), m = machineOf(s, machineId);
  if (!m) return "error.unknownDevice";
  if (m.os && !runsOn(sw, m.os.id)) return "error.wrongOs";
  for (const x of m.software ?? []) {
    const why = conflict(sw, softwareById(x.id));
    if (why) return why;
  }
  const taken = isServer(s, machineId) ? freeServer(s, s.devices.find((d) => d.id === machineId), sw.id) : null;
  if (taken) return taken;
  return osUp(s, machineId) ? null : m.os ? "error.osNotUp" : "error.noOs";
}

// Installs catalog software on a server or one of the player's VMs; it runs after its install hours.
export function installSoftware(s: GameState, machineId: string, softwareId: string): ActionResult {
  const sw = SOFTWARE.find((x) => x.id === softwareId);
  if (!sw) return { ok: false, error: "error.unknownSoftware" };
  const block = installBlock(s, machineId, sw.id);
  if (block) return { ok: false, error: block };
  const done = !isServer(s, machineId) ? installPanelInVm(s, machineId, sw.id) : sw.kind === "cloud" ? installHypervisor(s, machineId, sw.id) : installPanel(s, machineId, sw.id);
  if (done.ok) buyLicenses(s, machineId, null, sw.id);
  if (done.ok && sw.kind === "mail") s.company = { ...s.company, mail: { kind: "self", software: sw.id as "postfixit" | "mailpig", clusterId: done.id! } };
  return done;
}

// A new VM on a hypervisor cluster from a template with the software's OS, the software installing; returns the new host's id.
export function createSoftwareVm(s: GameState, clusterId: string, softwareId: string, size: Resources = PANEL_VM_SIZE): ActionResult {
  const sw = SOFTWARE.find((x) => x.id === softwareId);
  if (!sw) return { ok: false, error: "error.unknownSoftware" };
  if (s.cash < licenseDue(s, "", sw.os[0], sw.id)) return { ok: false, error: "error.noCash" };
  const vm = createVm(s, clusterId, size);
  if (!vm.ok) return vm;
  templateOs(s, vm.id!, sw);
  const done = installSoftware(s, vm.id!, softwareId);
  if (!done.ok) s.workloads = s.workloads.filter((w) => w.id !== vm.id);
  else buyLicenses(s, vm.id!, sw.os[0], null);
  return done;
}

// economy.md, Security advisories, Updating: minutes the customers on a cluster are down while its software updates. A
// hypervisor takes 2 hours per node, with every node down at once unless the software moves virtual machines live.
export const UPDATE_MINUTES: Record<SoftwareKind, number> = { panel: 30, game: 30, mail: 15, cloud: 120, dns: 15, vpn: 15, storage: 30, backup: 15 };

export const updateDue = (s: GameState, c: Cluster): boolean =>
  !!familyOf(c) && !c.switching && (c.version < yearOf(s.hour) || openVulns(s, c.id).length > 0);

// Updates the cluster's software to this year's release, which closes every vulnerability patched so far. The workloads it
// takes down are busy for the update and count the time against their SLA.
export function updateSoftware(s: GameState, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), family = c && familyOf(c);
  if (!c || !family) return { ok: false, error: c ? "error.noSoftware" : "error.unknownCluster" };
  if (licenceExpired(s, c)) return { ok: false, error: "error.licenceExpired" };
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

// Turns the cluster's automatic updates on or off, once its software offers them.
export function setAutoUpdate(s: GameState, clusterId: string, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), family = c && familyOf(c);
  if (!c || !family) return { ok: false, error: c ? "error.noSoftware" : "error.unknownCluster" };
  if (!autoUpdates(softwareById(family), yearOf(s.hour))) return { ok: false, error: "error.noAutoUpdate" };
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, autoUpdate: on } : x));
  return { ok: true };
}

// The hour of the night, game time, when clusters with automatic updates run a due update.
export const AUTO_UPDATE_HOUR = 3;

export function autoUpdateTick(s: GameState): void {
  if (dateOf(s.hour).getUTCHours() !== AUTO_UPDATE_HOUR) return;
  for (const c of s.clusters) {
    if (c.autoUpdate && updateDue(s, c) && autoUpdates(softwareById(familyOf(c)!), yearOf(s.hour))) updateSoftware(s, c.id);
  }
}

// Uninstalls one software of the machine (its hypervisor, or its first, unless named) once nothing it serves runs on the
// machine; the machine's other software stays, and a VM stays, empty.
export function uninstallSoftware(s: GameState, machineId: string, softwareId?: string): ActionResult {
  const c = clusterOn(s, machineId, softwareId);
  if (!c) return { ok: false, error: "error.noSoftware" };
  const node = c.kind === "cloud" || (c.nodes.length > 1 && isServer(s, machineId));
  const busy = node ? !emptyOf(s, c, machineId) : s.workloads.some((w) => w.clusterId === c.id);
  if (busy) return { ok: false, error: "error.softwareInUse" };
  if (node) return removeNode(s, machineId, c.id);
  dropCluster(s, c.id);
  return { ok: true };
}

// docs/design/terminal-shell.md, apt: what an upgrade on a server would bring up to date, as Debian packages. cluster is
// null for the PHP of the panel hosts on the server.
export interface Upgrade { pkg: string; from: string; to: string; minutes: number; cluster: string | null }

const release = (hour: number) => `${yearOf(hour)}.${dateOf(hour).getUTCMonth() + 1}`;
// Debian named PHP by its major version up to 5, then by major and minor.
const phpPackage = (v: string) => { const [a, b] = v.split("."); return Number(a) < 7 ? `php${a}` : `php${a}.${b}`; };

export function upgradable(s: GameState, deviceId: string): Upgrade[] {
  const mine = s.clusters.filter((c) => c.nodes.some((n) => n.deviceId === deviceId) || anchorOf(s, c) === deviceId);
  const out: Upgrade[] = mine.filter((c) => updateDue(s, c)).map((c) => {
    const sw = softwareById(familyOf(c)!), live = sw.kind === "cloud" && sw.live && c.nodes.length > 1;
    return { pkg: sw.id, from: release(c.updatedAt), to: release(s.hour), minutes: live ? 0 : UPDATE_MINUTES[sw.kind], cluster: c.id };
  });
  const php = mine.find((c) => c.kind === "panel" && anchorOf(s, c) === deviceId && phpDue(s, c)), now = phpAt(yearOf(s.hour));
  if (php) out.push({ pkg: phpPackage(now), from: php.php, to: `${now}-${release(s.hour)}`, minutes: 0, cluster: null });
  return out;
}

// apt upgrade on a server: the software updates and the PHP upgrade the Software app runs, for everything due there.
export function upgradeServer(s: GameState, deviceId: string): ActionResult {
  const due = upgradable(s, deviceId);
  if (!due.length) return { ok: false, error: "error.upToDate" };
  for (const u of due) {
    const r = u.cluster ? updateSoftware(s, u.cluster) : upgradeNodePhp(s, deviceId);
    if (!r.ok) return r;
  }
  return { ok: true };
}
