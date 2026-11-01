// economy.md, HyperVee virtual switches: the Virtual Switch Manager and the adapter's switch.
import type { GameState } from "../50-state";
import { modelById } from "../10-catalog/hardware";
import { DEFAULT_SWITCH, MAX_SWITCHES, switchesOf, type VSwitch, type VSwitchType } from "../60-infra/vswitch";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const hyperVee = (s: GameState, id: string) => { const c = s.clusters.find((x) => x.id === id); return c?.platform === "hypervee" ? c : undefined; };

// Adds a switch, or changes the one named by id.
export function saveSwitch(s: GameState, clusterId: string, id: string | null, name: string, type: VSwitchType, nic: number | null): ActionResult {
  const c = hyperVee(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const all = switchesOf(c), label = name.trim();
  if (!label) return fail("error.noSwitch");
  if (!["external", "internal", "private"].includes(type)) return fail("error.noSwitch");
  if (type === "external" && nic !== null) {
    const ports = Math.min(...c.nodes.map((n) => { const d = s.devices.find((x) => x.id === n.deviceId); return d ? modelById(d.model).ports.length : 0; }));
    if (!Number.isInteger(nic) || nic < 0 || nic >= ports) return fail("error.noSwitch");
  }
  const own = all.find((x) => x.id === id);
  if (id !== null && !own) return fail("error.noSwitch");
  if (!own && all.length >= MAX_SWITCHES) return fail("error.noSwitch");
  const row: VSwitch = { id: own?.id ?? `sw${Math.max(0, ...all.map((x) => Number(x.id.slice(2)) || 0)) + 1}`, name: label, type, nic: type === "external" ? nic : null };
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switches: own ? all.map((y) => (y.id === row.id ? row : y)) : [...all, row] } : x));
  return { ok: true, id: row.id };
}

// Removes a switch; its VMs fall back to the default one.
export function deleteSwitch(s: GameState, clusterId: string, id: string): ActionResult {
  const c = hyperVee(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  if (id === DEFAULT_SWITCH || !switchesOf(c).some((x) => x.id === id)) return fail("error.noSwitch");
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, switches: switchesOf(c).filter((y) => y.id !== id) } : x));
  s.workloads = s.workloads.map((w) => (w.clusterId === c.id && w.switchId === id ? { ...w, switchId: null } : w));
  return { ok: true };
}

// Plugs a VM's adapter into a switch.
export function setVmSwitch(s: GameState, workloadId: string, switchId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = hyperVee(s, w?.clusterId ?? "");
  if (!w || !c) return fail("error.unknownWorkload");
  if (!switchesOf(c).some((x) => x.id === switchId)) return fail("error.noSwitch");
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, switchId: switchId === DEFAULT_SWITCH ? null : switchId } : x));
  return { ok: true };
}
