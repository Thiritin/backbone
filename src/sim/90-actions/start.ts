import { newGame, type GameState } from "../50-state";
import { addNode, createCluster, provisionService } from "./clusters";
import { addCustomer } from "./customers";

// economy.md, Starting state: the basement server as the cluster "Basement 1" with nothing installed. Three friends wait for
// web hosting at €6 a month and move their sites over once the first hosting panel is installed.
export const FRIENDS: [string, string][] = [["Jonas Weber", "jonasweber.de"], ["Mira Schulz", "mira-schulz.de"], ["Tobi Kraus", "tobikraus.de"]];
export const FRIEND_HAPPINESS = 85;

// A new company: the starting infrastructure of newGame with the basement server as a cluster node.
export function startGame(seed: number): GameState {
  const s = newGame(seed);
  const cluster = createCluster(s, "loc1", "Basement 1");
  if (!cluster.ok || !addNode(s, cluster.id!, "dev3").ok) throw new Error("starting cluster failed");
  return s;
}

// The friends sign up on the cluster once, when it is the first with a hosting panel; false when they already have.
export function welcomeFriends(s: GameState, clusterId: string): boolean {
  if (s.customers.some((c) => c.habit === "friend")) return false;
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  for (const [name, label] of FRIENDS) {
    const id = addCustomer(s, name, "private", "friend");
    s.customers.find((c) => c.id === id)!.happiness = FRIEND_HAPPINESS;
    if (!provisionService(s, id, "webHosting", { label, plan: "web-m", clusterId }).ok) {
      Object.assign(s, before);
      return false;
    }
  }
  return true;
}
