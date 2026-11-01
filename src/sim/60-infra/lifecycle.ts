// docs/design/plans/software-licences.md, lane lifecycle: where each installed version stands against its vendor's end
// of updates and end of security updates.
import { deliverMail } from "../40-support/tickets";
import { SOFTWARE } from "../10-catalog/platforms";
import { SERVER_OS } from "../10-catalog/server-os";
import { SHOP_LICENCES } from "../10-catalog/shop-licences";
import { versionAt, versionInfo, versionsOf } from "../10-catalog/software-versions";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";
import { installedVersion, nameOf, SHOP_MACHINE, shopMachine } from "./licence";

export type Support = "supported" | "updatesEnded" | "securityEnded";

// The newest release out never counts as ended, whatever end dates the vendor has announced for it.
export function supportOf(product: string, version: string, hour: number): Support {
  const v = versionInfo(product, version);
  if (!v || versionAt(product, hour).version === version) return "supported";
  if (v.securityUntil !== null && hour >= v.securityUntil) return "securityEnded";
  return v.updatesUntil !== null && hour >= v.updatesUntil ? "updatesEnded" : "supported";
}

// The support state of an OS or software on a machine; supported when it is not installed.
export const supportOn = (s: GameState, machineId: string, product: string): Support => {
  const version = installedVersion(s, machineId, product);
  return version === null ? "supported" : supportOf(product, version, s.hour);
};

type Install = { id: string; version: string };
type Machine = { id: string; os?: Install | null; software?: Install[] };
const installs = (m: Machine | undefined): Install[] => [...(m?.os ? [m.os] : []), ...(m?.software ?? [])];
// Every machine with installs, the installed shop system included.
const machines = (s: GameState): Machine[] => [...s.devices, ...s.workloads, ...(shopMachine(s) ? [shopMachine(s)!] : [])];

// Every year an install runs past its end of security updates it collects vulnerabilities that add this share to its
// machine's daily compromise chance, counted up to UNSUPPORTED_YEARS.
export const UNSUPPORTED_RISK = 0.5;
export const UNSUPPORTED_YEARS = 4;
const YEAR = 365 * 24;

export function unsupportedFactor(s: GameState, machineId: string): number {
  const years = installs(machines(s).find((x) => x.id === machineId)).reduce((sum, x) => {
    const end = versionInfo(x.id, x.version)?.securityUntil;
    return end != null && supportOf(x.id, x.version, s.hour) === "securityEnded" ? sum + Math.min(UNSUPPORTED_YEARS, (s.hour - end) / YEAR) : sum;
  }, 0);
  return 1 + UNSUPPORTED_RISK * years;
}

// A cluster is as exposed as its most exposed machine, or the shop system in one of its web spaces.
export const clusterFactor = (s: GameState, c: Pick<Cluster, "id" | "vm" | "nodes">): number =>
  Math.max(1, ...[...(c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId)), ...(s.shop.install?.clusterId === c.id ? [SHOP_MACHINE] : [])].map((id) => unsupportedFactor(s, id)));

export const WARN_DAYS = 90;
const warnHours = new Set([...SOFTWARE, ...SERVER_OS, ...SHOP_LICENCES].flatMap((x) => versionsOf(x.id).flatMap((v) => (v.securityUntil === null ? [] : [v.securityUntil - WARN_DAYS * 24]))));

// The vendor writes once per installed version WARN_DAYS before its security updates end.
export function lifecycleTick(s: GameState): void {
  if (!warnHours.has(s.hour)) return;
  const seen = new Set<string>();
  for (const m of machines(s)) {
    for (const x of installs(m)) {
      const end = versionInfo(x.id, x.version)?.securityUntil, key = `${x.id}@${x.version}`;
      if (end == null || s.hour !== end - WARN_DAYS * 24 || seen.has(key) || versionAt(x.id, s.hour).version === x.version) continue;
      seen.add(key);
      const name = nameOf(x.id);
      deliverMail(s, name, "securityEnding", { software: name, version: x.version, until: end });
    }
  }
}
