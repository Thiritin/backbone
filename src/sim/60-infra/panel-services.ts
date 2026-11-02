// docs/design/plans/panel-ops.md, Services and Components: the daemons a web panel host runs and the stack it installed.
import { nowMinutes, yearOf } from "../00-core/time";
import { componentById, componentOffered, DEFAULT_COMPONENTS, PANEL_COMPONENTS, type PanelComponent } from "../10-catalog/panel-components";
import type { GameState, LedgerEntry } from "../50-state";
import type { Cluster } from "./cluster";
import type { PanelStack } from "./webpanel";

export const RESTART_MINUTES = 2;

// slot: the component slot whose installed component names the service; sites: the host's sites are down while it restarts.
export interface PanelService { id: string; slot?: "mail" | "ftp" | "web"; sites?: boolean }

// "id:mark", where mark is a slot (web also takes the sites down) or "sites".
const list = (ids: string): PanelService[] => ids.split(" ").map((x) => {
  const [id, mark] = x.split(":");
  if (mark === "sites") return { id, sites: true };
  return mark ? { id, slot: mark as PanelService["slot"], sites: mark === "web" } : { id };
});

export const PANEL_SERVICES: Record<string, PanelService[]> = {
  cpanic: list("cpsrvd httpd:web php-fpm:sites mysql exim:mail dovecot pure-ftpd:ftp named sshd"),
  pleskit: list("psa apache:web nginx:sites php-fpm:sites mysql postfix:mail dovecot proftpd:ftp bind sshd"),
  directadmen: list("directadmin httpd:web php-fpm:sites mysql exim:mail dovecot proftpd:ftp named sshd"),
  freepanel: list("webmin apache:web php-fpm:sites mysql postfix:mail dovecot proftpd:ftp bind sshd"),
};

export const servicesOf = (c: Cluster): PanelService[] => (c.kind === "panel" && c.panel ? PANEL_SERVICES[c.panel] ?? [] : []);

// The stack a host runs: what the player installed where its panel still offers it, else the family default.
export function stackOf(s: GameState, c: Cluster): Required<PanelStack> {
  const family = c.panel ?? "", own = s.webpanel.components[c.id], def = DEFAULT_COMPONENTS[family];
  const fits = (id: string | undefined): id is string => !!id && componentById(id)?.panels[family] !== undefined;
  const pick = (slot: "mail" | "ftp" | "web") => { const id = own?.[slot]; return fits(id) ? id : def?.[slot] ?? ""; };
  return { mail: pick("mail"), ftp: pick("ftp"), web: pick("web"), modules: (own?.modules ?? []).filter(fits) };
}

// Components the host's panel offers this year.
export const componentsFor = (s: GameState, c: Cluster): PanelComponent[] =>
  PANEL_COMPONENTS.filter((x) => !!c.panel && componentOffered(x, c.panel, yearOf(s.hour)));

export function serviceName(s: GameState, c: Cluster, serviceId: string): string {
  const slot = servicesOf(c).find((x) => x.id === serviceId)?.slot;
  return (slot && componentById(stackOf(s, c)[slot])?.name) || serviceId;
}

export const restarting = (s: GameState, hostId: string, serviceId: string): boolean => (s.webpanel.restarts[hostId]?.[serviceId] ?? 0) > nowMinutes(s);

// Whether a web or PHP restart keeps the host's sites down right now.
export function restartDown(s: GameState, hostId: string): boolean {
  const c = s.webpanel.restarts[hostId] && s.clusters.find((x) => x.id === hostId);
  return !!c && servicesOf(c).some((x) => x.sites && restarting(s, hostId, x.id));
}

export const installingOn = (s: GameState, hostId: string): { id: string; until: number } | undefined => {
  const x = s.webpanel.installing[hostId];
  return x && x.until > nowMinutes(s) ? x : undefined;
};

// Every minute: finished restarts leave the list and finished installs take their slot.
export function panelOpsTick(s: GameState): void {
  const now = nowMinutes(s), wp = s.webpanel;
  if (Object.values(wp.restarts).some((r) => Object.values(r).some((until) => until <= now))) {
    const restarts = Object.fromEntries(Object.entries(wp.restarts)
      .map(([host, r]) => [host, Object.fromEntries(Object.entries(r).filter(([, until]) => until > now))] as const)
      .filter(([, r]) => Object.keys(r).length));
    s.webpanel = { ...s.webpanel, restarts };
  }
  const done = Object.entries(wp.installing).filter(([, x]) => x.until <= now);
  if (!done.length) return;
  const components = { ...s.webpanel.components }, installing = { ...s.webpanel.installing };
  for (const [host, x] of done) {
    delete installing[host];
    const comp = componentById(x.id), own = components[host] ?? { modules: [] };
    if (!comp) continue;
    components[host] = comp.slot === "module" ? { ...own, modules: [...new Set([...own.modules, comp.id])] } : { ...own, [comp.slot]: comp.id };
  }
  s.webpanel = { ...s.webpanel, components, installing };
}

// The month's module fees, one line per module and host.
export function moduleBills(s: GameState): LedgerEntry[] {
  return s.clusters.filter((c) => c.kind === "panel" && s.webpanel.components[c.id]).flatMap((c) => stackOf(s, c).modules
    .map((id) => componentById(id)!)
    .filter((x) => x.fee > 0)
    .map((x) => ({ hour: s.hour, category: "subscriptions", key: "ledger.panelModule", params: { module: x.name, host: c.name }, amount: -x.fee })));
}
