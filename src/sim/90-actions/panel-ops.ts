// docs/design/plans/panel-ops.md, Services and Components.
import { nowMinutes } from "../00-core/time";
import { componentById } from "../10-catalog/panel-components";
import { componentsFor, RESTART_MINUTES, restarting, servicesOf, stackOf } from "../60-infra/panel-services";
import { accountsOf } from "../60-infra/webpanel";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

const panelHost = (s: GameState, hostId: string) => {
  const c = s.clusters.find((x) => x.id === hostId);
  return !c ? fail("error.unknownCluster") : c.kind !== "panel" || !c.panel ? fail("error.notPanelHost") : c;
};

// A web or PHP restart also brings back the sites a broken update or PHP left hanging.
export function restartService(s: GameState, hostId: string, serviceId: string): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  const svc = servicesOf(c).find((x) => x.id === serviceId);
  if (!svc) return fail("error.unknownService");
  if (restarting(s, hostId, serviceId)) return fail("error.restarting");
  const restarts = { ...s.webpanel.restarts, [hostId]: { ...s.webpanel.restarts[hostId], [serviceId]: nowMinutes(s) + RESTART_MINUTES } };
  s.webpanel = { ...s.webpanel, restarts };
  if (svc.sites) {
    const ids = new Set(accountsOf(s, hostId).map((v) => v.id));
    const keep = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([id]) => !ids.has(id)));
    s.webpanel = { ...s.webpanel, appBroken: keep(s.webpanel.appBroken), appBack: keep(s.webpanel.appBack), phpBroken: keep(s.webpanel.phpBroken) };
  }
  return { ok: true };
}

export function installComponent(s: GameState, hostId: string, componentId: string): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  const comp = componentById(componentId);
  if (!comp || !componentsFor(s, c).includes(comp)) return fail("error.componentUnavailable");
  const stack = stackOf(s, c);
  if (comp.slot === "module" ? stack.modules.includes(comp.id) : stack[comp.slot] === comp.id) return fail("error.componentInstalled");
  if (s.webpanel.installing[hostId]) return fail("error.installing");
  s.webpanel = { ...s.webpanel, installing: { ...s.webpanel.installing, [hostId]: { id: comp.id, until: nowMinutes(s) + comp.installMinutes } } };
  return { ok: true };
}

export function removeModule(s: GameState, hostId: string, componentId: string): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  const own = s.webpanel.components[hostId];
  if (!own?.modules.includes(componentId)) return fail("error.notInstalled");
  s.webpanel = { ...s.webpanel, components: { ...s.webpanel.components, [hostId]: { ...own, modules: own.modules.filter((x) => x !== componentId) } } };
  return { ok: true };
}
