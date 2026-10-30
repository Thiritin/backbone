// docs/design/software.md, section 5: the VMwhere App Suite, billed monthly per cluster with the licenses, deploys a VM
// with its OS and its software in one step.
import type { Resources } from "../10-catalog/products";
import type { GameState } from "../50-state";
import { setMachine, type Cluster } from "../60-infra/cluster";
import type { ActionResult } from "./hardware";
import { createSoftwareVm } from "./software";

// Game hours the OS install adds before the software's own install hours.
export const SUITE_OS_HOURS = 1;

const fail = (error: string): ActionResult => ({ ok: false, error });
const vmwhere = (s: GameState, id: string): Cluster | string => {
  const c = s.clusters.find((x) => x.id === id);
  return !c ? "error.unknownCluster" : c.platform !== "vmwhere" ? "error.notVmwhere" : c;
};
const setSuite = (s: GameState, id: string, on: boolean) => { s.clusters = s.clusters.map((x) => (x.id === id ? { ...x, appSuite: on } : x)); };

export function buyAppSuite(s: GameState, clusterId: string): ActionResult {
  const c = vmwhere(s, clusterId);
  if (typeof c === "string") return fail(c);
  if (c.appSuite) return fail("error.hasAppSuite");
  setSuite(s, c.id, true);
  return { ok: true };
}

export function cancelAppSuite(s: GameState, clusterId: string): ActionResult {
  const c = vmwhere(s, clusterId);
  if (typeof c === "string") return fail(c);
  if (!c.appSuite) return fail("error.noAppSuite");
  setSuite(s, c.id, false);
  return { ok: true };
}

// A new VM with the software's first OS and the software on it, done SUITE_OS_HOURS after the software's install hours;
// returns the new host's id.
export function deployFromSuite(s: GameState, clusterId: string, size: Resources, softwareId: string): ActionResult {
  const c = vmwhere(s, clusterId);
  if (typeof c === "string") return fail(c);
  if (!c.appSuite) return fail("error.noAppSuite");
  const r = createSoftwareVm(s, clusterId, softwareId, size);
  if (!r.ok) return r;
  const host = s.clusters.find((x) => x.id === r.id)!, later = (at: number) => at + SUITE_OS_HOURS;
  s.clusters = s.clusters.map((x) => (x === host ? { ...x, switching: { ...x.switching!, doneAt: later(x.switching!.doneAt) } } : x));
  setMachine(s, host.vm!, (m) => ({ software: m.software.map((x) => (x.id === softwareId && x.doneAt !== null ? { ...x, doneAt: later(x.doneAt) } : x)) }));
  return r;
}
