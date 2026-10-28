import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";

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

export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH,
  nextId: 1, locations: [], racks: [], devices: [], cables: [], ledger: [], powerDue: 0,
});
