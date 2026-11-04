// docs/design/gdd/connectivity.md: the provider's patch panel on every rented rack and what each of its jacks carries.
import { panelJacks, PROVIDER_PANEL } from "../10-catalog/uplinks";
import { zoneSpots } from "../20-world/properties";
import type { Device, GameState, Rack } from "../50-state";

export type JackRole = "free" | "uplink" | "xconnect" | "provider-cable" | "customer";

export const isProviderPanel = (d: { model: string }): boolean => d.model === PROVIDER_PANEL;
// A rack stands on a provider's floor when its location is in a datacenter; the office and basement are the player's own.
export const rentedFloor = (s: GameState, r: Rack): boolean => !!s.locations.find((l) => l.id === r.locationId)?.dc;
// An own hall has no provider panel: the carriers land on a fiber patch panel the player mounts in the rack.
export const MEETME_PANELS = ["patch-24f", "patch-48f"];
const hallOfRack = (s: GameState, rackId: string) => {
  const r = s.racks.find((x) => x.id === rackId);
  return r ? s.properties.find((p) => p.hall?.locationId === r.locationId)?.hall : undefined;
};
// In a hall only a rack inside the meet-me zone has a panel.
export const inMeetMe = (s: GameState, rackId: string): boolean => {
  const h = hallOfRack(s, rackId), r = s.racks.find((x) => x.id === rackId);
  return !!h && !!r && h.zones.some((z) => z.kind === "meetme" && !!r.tile && zoneSpots(z).some((t) => t.x === r.tile!.x && t.y === r.tile!.y));
};
export const panelOf = (s: GameState, rackId: string): Device | undefined =>
  s.devices.find((d) => d.rackId === rackId && isProviderPanel(d)) ?? (hallOfRack(s, rackId) && inMeetMe(s, rackId) ? s.devices.find((d) => d.rackId === rackId && MEETME_PANELS.includes(d.model)) : undefined);

// Each jack's role, read from the uplink links, cross-connects, provider cables and pending cable orders bound to it.
export function jackRoles(s: GameState, panelId: string): JackRole[] {
  const panel = s.devices.find((d) => d.id === panelId), jacks = panelJacks(panel?.model ?? PROVIDER_PANEL);
  const roles: JackRole[] = Array(jacks).fill("free");
  const mark = (e: { device: string; port: number } | undefined, role: JackRole) => { if (e?.device === panelId && e.port < jacks) roles[e.port] = role; };
  for (const p of s.properties) for (const x of p.hall?.xconnects ?? []) mark(x.jack, "customer");
  for (const u of s.network.uplinks) for (const l of u.links) mark(l.jack, "uplink");
  for (const x of s.crossConnects) mark(x.jack, "xconnect");
  for (const c of s.cables.filter((x) => x.kind === "provider")) { mark(c.a, "provider-cable"); mark(c.b, "provider-cable"); }
  for (const o of s.providerCables) { mark(o.a, "provider-cable"); mark(o.b, "provider-cable"); }
  return roles;
}

export function freeJack(s: GameState, rackId: string): { device: string; port: number } | null {
  const p = panelOf(s, rackId);
  const i = p ? jackRoles(s, p.id).indexOf("free") : -1;
  return p && i >= 0 ? { device: p.id, port: i } : null;
}
