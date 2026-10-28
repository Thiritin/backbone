import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";

export const SAVE_VERSION = 2;

export type BondMode = "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber";

export type SpaceKind = "basement" | "positions" | "cage" | "suite";
export interface Location { id: string; dc: string | null; city: string; name: string; space: SpaceKind; positions: number; readyAt: number }
export type RackModel = "rack-24" | "rack-42" | "rack-47";
// arriveAt is the hour a moving rack arrives; null when it is in place. A moving rack already holds its target location and position.
export interface Rack { id: string; model: RackModel; locationId: string; position: number; name: string; arriveAt: number | null; price: number; boughtAt: number }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
// A gateway sits on its location's carrier panel: rackId null, panel = location id. rackId and panel both null: in storage.
export interface Device { id: string; model: string; brand: string; rackId: string | null; slot: number; panel: string | null; name: string; bond: BondMode; groups: number[][]; price: number; boughtAt: number }
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

const device = (id: string, model: string, brand: string, rackId: string | null, slot: number, panel: string | null, name: string, price: number): Device =>
  ({ id, model, brand, rackId, slot, panel, name, bond: "failover", groups: [], price, boughtAt: 0 });

// Starting state: a 24U basement rack with a server and a switch, cabled to the home router so the server starts online.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH, nextId: 8,
  locations: [{ id: "loc1", dc: null, city: "Frankfurt", name: "Basement", space: "basement", positions: 1, readyAt: 0 }],
  racks: [{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0 }],
  devices: [
    device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500),
    device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60),
    device("dev5", "home-router", "Sysko", null, 0, "loc1", "fra1-gw-01", 0),
  ],
  cables: [
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper" },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper" },
  ],
  ledger: [], powerDue: 0,
});
