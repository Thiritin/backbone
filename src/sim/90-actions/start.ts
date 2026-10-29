import { newGame, type GameState } from "../50-state";
import { provisionService } from "./clusters";
import { addCustomer } from "./customers";
import { yearOf } from "../00-core/time";
import { WEB_BASE } from "../10-catalog/economy";
import { sizeSpec } from "../10-catalog/products";

// economy.md, Starting state: an empty basement rack. The player buys the first server and sets it up as a panel server or
// a hypervisor with a panel VM. Three friends wait for web hosting at €6 a month and move their sites over once the first
// panel host is ready.
export const FRIENDS: [string, string][] = [["Jonas Weber", "jonasweber.de"], ["Mira Schulz", "mira-schulz.de"], ["Tobi Kraus", "tobikraus.de"]];
export const FRIEND_HAPPINESS = 85;

export const startGame = (seed: number): GameState => newGame(seed);

// The friends sign up on the panel host once, when it is the first ready; false when they already have.
export function welcomeFriends(s: GameState, hostId: string): boolean {
  if (s.customers.some((c) => c.habit === "friend")) return false;
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
