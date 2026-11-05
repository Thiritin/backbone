import { useSyncExternalStore } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import { present } from "../../../sim/60-infra/handwork";
import type { GameState } from "../../../sim/50-state";
import { readSession, writeSession } from "../../session";

// The crash cart's cable: the server whose VGA port it is plugged into. Shared with the desktop rack view through the session key.
const KEY = "loc.monitor";
let plugged = readSession<string | null>(KEY, null), last: string | null = null;
const subs = new Set<() => void>();

export function setPlug(id: string | null): void {
  plugged = id;
  writeSession(KEY, id);
  subs.forEach((f) => f());
}
export const usePlug = (): string | null => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => plugged);
export const getPlug = (): string | null => plugged;
export const noteSelected = (id: string | null): void => { if (id) last = id; };

export const serversAt = (game: GameState, locationId: string): string[] =>
  game.devices.filter((d) => modelById(d.model).kind === "server" && game.racks.some((r) => r.id === d.rackId && r.locationId === locationId)).map((d) => d.id);

// Where the cart's cable ends: the plugged server if it stands in this room, else the room's only server, else the last one looked at.
export function cartTarget(game: GameState, locationId: string, cable: string | null, selected: string | null = last): string | null {
  if (!present(game, locationId)) return null;
  const ids = serversAt(game, locationId);
  if (cable && ids.includes(cable)) return cable;
  if (ids.length === 1) return ids[0];
  return selected && ids.includes(selected) ? selected : null;
}
