import { createRng, type Rng } from "./00-core/rng";
import { BASEMENT_SLOTS, START_CASH } from "./10-catalog/economy";

export const SAVE_VERSION = 1;

export type BondMode = "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber";

export interface Location { id: string; kind: "basement" | "rented"; city: string; name: string }
// A basement shelf has slots of height 1 that only shelf devices fit; a rack has rack units.
export interface Rack { id: string; locationId: string; name: string; units: number; shelf: boolean; rentPerMonth: number }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
export interface Device { id: string; model: string; brand: string; rackId: string; slot: number; name: string; bond: BondMode; groups: number[][] }
export interface End { device: string; port: number }
export interface Cable { id: string; a: End; b: End; kind: CableKind }
export interface LedgerEntry { hour: number; category: string; key: string; params: Record<string, string | number>; amount: number }

export interface GameState {
  version: number;
  seed: number;
  rng: Rng;
  hour: number;
  cash: number;
  nextId: number;
  locations: Location[];
  racks: Rack[];
  devices: Device[];
  cables: Cable[];
  ledger: LedgerEntry[];
  // Power drawn since the last monthly bill, in euros.
  powerDue: number;
}

// Starting state: the tower on the basement shelf, cabled to the home router so it starts online.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH, nextId: 6,
  locations: [{ id: "loc1", kind: "basement", city: "Frankfurt", name: "Basement" }],
  racks: [{ id: "rack2", locationId: "loc1", name: "fra1-shelf", units: BASEMENT_SLOTS, shelf: true, rentPerMonth: 0 }],
  devices: [
    { id: "dev3", model: "tower", brand: "Dwell", rackId: "rack2", slot: 1, name: "fra1-srv-01", bond: "failover", groups: [] },
    { id: "dev4", model: "home-router", brand: "Sysko", rackId: "rack2", slot: BASEMENT_SLOTS, name: "fra1-gw-01", bond: "failover", groups: [] },
  ],
  cables: [{ id: "cab5", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper" }],
  ledger: [], powerDue: 0,
});
