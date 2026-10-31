// economy.md, PHP versions: the state of the web panels' own screens lives in one object so a save and a new game each need a
// single line. Entries are created on first use, so an empty object behaves like a fresh game.
import { hashRng, rand } from "../00-core/rng";
import { PHP, phpAt } from "../10-catalog/platforms";
import { createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { cmsOf } from "./apps";
import type { Cluster } from "./cluster";

export interface WebPanel {
  phpPool: Record<string, string[]>; // panel host id -> legacy PHP versions kept installed besides Cluster.php
  phpOf: Record<string, string>; // web hosting service id -> the PHP version it runs; missing means the host's newest
  phpBroken: Record<string, string>; // web hosting service id -> the version it broke on
}

export const newWebPanel = (): WebPanel => ({ phpPool: {}, phpOf: {}, phpBroken: {} });

// A save keeps what it has per sub-record, so a save from an earlier milestone still gets the later sub-fields.
export const mergeWebPanel = (base: WebPanel, data: Partial<WebPanel> | undefined): WebPanel => ({
  phpPool: { ...base.phpPool, ...data?.phpPool }, phpOf: { ...base.phpOf, ...data?.phpOf }, phpBroken: { ...base.phpBroken, ...data?.phpBroken },
});

export const POOL_MAX = 2;
// A broken site writes in with this chance, drawn per site and version.
export const PHP_BROKEN_TICKET = 0.35;
// How many release years of PHP a CMS release keeps running on.
export const PHP_COMPAT_YEARS = 2;

const phpIndex = (version: string): number => PHP.findIndex((p) => p.version === version);
export const phpOlder = (a: string, b: string): boolean => phpIndex(a) < phpIndex(b);

export const poolOf = (s: GameState, hostId: string): string[] => s.webpanel.phpPool[hostId] ?? [];
// The versions installed on a panel host, newest first.
export const phpInstalled = (s: GameState, c: Cluster): string[] => [c.php, ...poolOf(s, c.id).filter((v) => v !== c.php)];

// The PHP version an account runs: its own pick while that is still installed, else the host's newest.
export function phpRunning(s: GameState, c: Cluster, serviceId: string): string {
  const own = s.webpanel.phpOf[serviceId];
  return own && phpInstalled(s, c).includes(own) ? own : c.php;
}

// The newest PHP a CMS release runs on; static sites run on anything.
export function phpLimit(appVersion: number): string {
  return phpAt(appVersion + PHP_COMPAT_YEARS);
}

export const phpFits = (appVersion: number, version: string): boolean => phpIndex(version) <= phpIndex(phpLimit(appVersion));

// The web hosting services that live on a panel host.
export function accountsOf(s: GameState, hostId: string) {
  const ids = new Set(s.workloads.filter((w) => w.clusterId === hostId && w.serviceId).map((w) => w.serviceId));
  return s.services.filter((v) => v.product === "webHosting" && v.endedAt === null && ids.has(v.id));
}

// The oldest PHP version a panel host still runs an account on.
export function phpOldestInUse(s: GameState, c: Cluster): string {
  const used = accountsOf(s, c.id).map((v) => phpRunning(s, c, v.id));
  return [c.php, ...used].reduce((a, v) => (phpOlder(v, a) ? v : a), c.php);
}

// Whether a site's app runs on the PHP it is set to.
export function siteBroken(s: GameState, c: Cluster, serviceId: string): boolean {
  const v = s.services.find((x) => x.id === serviceId);
  return !!v && !!cmsOf(v) && !phpFits(v.spec.appVersion ?? 0, phpRunning(s, c, serviceId));
}

// A host's previous version stays installed; accounts whose app does not run on the new newest move onto it.
export function keepPhp(s: GameState, hostId: string, version: string): void {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || version === c.php || poolOf(s, hostId).length >= POOL_MAX) return;
  const phpPool = { ...s.webpanel.phpPool, [hostId]: [...poolOf(s, hostId), version] }, phpOf = { ...s.webpanel.phpOf };
  for (const v of accountsOf(s, hostId)) {
    if (cmsOf(v) && !phpFits(v.spec.appVersion ?? 0, c.php) && phpFits(v.spec.appVersion ?? 0, version) && phpRunning(s, c, v.id) === c.php) phpOf[v.id] = version;
  }
  s.webpanel = { ...s.webpanel, phpPool, phpOf };
}

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// Daily: sites whose app does not run on their PHP are slowed and some write in; fixed sites withdraw the ticket.
export function phpCompat(s: GameState): void {
  for (const c of s.clusters) {
    if (c.kind !== "panel") continue;
    for (const v of accountsOf(s, c.id)) {
      const version = phpRunning(s, c, v.id), seen = s.webpanel.phpBroken[v.id];
      if (siteBroken(s, c, v.id)) {
        s.services = s.services.map((x) => (x.id === v.id ? { ...x, slowedAt: s.hour } : x));
        if (seen === version) continue;
        s.webpanel = { ...s.webpanel, phpBroken: { ...s.webpanel.phpBroken, [v.id]: version } };
        const cust = s.customers.find((x) => x.id === v.customerId);
        if (cust && rand(hashRng(s.seed, idNum(v.id), phpIndex(version), 310)) < PHP_BROKEN_TICKET && !s.tickets.some((t) => t.serviceId === v.id && t.topic === "phpBroken" && !isFinal(t))) {
          createTicket(s, cust, "howTo", v.id, "phpBroken");
        }
      } else if (seen) {
        const { [v.id]: _, ...rest } = s.webpanel.phpBroken;
        s.webpanel = { ...s.webpanel, phpBroken: rest };
        s.tickets = s.tickets.map((t) => (t.serviceId === v.id && t.topic === "phpBroken" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
      }
    }
  }
}

export function webpanelTick(s: GameState): SimEvent[] {
  if (s.hour % 24 !== 0) return [];
  const hosts = new Set(s.clusters.filter((c) => c.kind === "panel").map((c) => c.id));
  const stale = Object.keys(s.webpanel.phpPool).filter((id) => !hosts.has(id));
  if (stale.length) s.webpanel = { ...s.webpanel, phpPool: Object.fromEntries(Object.entries(s.webpanel.phpPool).filter(([id]) => hosts.has(id))) };
  phpCompat(s);
  return [];
}
