import { newGame, type GameState } from "../50-state";
import { provisionService } from "./clusters";
import { clusterReachable } from "../60-infra/cluster";
import { addCustomer } from "./customers";
import { yearOf } from "../00-core/time";
import { WEB_BASE } from "../10-catalog/economy";
import { sizeSpec } from "../10-catalog/products";
import { challengeById } from "../10-catalog/challenges";
import { capacityAt, DATACENTERS } from "../20-world/datacenters";
import { EARLY_HOURS } from "../10-catalog/used";
import { monthListings } from "../80-business/used";

// economy.md, Starting state: an empty basement rack. The player buys the first server and sets it up as a panel server or
// a hypervisor with a panel VM. Three friends wait for web hosting at €6 a month and move their sites over once the first
// panel host is ready.
export const FRIENDS: [string, string][] = [["Jonas Weber", "jonasweber.de"], ["Mira Schulz", "mira-schulz.de"], ["Tobi Kraus", "tobikraus.de"]];
export const FRIEND_HAPPINESS = 85;

// The tick fills the used market at each month start after the first, so January's listings come with the new game,
// all of them up from the first hour.
function opened(seed: number): GameState {
  const s = newGame(seed);
  s.used = monthListings(s).map((l) => ({ ...l, postedAt: s.hour - EARLY_HOURS }));
  return s;
}

export const startGame = (seed: number): GameState => opened(seed);

// A weekly challenge: its seed plus its twist (10-catalog/challenges.ts). A datacenter twist fills every other datacenter.
export function startChallenge(id: string): GameState {
  const c = challengeById(id);
  if (!c) throw new Error(`unknown challenge ${id}`);
  const s = opened(c.seed);
  s.challenge = c.id;
  const t = c.twist;
  if (t.kind === "cash") s.cash = t.cash;
  if (t.kind === "line") s.homeLine = { id: t.line, next: null };
  if (t.kind === "dc") s.dcs = Object.fromEntries(DATACENTERS.map((dc) => [dc.id, dc.id === t.dc ? s.dcs[dc.id] : { others: capacityAt(dc, 2005) }]));
  return s;
}

// The friends sign up on the panel host once, when it is the first ready; false when they already have.
export function welcomeFriends(s: GameState, hostId: string): boolean {
  const host = s.clusters.find((c) => c.id === hostId);
  if (s.customers.some((c) => c.habit === "friend") || !host?.panel || !clusterReachable(s, host)) return false;
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  for (const [name, label] of FRIENDS) {
    const id = addCustomer(s, name, "private", "friend");
    s.customers.find((c) => c.id === id)!.happiness = FRIEND_HAPPINESS;
    if (!provisionService(s, id, "webHosting", { label, spec: sizeSpec("webHosting", 1, yearOf(s.hour)), price: WEB_BASE / 730, clusterId: hostId }).ok) {
      Object.assign(s, before);
      return false;
    }
  }
  return true;
}
