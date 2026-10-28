import { newGame, type GameState } from "../50-state";
import { provisionService } from "./clusters";
import { addCustomer } from "./customers";

// economy.md, Starting state: the basement server with no control plane; the first-time setup installs a panel on it or a
// hypervisor with a panel VM. Three friends wait for web hosting at €6 a month and move their sites over once the first
// panel host is ready.
export const FRIENDS: [string, string][] = [["Jonas Weber", "jonasweber.de"], ["Mira Schulz", "mira-schulz.de"], ["Tobi Kraus", "tobikraus.de"]];
export const FRIEND_HAPPINESS = 85;
export const BASEMENT_SERVER = "dev3";

export const startGame = (seed: number): GameState => newGame(seed);

// The friends sign up on the panel host once, when it is the first ready; false when they already have.
export function welcomeFriends(s: GameState, hostId: string): boolean {
  if (s.customers.some((c) => c.habit === "friend")) return false;
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  for (const [name, label] of FRIENDS) {
    const id = addCustomer(s, name, "private", "friend");
    s.customers.find((c) => c.id === id)!.happiness = FRIEND_HAPPINESS;
    if (!provisionService(s, id, "webHosting", { label, plan: "web-m", clusterId: hostId }).ok) {
      Object.assign(s, before);
      return false;
    }
  }
  return true;
}
