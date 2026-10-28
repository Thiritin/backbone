import { RENAMED_MODELS } from "../10-catalog/hardware";
import { nextAz } from "../20-world/datacenters";
import { newGame, SAVE_VERSION, type Device, type GameState } from "../50-state";

// ponytail: plain JSON in localStorage; compress once saves approach the ~5 MB limit.
export const serialize = (state: GameState): string => JSON.stringify(state);

const INFRA = ["nextId", "locations", "racks", "devices", "cables"] as const;

// Old saves keep loading: every field missing from a save takes its new-game default.
// A version 1 save (the basement shelf, or no infrastructure at all) gets the version 2 starting infrastructure.
export function deserialize(raw: string): GameState {
  const data = JSON.parse(raw) as Partial<GameState>;
  if (typeof data.seed !== "number") throw new Error("save has no seed");
  const base = newGame(data.seed);
  if ((data.version ?? 1) < 2) for (const k of INFRA) delete data[k];
  const locations: GameState["locations"] = [];
  for (const l of data.locations ?? base.locations) locations.push({ ...l, az: l.az ?? nextAz(locations, l.city) });
  // Older saves had one stockroom; its units go to the first location.
  const stored = (d: Device) => d.store !== undefined ? d.store : !d.rackId && !d.panel ? locations[0].id : null;
  const devices = (data.devices ?? base.devices).map((d) => ({
    ...d, model: RENAMED_MODELS[d.model] ?? d.model, lease: d.lease ?? null, store: stored(d), transitTo: d.transitTo ?? null, arriveAt: d.arriveAt ?? null,
  }));
  const racks = (data.racks ?? base.racks).map((r) => ({ ...r, provided: r.provided ?? false }));
  return { ...base, ...data, locations, devices, racks, rng: { ...base.rng, ...data.rng }, version: SAVE_VERSION };
}
