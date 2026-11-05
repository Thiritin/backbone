// The player's walks in the room (docs/design/gdd/the-world.md, Work orders and figures): opening a close-up or the desktop first walks the
// figure to it. Visits are UI only; they change nothing in the sim and run in real time, also while the game is paused.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import type { Pt } from "../../sim/20-world/layout";
import { present } from "../../sim/60-infra/handwork";
import { useStore } from "../store";

export const WALK_TILES_PER_S = 6;
export const WALK_MAX_S = 2;

// Tiles walked along a path of tile points.
export const pathTiles = (path: Pt[]): number => path.slice(1).reduce((a, p, i) => a + Math.abs(p.x - path[i].x) + Math.abs(p.y - path[i].y), 0);

// Real seconds a walk takes: 6 tiles per second, at most 2 seconds, nothing when already there.
export const walkSeconds = (path: Pt[]): number => Math.min(WALK_MAX_S, pathTiles(path) / WALK_TILES_PER_S);

// The point a fraction f (0 to 1) of the way along a path, by distance.
export function pointAt(path: Pt[], f: number): Pt {
  let d = Math.min(1, Math.max(0, f)) * pathTiles(path);
  for (let i = 1; i < path.length; i++) {
    const len = Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
    if (d <= len) return len ? { x: path[i - 1].x + ((path[i].x - path[i - 1].x) * d) / len, y: path[i - 1].y + ((path[i].y - path[i - 1].y) * d) / len } : path[i];
    d -= len;
  }
  return path[path.length - 1];
}

export interface Visit { locationId: string; to: Pt; label: string; run: () => void }
interface VisitStore {
  // Where the player stands after a visit; null means at the seat.
  at: { locationId: string; pt: Pt } | null;
  // The walk in progress, and a visit waiting behind the player's work orders.
  walk: (Visit & { path: Pt[]; seconds: number }) | null;
  pending: Visit | null;
  set: (p: Partial<Omit<VisitStore, "set">>) => void;
}
export const useVisit = create<VisitStore>((set) => ({ at: null, walk: null, pending: null, set }));

// Runs a close-up or the desktop once the player's figure stands at `to`; at once when the player is not on site or there is no place to walk to.
export function visitThen(locationId: string, to: Pt | null, label: string, run: () => void): void {
  if (!to || !present(useStore.getState().game, locationId)) return run();
  useVisit.getState().set({ pending: { locationId, to, label, run } });
}

// Real milliseconds the figure lingers at a visited object before it walks back to its seat.
export const HOME_MS = 5000;

// Sends the figure back to its seat along `path`; without a walk to make it just sits again.
export function goHome(locationId: string, seat: Pt, path: Pt[]): void {
  const { set } = useVisit.getState(), seconds = walkSeconds(path);
  if (seconds === 0) return set({ at: null });
  set({ walk: { locationId, to: seat, label: "", run: () => useVisit.getState().set({ at: null }), path, seconds } });
}

// Runs `home` once HOME_MS of real time passed with the player standing at a visit in this location and nothing blocking.
// The callback is read through a ref, so re-renders from game ticks never restart the wait.
export function useHomeTimer(locationId: string, blocked: boolean, home: () => void): void {
  const at = useVisit((v) => v.at), walk = useVisit((v) => v.walk), pending = useVisit((v) => v.pending), cb = useRef(home);
  cb.current = home;
  useEffect(() => {
    if (!at || at.locationId !== locationId || walk || pending || blocked) return;
    const id = setTimeout(() => cb.current(), HOME_MS);
    return () => clearTimeout(id);
  }, [at, walk, pending, blocked, locationId]);
}
