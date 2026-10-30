// economy.md, Templates: stopped own VMs on a hypervisor with datastores, kept to clone ready VMs from.
import { nowHours } from "../00-core/time";
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import {
  controlPlaneUp, datastoreGbit, insideVm, isOwnVm, lostDisk, nodeTakes, pickNode, portGbit, withDatastore, type Cluster, type Workload,
} from "../60-infra/cluster";
import { working } from "../60-infra/status";
import { buyLicenses, LAN_GB_PER_HOUR, licenseDue } from "../85-products/products";
import { hostInVm, workload } from "./clusters";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const patch = (s: GameState, id: string, p: Partial<Workload>) => {
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w));
};

function ownVm(s: GameState, workloadId: string): { w: Workload; c: Cluster } | string {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!w || !c || !w.deviceId) return "error.unknownWorkload";
  return isOwnVm(w) ? { w, c } : "error.notOwnVm";
}

// Turns a stopped own VM into a template. Its snapshots stay with it.
export function makeTemplate(s: GameState, workloadId: string): ActionResult {
  const found = ownVm(s, workloadId);
  if (typeof found === "string") return fail(found);
  const { w, c } = found;
  if (!c.platform || !softwareById(c.platform).datastores) return fail("error.noTemplates");
  if (w.template) return fail("error.isTemplate");
  if (!w.stopped) return fail("error.notStopped");
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  if ((w.os && w.os.installedAt > nowHours(s)) || w.software?.some((x) => x.doneAt !== null && x.doneAt > s.hour)) return fail("error.installing");
  if (insideVm(s, w.id).length) return fail("error.softwareInUse");
  patch(s, w.id, { template: true });
  return { ok: true };
}

// Turns a template back into a stopped VM.
export function makeVm(s: GameState, templateId: string): ActionResult {
  const found = ownVm(s, templateId);
  if (typeof found === "string") return fail(found);
  if (!found.w.template) return fail("error.notTemplate");
  patch(s, templateId, { template: undefined });
  return { ok: true };
}

// Hours a clone copies the template's disk at its storage's speed: its datastore's, else its node's port.
export function cloneHours(s: GameState, t: Workload): number {
  const c = s.clusters.find((x) => x.id === t.clusterId), x = c?.datastores.find((v) => v.deviceId === t.datastore);
  const gbit = x ? datastoreGbit(s, x) : portGbit(s, t.deviceId!);
  return Math.max(1, Math.ceil(t.diskGb / (gbit * LAN_GB_PER_HOUR)));
}

// A new own VM from the template, on toDeviceId or the node the scheduler picks, with its disk where a new VM's goes. It
// carries the template's OS and every software of it, each running as a cluster of its own once the copy is done, and
// buys the once licences a fresh install of them would. Returns the new VM's id.
export function cloneTemplate(s: GameState, templateId: string, toDeviceId?: string): ActionResult {
  const found = ownVm(s, templateId);
  if (typeof found === "string") return fail(found);
  const { w: t, c } = found;
  if (!t.template) return fail("error.notTemplate");
  if (!controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  if (lostDisk(s, t)) return fail("error.lostDisk");
  if (t.busyUntil > s.hour || t.migrating) return fail("error.workloadBusy");
  if (!working(s, t.datastore ?? t.deviceId!)) return fail("error.nodeDown");
  const software = (t.software ?? []).map((x) => softwareById(x.id));
  if (software.some((x) => x.kind === "mail")) return fail("error.oneMailServer");
  const os = t.os?.id ?? null, cost = licenseDue(s, "", os, null) + software.reduce((n, x) => n + licenseDue(s, "", null, x.id), 0);
  if (s.cash < cost) return fail("error.noCash");
  const disk = withDatastore(s, c, { vcpu: t.vcpu, ramGb: t.ramGb, diskGb: t.diskGb }), d = toDeviceId ? s.devices.find((x) => x.id === toDeviceId) : undefined;
  if (toDeviceId && (!d || c.nodes.find((n) => n.deviceId === toDeviceId)?.state !== "active" || !working(s, d.id))) return fail("error.nodeDown");
  if (d && !nodeTakes(s, d, disk)) return fail("error.nodeFull");
  const node = d?.id ?? pickNode(s, c, disk);
  if (!node) return fail("error.noCapacity");
  const done = s.hour + cloneHours(s, t);
  const vm = workload(s, "", { ...disk, clusterId: c.id, deviceId: node, busyUntil: done, os: t.os ? { ...t.os, installedAt: s.hour } : null, software: [] });
  s.workloads = [...s.workloads, vm];
  for (const sw of software) hostInVm(s, vm.id, c.az, sw, done);
  buyLicenses(s, vm.id, os, null);
  for (const sw of software) buyLicenses(s, vm.id, null, sw.id);
  return { ok: true, id: vm.id };
}
