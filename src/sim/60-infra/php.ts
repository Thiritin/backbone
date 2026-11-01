import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { PHP, phpAt, phpBehind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";
import { contention } from "./oversell";
import { customerWorkloads, liveServices } from "./status";
import { phpOldestInUse, phpRunning } from "./webpanel";

// economy.md, PHP versions.
export const PHP_TICKETS = 0.05;
export const PHP_TICKETS_CAP = 6;
export const PHP_EOL = 3;
export const PHP_ABUSE = 1.5;
export const PHP_SALES_STEP = 0.25;
export const PHP_SLOW = 0.7;
export const PHP_UPGRADE_HOURS = 1;

// A panel host's sites run slower right after a PHP upgrade; any compromised host runs slower while spam loads it.
export const hostPerf = (s: GameState, c: Cluster | undefined): number =>
  (c && ((c.kind === "panel" && s.hour <= c.phpUntil) || s.security.hacked.includes(c.id)) ? PHP_SLOW : 1) * contention(s, c);

export const phpLag = (s: GameState, c: Cluster): number => phpBehind(c.php, yearOf(s.hour));
// How far behind the oldest version a host still runs an account on is.
export const phpUseLag = (s: GameState, c: Cluster): number => phpBehind(phpOldestInUse(s, c), yearOf(s.hour));
// How-to tickets rise 5% per version behind, up to 30%.
export const phpTickets = (s: GameState, c: Cluster): number => 1 + PHP_TICKETS * Math.min(PHP_TICKETS_CAP, phpUseLag(s, c));
// The oldest version still supported in a year.
export const phpSupported = (year: number): string => PHP[Math.max(0, PHP.findIndex((p) => p.version === phpAt(year)) - PHP_EOL + 1)].version;

// Hacked sites on an unsupported PHP send spam: a customer with a web space on one draws half again the abuse reports.
export function phpAbuse(s: GameState, customerId: string): number {
  const services = new Set(liveServices(s, customerId).filter((v) => v.product === "webHosting").map((v) => v.id));
  if (!services.size) return 1;
  const old = customerWorkloads(s, customerId).some((w) => {
    const c = w.clusterId && services.has(w.serviceId) ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
    return c?.kind === "panel" && phpBehind(phpRunning(s, c, w.serviceId), yearOf(s.hour)) >= PHP_EOL;
  });
  return old ? PHP_ABUSE : 1;
}

// Share of web hosting requests that need a supported PHP: a quarter at 3 versions behind, all of them at 6.
export const phpRefusal = (lag: number): number => Math.min(1, Math.max(0, (lag - PHP_EOL + 1) * PHP_SALES_STEP));

// The version a web hosting request needs when the panel host it would land on runs too old a PHP for it, or null.
export function phpNeeded(s: GameState, requestId: string, clusterId: string | null): string | null {
  const c = clusterId ? s.clusters.find((x) => x.id === clusterId) : undefined;
  if (!c) return null;
  const draw = rand(hashRng(s.seed, Number(requestId.replace(/\D/g, "")) || 0, 49));
  return draw < phpRefusal(phpLag(s, c)) ? phpSupported(yearOf(s.hour)) : null;
}
