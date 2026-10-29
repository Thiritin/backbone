// Saves from before panel hosts ran a panel and a platform side by side on each cluster. Each cluster with a platform
// becomes a hypervisor cluster, and its web spaces move into one panel VM sized to hold them; a cluster with only a panel
// becomes one bare-metal panel host per server; an empty cluster with nothing installed is dropped, freeing its servers.
import { yearOf } from "../00-core/time";
import { oldestPhp, phpAt, softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { clusterDefaults, HA_OFF, KEYS, type Cluster, type Workload } from "../60-infra/cluster";

type OldNode = { deviceId: string; state: Cluster["nodes"][number]["state"]; php?: string; phpUntil?: number };
type OldCluster = Omit<Partial<Cluster>, "nodes"> & { nodes: OldNode[] };

export function upgradeCompute(s: GameState): GameState {
  const old = s.clusters as unknown as OldCluster[];
  // Software lives on its machines, so a cluster with nothing installed or installing frees its servers.
  if (old.every((c) => c.kind)) return { ...s, clusters: old.filter((c) => c.panel || c.platform || c.switching).map((c) => clusterDefaults(c as Cluster, s.hour)) };
  const now = phpAt(yearOf(s.hour));
  const clusters: Cluster[] = [], vms: Workload[] = [], hostOf = new Map<string, string>();
  let workloads = s.workloads, nextId = s.nextId;
  const web = (c: OldCluster) => workloads.filter((w) => w.clusterId === c.id && s.services.find((v) => v.id === w.serviceId)?.product === "webHosting");
  const strip = (n: OldNode) => ({ deviceId: n.deviceId, state: n.state });
  for (const c of old) {
    if (c.kind) { clusters.push(clusterDefaults(c as Cluster, s.hour)); continue; }
    // Saves from before platforms ran FreePanel and Proxmocks.
    if (c.panel === undefined && c.platform === undefined) Object.assign(c, { panel: "freepanel", platform: "proxmocks" });
    const switching = c.switching ?? null, panel = c.panel ?? (switching?.kind === "panel" ? switching.to : null);
    const platform = c.platform ?? (switching?.kind === "cloud" ? switching.to : null);
    const php = oldestPhp(c.nodes.map((n) => n.php ?? now)) ?? now;
    if (!panel && !platform) continue;
    if (!platform) {
      c.nodes.forEach((n, i) => {
        const id = i === 0 ? c.id! : `clu${nextId++}`;
        hostOf.set(n.deviceId, id);
        clusters.push(clusterDefaults({
          ...c, id, name: i === 0 ? c.name : `${c.name} ${i + 1}`, kind: "panel", nodes: [strip(n)], controlPlane: n.deviceId, panel: c.panel ?? null,
          platform: null, vm: null, php: n.php ?? now, phpUntil: n.phpUntil ?? -1, ha: { ...HA_OFF }, switching: switching?.kind === "panel" ? switching : null,
        }, s.hour));
        workloads = workloads.map((w) => (w.clusterId === c.id && w.deviceId === n.deviceId ? { ...w, clusterId: id } : w));
      });
      workloads = workloads.map((w) => (w.clusterId === c.id && !hostOf.has(w.deviceId ?? "") ? { ...w, clusterId: c.id! } : w));
      continue;
    }
    clusters.push(clusterDefaults({
      ...c, kind: "cloud", nodes: c.nodes.map(strip), panel: null, platform: c.platform ?? null, vm: null, ha: { ...HA_OFF },
      switching: switching?.kind === "cloud" ? switching : null,
    }, s.hour));
    const sites = web(c);
    if (!panel) continue;
    // The VM books what the web spaces book plus the panel, on the node that held most of them.
    const size = { vcpu: 0, ramGb: 0, diskGb: 0 }, cp = softwareById(panel).controlPlane;
    for (const k of KEYS) size[k] = Math.max(1, Math.ceil(sites.reduce((n, w) => n + w[k], 0) + cp[k]));
    const count = (id: string) => sites.filter((w) => w.deviceId === id).length;
    const node = [...c.nodes].sort((a, b) => count(b.deviceId) - count(a.deviceId))[0]?.deviceId ?? null;
    const vm: Workload = {
      id: `wl${nextId++}`, serviceId: "", clusterId: c.id!, deviceId: node, rackId: null, slot: 0, units: 0, watts: 0, ...size, placedAt: s.hour,
      stopped: false, busyUntil: 0, backupAt: null,
    };
    const host = `clu${nextId++}`;
    vms.push(vm);
    for (const n of c.nodes) hostOf.set(n.deviceId, host);
    clusters.push(clusterDefaults({
      id: host, name: `${c.name} web`, az: c.az, kind: "panel", placement: "pack", nodes: [], controlPlane: null, panel: c.panel ?? null, platform: null,
      vm: vm.id, php, phpUntil: -1, switching: switching?.kind === "panel" ? switching : null,
    }, s.hour));
    const ids = new Set(sites.map((w) => w.id));
    workloads = workloads.map((w) => (ids.has(w.id) ? { ...w, clusterId: host, deviceId: null } : w));
  }
  const map = (ids: string[]) => [...new Set(ids.flatMap((id) => (hostOf.has(id) ? [hostOf.get(id)!] : [])))];
  const known = new Set(clusters.map((c) => c.id));
  return {
    ...s, nextId, clusters: clusters.map((c) => (c.backup.targetId && !known.has(c.backup.targetId) ? { ...c, backup: { targetId: null, every: "off" } } : c)),
    workloads: [...workloads.filter((w) => !w.clusterId || known.has(w.clusterId)), ...vms],
    security: { ...s.security, patched: map(s.security.patched), offline: map(s.security.offline), hacked: map(s.security.hacked) },
  };
}
