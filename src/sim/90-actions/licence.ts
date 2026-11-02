import type { GameState } from "../50-state";
import { assignKey, installedVersion, isLicensed, keyFor, nameOf, panelLocked, startTrial, trialDaysOf, trialOf } from "../60-infra/licence";
import { machineOf } from "../60-infra/cluster";
import type { ActionResult } from "./hardware";

// A build short of a key, naming the product.
export const keysShort = (product: string): ActionResult => ({ ok: false, error: "error.licenceKeysShort", params: { name: nameOf(product) } });

// Enters a key into an installed product: it licenses a trial, an ended trial or a lapse, and replaces the key it held,
// which goes back unassigned.
export function activateLicence(s: GameState, machineId: string, product: string, key: string): ActionResult {
  const version = installedVersion(s, machineId, product);
  if (version === null) return { ok: false, error: "error.noSoftware" };
  const k = keyFor(s, machineId, product, key, version);
  if (!k) return { ok: false, error: "error.licenceKey" };
  assignKey(s, k.id, machineId);
  return { ok: true, id: k.id };
}

const installedOn = (s: GameState, machineId: string, product: string): boolean => !!machineOf(s, machineId)?.software?.some((x) => x.id === product);

// Starts the product's trial on the machine, once per machine.
export function startLicenceTrial(s: GameState, machineId: string, product: string): ActionResult {
  if (!isLicensed(product) || !installedOn(s, machineId, product)) return { ok: false, error: "error.noSoftware" };
  if (trialDaysOf(product) === null || trialOf(s, machineId, product)) return { ok: false, error: "error.noTrial" };
  startTrial(s, machineId, product);
  return { ok: true };
}

// Closes a panel's first-sign-in licence setup, once it runs a key or its trial.
export function finishPanelSetup(s: GameState, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return { ok: false, error: "error.unknownCluster" };
  if (panelLocked(s, c)) return { ok: false, error: "error.licenceExpired" };
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, setupPending: false } : x));
  return { ok: true, id: clusterId };
}
