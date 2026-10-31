import { yearOf } from "../00-core/time";
import { PHP } from "../10-catalog/platforms";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { accountsOf, phpCompat, phpInstalled, phpOlder, POOL_MAX, poolOf } from "../60-infra/webpanel";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

const panelHost = (s: GameState, hostId: string) => {
  const c = s.clusters.find((x) => x.id === hostId);
  return !c ? fail("error.unknownCluster") : c.kind !== "panel" ? fail("error.notPanelHost") : c;
};

// Installs or drops the legacy PHP versions a panel host keeps besides its newest; it rebuilds, so its sites run slower for an hour.
export function setPhpPool(s: GameState, hostId: string, versions: string[]): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  const list = [...new Set(versions)];
  if (list.some((v) => !PHP.some((p) => p.version === v && p.year <= yearOf(s.hour)) || !phpOlder(v, c.php))) return fail("error.phpNotAvailable");
  if (list.length > POOL_MAX) return fail("error.phpPoolFull");
  const old = poolOf(s, hostId);
  if (list.length === old.length && list.every((v) => old.includes(v))) return { ok: true };
  const mine = new Set(accountsOf(s, hostId).map((x) => x.id));
  const phpOf = Object.fromEntries(Object.entries(s.webpanel.phpOf).filter(([id, v]) => !mine.has(id) || list.includes(v)));
  s.webpanel = { ...s.webpanel, phpPool: { ...s.webpanel.phpPool, [hostId]: list }, phpOf };
  s.clusters = s.clusters.map((x) => (x.id === hostId ? { ...x, phpUntil: s.hour + PHP_UPGRADE_HOURS } : x));
  phpCompat(s);
  return { ok: true };
}

// Moves one account to an installed PHP version.
export function setAccountPhp(s: GameState, serviceId: string, version: string): ActionResult {
  const w = s.workloads.find((x) => x.serviceId === serviceId && x.clusterId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!c || c.kind !== "panel") return fail("error.notPanelHost");
  if (!phpInstalled(s, c).includes(version)) return fail("error.phpNotInstalled");
  s.webpanel = { ...s.webpanel, phpOf: { ...s.webpanel.phpOf, [serviceId]: version } };
  phpCompat(s);
  return { ok: true };
}
