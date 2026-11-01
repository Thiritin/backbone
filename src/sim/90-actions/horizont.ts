// economy.md, Horizont: floating IPs, security groups and volumes of the player's OpenStash clusters.
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { buyProvider, holderOf, machineLocation } from "../60-infra/addresses";
import { datastoreFits, datastoreUp, isOwnVm, vmById, type Cluster } from "../60-infra/cluster";
import { MACROS, type Macro } from "../60-infra/exposure";
import { DEFAULT_GROUP, floatingOf, groupsOf, HOT_DETACH_YEAR, isHorizont, MAX_GROUPS, VOLUME_MAX_GB, VOLUME_MIN_GB, volumesOf, type Volume } from "../60-infra/horizont";
import { quorumBlock } from "../60-infra/quorum";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const horizont = (s: GameState, id: string): Cluster | undefined => { const c = s.clusters.find((x) => x.id === id); return isHorizont(c) ? c : undefined; };
const patch = (s: GameState, id: string, p: Partial<Cluster>) => { s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, ...p } : c)); };
const setHolder = (s: GameState, ip: string, holder: string | null) => { s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.ip === ip ? { ...a, holder } : a)) }; };

// Floating IPs ---------------------------------------------------------------------------------------------------------

// Rents one more address of the cluster's datacenter as a floating IP, billed like any rented address.
export function allocateFloatingIp(s: GameState, clusterId: string): ActionResult {
  const c = horizont(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const loc = s.locations.find((l) => l.az === c.az);
  if (!loc?.dc) return fail("error.addressesFromLine");
  const a = buyProvider(s, loc, 4);
  patch(s, c.id, { floating: [...floatingOf(c), { ip: a.ip, workloadId: null }] });
  return { ok: true, id: a.ip };
}

// Points a floating IP at an instance of the cluster, or at nothing with null.
export function associateFloatingIp(s: GameState, clusterId: string, ip: string, workloadId: string | null): ActionResult {
  const c = horizont(s, clusterId), a = s.ips.addresses.find((x) => x.ip === ip);
  if (!c || !a || !floatingOf(c).some((x) => x.ip === ip)) return fail("error.unknownAddress");
  if (workloadId !== null) {
    const w = vmById(s, workloadId);
    if (!w || w.clusterId !== c.id) return fail("error.unknownMachine");
    if (machineLocation(s, w.id)?.id !== a.locationId) return fail("error.addressElsewhere");
    if (floatingOf(c).some((x) => x.workloadId === w.id && x.ip !== ip)) return fail("error.addressInUse");
  }
  setHolder(s, ip, workloadId && holderOf(s, workloadId));
  patch(s, c.id, { floating: floatingOf(c).map((x) => (x.ip === ip ? { ...x, workloadId } : x)) });
  return { ok: true };
}

// Gives a floating IP back; it is no longer billed from the next month.
export function deallocateFloatingIp(s: GameState, clusterId: string, ip: string): ActionResult {
  const c = horizont(s, clusterId);
  if (!c || !floatingOf(c).some((x) => x.ip === ip)) return fail("error.unknownAddress");
  patch(s, c.id, { floating: floatingOf(c).filter((x) => x.ip !== ip) });
  s.ips = { ...s.ips, addresses: s.ips.addresses.filter((a) => a.ip !== ip) };
  return { ok: true };
}

// Security groups ------------------------------------------------------------------------------------------------------

// Creates a group, or changes the macros of an existing one.
export function saveGroup(s: GameState, clusterId: string, id: string | null, name: string, allow: Macro[]): ActionResult {
  const c = horizont(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const groups = groupsOf(c), old = groups.find((g) => g.id === id);
  if (id && !old) return fail("error.unknownGroup");
  const label = name.trim();
  if (!label) return fail("error.groupName");
  if (!old && groups.length >= MAX_GROUPS) return fail("error.groupLimit");
  const gid = old?.id ?? `sg${s.nextId++}`, g = { id: gid, name: old?.id === DEFAULT_GROUP.id ? DEFAULT_GROUP.name : label, allow: MACROS.filter((m) => allow.includes(m)) };
  patch(s, c.id, { groups: old ? groups.map((x) => (x === old ? g : x)) : [...groups, g] });
  return { ok: true, id: gid };
}

// Deletes a group no instance uses; the default group stays.
export function deleteGroup(s: GameState, clusterId: string, id: string): ActionResult {
  const c = horizont(s, clusterId);
  if (!c || !groupsOf(c).some((g) => g.id === id)) return fail("error.unknownGroup");
  if (id === DEFAULT_GROUP.id) return fail("error.defaultGroup");
  if (s.workloads.some((w) => w.groupIds?.includes(id))) return fail("error.groupInUse");
  patch(s, c.id, { groups: groupsOf(c).filter((g) => g.id !== id) });
  return { ok: true };
}

// Sets the groups of one of the player's instances; an empty list lets no port through.
export function setInstanceGroups(s: GameState, vmId: string, groupIds: string[]): ActionResult {
  const vm = vmById(s, vmId), c = vm && horizont(s, vm.clusterId ?? "");
  if (!vm || !c || !isOwnVm(vm)) return fail("error.notOwnVm");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const all = groupsOf(c);
  if (groupIds.some((id) => !all.some((g) => g.id === id))) return fail("error.unknownGroup");
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, groupIds: [...new Set(groupIds)] } : w));
  return { ok: true };
}

// Volumes --------------------------------------------------------------------------------------------------------------

const setVolumes = (s: GameState, c: Cluster, volumes: Volume[]) => patch(s, c.id, { volumes });

// Creates a volume on the cluster's first working datastore with room, or on a node disk when it has no datastore.
export function createVolume(s: GameState, clusterId: string, name: string, gb: number): ActionResult {
  const c = horizont(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (!Number.isInteger(gb) || gb < VOLUME_MIN_GB || gb > VOLUME_MAX_GB) return fail("error.volumeSize");
  const label = name.trim();
  if (!label) return fail("error.volumeName");
  const ds = c.datastores.find((x) => datastoreUp(s, x) && datastoreFits(s, x.deviceId, gb));
  if (c.datastores.length && !ds) return fail("error.datastoreFull");
  const id = `vol${s.nextId++}`;
  setVolumes(s, c, [...volumesOf(c), { id, name: label, gb, attachedTo: null, datastore: ds?.deviceId ?? null }]);
  return { ok: true, id };
}

// Attaches a volume to an instance of the cluster, or detaches it with null. Before the hot detach year a volume leaves
// only a stopped instance.
export function attachVolume(s: GameState, clusterId: string, volumeId: string, vmId: string | null): ActionResult {
  const c = horizont(s, clusterId), v = c && volumesOf(c).find((x) => x.id === volumeId);
  if (!c || !v) return fail("error.unknownVolume");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (vmId === null) {
    const at = vmById(s, v.attachedTo);
    if (at && !at.stopped && yearOf(s.hour) < HOT_DETACH_YEAR) return fail("error.volumeBusy");
  } else {
    const w = vmById(s, vmId);
    if (!w || w.clusterId !== c.id) return fail("error.unknownMachine");
    if (v.attachedTo) return fail("error.volumeAttached");
  }
  setVolumes(s, c, volumesOf(c).map((x) => (x.id === v.id ? { ...x, attachedTo: vmId } : x)));
  return { ok: true };
}

// Deletes a detached volume and frees its space.
export function deleteVolume(s: GameState, clusterId: string, volumeId: string): ActionResult {
  const c = horizont(s, clusterId), v = c && volumesOf(c).find((x) => x.id === volumeId);
  if (!c || !v) return fail("error.unknownVolume");
  if (v.attachedTo) return fail("error.volumeAttached");
  setVolumes(s, c, volumesOf(c).filter((x) => x.id !== v.id));
  return { ok: true };
}
