// GDD, Infrastructure consoles: the state of the mail, DNS, VPN and storage consoles lives in one object so a save and a new game
// each need a single line. Entries are created on first use, so an empty object behaves like a fresh game.
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

// Per mail address: the deferred queue, the happiness lost to the current listing, the hours of past listings, when the current listing began and when the queue was last deleted.
export interface MailState { deferred: number; hit: number; listings: number[]; deletedAt?: number; since?: number }

export interface NetSvc {
  mail: Record<string, MailState>; // by address id
  relay: Record<string, string>; // panel cluster id -> mail cluster id
  broken: Record<string, { cause: "dns" | "cert" | "storage"; since: number }>; // by service id
}

export const newNetSvc = (): NetSvc => ({ mail: {}, relay: {}, broken: {} });

// A service whose DNS, certificate or storage set is broken is offline for its customer; `serviceOnline` reads this.
export const netsvcBroken = (s: GameState, serviceId: string): boolean => serviceId in s.netsvc.broken;

// Hourly; every feature of the console lanes adds its own tick call here.
export function netsvcTick(_s: GameState): SimEvent[] {
  return [];
}
