import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { PHP, phpAt, phpBehind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";

// economy.md, PHP versions.
export const PHP_TICKETS = 0.05;
export const PHP_TICKETS_CAP = 6;
export const PHP_EOL = 3;
export const PHP_ABUSE = 1.5;
export const PHP_SALES_STEP = 0.25;
export const PHP_SLOW = 0.7;
export const PHP_UPGRADE_HOURS = 1;

// A panel host's sites run slower right after a PHP upgrade and while a compromise loads the host with spam.
export const hostPerf = (s: GameState, c: Cluster | undefined): number =>
  c?.kind === "panel" && (s.hour <= c.phpUntil || s.security.hacked.includes(c.id)) ? PHP_SLOW : 1;

export const phpLag = (s: GameState, c: Cluster): number => phpBehind(c.php, yearOf(s.hour));
// How-to tickets rise 5% per version behind, up to 30%.
export const phpTickets = (s: GameState, c: Cluster): number => 1 + PHP_TICKETS * Math.min(PHP_TICKETS_CAP, phpLag(s, c));
// The oldest version still supported in a year.
export const phpSupported = (year: number): string => PHP[Math.max(0, PHP.findIndex((p) => p.version === phpAt(year)) - PHP_EOL + 1)].version;

// Hacked sites on an unsupported PHP send spam: a customer with a web space on one draws half again the abuse reports.
export function phpAbuse(s: GameState, customerId: string): number {
  const services = new Set(s.services.filter((v) => v.customerId === customerId && v.endedAt === null && v.product === "webHosting").map((v) => v.id));
  if (!services.size) return 1;
  const old = s.workloads.some((w) => {
    const c = w.clusterId && services.has(w.serviceId) ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
    return c?.kind === "panel" && phpLag(s, c) >= PHP_EOL;
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
